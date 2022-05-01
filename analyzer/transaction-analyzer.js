import data from "../data/common.js";
import * as indexerApi from "../data/indexer.js";
import { createNewLogger } from "../logging.js";
import { TransactionFileWriter } from "../data/file-writer.js";

const logger = createNewLogger("transaction-analyzer");

const STAKING_POOL ="StakingPool";
const LIQUIDITY="LiquidityPool";
const DEFI_SWAP="DefiSwap";
const WALLET="Wallet";
const ESCROW="Escrow";
const UNKNOWN = "Unknown";
const NONE = -1;
const LEAVING = 0;
const ENTERING = 1
const CurrencyDirection = {
    NONE, LEAVING, ENTERING
};

class Analysis {
    /**
     * 
     * @param {String} source The source of the transaction.
     * @param {String} destination The destination for the transaction.
     * @param {String} intent The intent of the transaction, e.g. Staking / Payment / Rewards / Liquidity
     * @param {object} transaction The taxable transaction.
     */
    constructor(source, destination, intent, transaction){
        this.source = source;
        this.destination = destination;
        this.intent = intent;
        this.transaction = transaction;
    }
}

export class TransactionAnalyzer {
    /**
     * Create a new transaction analyzer that looks through your transactions
     * and makes notes of taxable events.
     * @param {TransactionFileWriter} fileWriter The transaction file writer
     * @param {Database} database The database.
     */
    constructor(fileWriter, database) {
        this.fileWriter = fileWriter;
        this.database = database;
        this.assetMap = data.assets;
        this.knownApplications = data.applications;
        this.knownAddresses = data.accounts;
    }

    /**
     * Analyze the transactions and perform an analysis based on its content.
     * @param {object[]} transactions The transaction objects.
     * @param {String} accountAddress The account address to compare.
     */
    async analyzeTransactions(transactionGroup, accountAddress) {
        const appCalls = transactionGroup['appl'] || [];
        const applicationInfo = await this.handleApplicationCalls(appCalls);
        
        // skip payments for now.
        const assetTransfers = transactionGroup['axfer'] || [];
        const axfers = await this.handleAssetTransferTransactions(assetTransfers, accountAddress);
        let fullMessage;

        if(applicationInfo.app === "Yieldly") {
            // you can't swap in yieldly so you only have one incoming or one outgoing.
            // you can only stake or claim from yieldly pools.
            if (axfers.incomingTransfer) {
                fullMessage = `Claimed ${axfers.incomingTransfer.amount} ${axfers.incomingTransfer.asset}`;
            } else if (axfers.outgoingTransfer) {
                fullMessage = `Staked ${axfers.outgoingTransfer.amount} ${axfers.outgoingTransfer.asset}`;
            } else if (axfers.outgoingTransfer && axfers.incomingTransfer){
                fullMessage = "Not sure how I have two things from Yieldly?";
            } else {
                fullMessage = JSON.stringify(axfers);
            }
        }
        else if (applicationInfo.app === "Tinyman") {
            if (axfers.incomingTransfer && axfers.outgoingTransfer) {
                fullMessage = `Swapped ${axfers.outgoingTransfer.amount} ${axfers.outgoingTransfer.asset} for`;
                fullMessage += ` ${axfers.incomingTransfer.amount} ${axfers.incomingTransfer.asset}`;
            }
            else if (axfers.incomingTransfer) {
                fullMessage = `Claimed ${axfers.incomingTransfer.amount} ${axfers.incomingTransfer.asset}`;
            } else {
                fullMessage = "UNKNOWN: When would I send something to Tinyman and not get anything back?"
            }
        } else {
            fullMessage = "Unknown: " + JSON.stringify(applicationInfo);
        }
        const timestampStr = this.formatTimestamp(transactionGroup.timestamp);
        
        return `[${timestampStr}] - ${fullMessage}`
    }

    formatTimestamp(timestampMs) {
        const date = new Date(timestampMs);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }

    /**
     * Analyze the application transaction. These are calls to an app like a "smart contract"
     * and do not technically transfer money. They are usually grouped with another transaction
     * that do exchange ASA / Algos.
     * @param {object} transaction The transaction
     * @param {String} accountAddress The account address.
     */
    async handleApplicationCalls(transactions) {
        let fees = 0;
        let intent = '';
        let appName = '';
        let apps = [];
        
        for (const txn of transactions) {
            fees += txn.fee;
            // who is it?
            // apparently we can find out the intent for tinyman (I think) by looking at the app params.
            // the first one is a base64 encoded string of the action like "swap", "pool", etc...
            const app = this.knownApplications.getApplication(txn.appId);
            if (app.tag === 'Yieldly') {
                appName = 'Yieldly';
                intent = STAKING_POOL;
            } else if (app.tag === 'Tinyman') {
                appName = app.name;
                const appCallArgs = txn.innerTransaction['application-args']; // array
                if (appCallArgs.length > 0) {
                    if (typeof appCallArgs[0] === 'string') {
                        let action = Buffer.from(appCallArgs[0], 'base64').toString();
                        if (action === 'swap') {
                            intent = DEFI_SWAP;
                        } else if (action === "redeem") {
                            intent = "Redeem";
                        } else {
                            intent = action;
                            console.log(intent);
                        }
                    }
                }
            } else {
                appName = app.name;
            }
            apps.push(app);
        };

        const fee = await this.assetMap.getDisplayValue(0, fees);

        return {
            fee: fee,
            app: appName,
            intent: intent || UNKNOWN
        }
    }

    /**
     * Analyze the Payment transaction. Payments are always counted in microAlgos.
     * All transactions have a fee to prevent DDoS, but I see these being used to 
     * pay an extra fee to Yieldly smart contracts.
     * @param {object} transaction The transaction.
     * @param {String} accountAddress The account address.
     */
    async handlePaymentTransaction(transaction, accountAddress) {
        const paymentAmount = transaction.amount;
        // Log who we sent/received a payment from.
        let knownAccount;
        let receiverName = "You";
        let senderName = "You";
        let paymentDirection = CurrencyDirection.NONE;
        const displayAmount = await this.assetMap.getDisplayValue(0, paymentAmount);

        if (transaction.sender === accountAddress) {
            paymentDirection = CurrencyDirection.LEAVING;
            knownAccount = await this.knownAddresses.getAccount(transaction.receiver);
            receiverName = knownAccount.name;
            logger.info("You paid %d Algos to the '%s' account.", displayAmount, receiverName);
        } else if (transaction.receiver === accountAddress) {
            paymentDirection = CurrencyDirection.ENTERING;
            knownAccount = await this.knownAddresses.getAccount(transaction.sender);
            senderName = knownAccount.name;
            logger.info("You were paid %d Algos from the '%s' account.", displayAmount, senderName);
        }

        return {
            asset: "Algorand",
            amount: displayAmount,
            receiverName,
            senderName,
            intent: knownAccount.intent,
            currencyDirection: paymentDirection
        };
    }

    /**
     * Process an AssetTransfer transaction. These are ASA tokens leaving/entering your wallet to another one.
     * Anything that isn't Algorand (e.g. Yieldly, USDC) are technically ASA tokens.
     * @param {object} transaction The transaction object.
     * @param {String} accountAddress The account address to compare.
     */
    async handleAssetTransferTransactions(transactions, accountAddress) {
        let outgoingTransfer;
        let incomingTransfer;
        let isOptIn;

        for (const transaction of transactions) {
            const asset = await this.assetMap.fetchAsset(transaction.asset);
            const displayAmount = await this.assetMap.getDisplayValue(asset.id, transaction.amount);
            let knownAccount;
            let receiverName = "You";
            let senderName = "You";
    
            if (transaction.sender === transaction.receiver && displayAmount === 0) {
                logger.info("User opted-into the '%s' ASA.", asset.name);
                isOptIn = true;
            } else if (transaction.sender === accountAddress) {
                knownAccount = this.knownAddresses.getAccount(transaction.receiver);
                receiverName = knownAccount.name;
                outgoingTransfer = {
                    asset: asset.name,
                    amount: displayAmount,
                    to: receiverName
                };
                logger.info("You transferred %d %s to the '%s' account", displayAmount, asset.name, receiverName);
            } else if (transaction.receiver === accountAddress) {
                knownAccount = this.knownAddresses.getAccount(transaction.sender);
                senderName = knownAccount.name;
                incomingTransfer = {
                    asset: asset.name,
                    amount: displayAmount,
                    from: senderName
                };
                logger.info("You received %d %s from the '%s' account", displayAmount, asset.name, senderName); 
            } else {
                logger.error("What happened here? Sender %s - Receiver %s", transaction.sender, transaction.receiver);
                throw new Error("Unknown transaction operation");
            }
        };

        return {
            incomingTransfer, outgoingTransfer, isOptIn
        }
    }

    async close() {
        this.fileWriter.close();
    }
}

export async function analyzeTransactions(database, accountAddress) {
    // Analyze transactions
    const fileWriter = new TransactionFileWriter("results.csv");
    const transactionAnalyzer = new TransactionAnalyzer(fileWriter, database);

    // get all grouped transactions.
    const transactionCollection = database.database.collection('transactions');
    const groupIds = await transactionCollection.distinct('group');

    for (let i = 0; i < groupIds.length; i++) {
        const groupId = groupIds[i];
        if (groupId == null) {
            console.log("We'll handle these later.");
            continue;
        }
        const query = {
            group: groupId
        };
        const options = {
            sort: {
                timestamp: 1
            }
        };
        const transactionCursor = await transactionCollection.find(query, options);
        const transactions = await transactionCursor.toArray();
        let transactionGroup = transactions.reduce((acc,current,i) =>{
            if (!acc[current.type]) {
                acc[current.type] = [];
            }
            acc[current.type].push(current);
            acc.timestamp = current.timestamp;
            return acc;
        }, {});
        const result = await transactionAnalyzer.analyzeTransactions(transactionGroup, accountAddress);
        console.log(result);
    }

    transactionAnalyzer.close();
}