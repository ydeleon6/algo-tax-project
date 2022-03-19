import data from "../data/common.js";
import { createNewLogger } from "../logging.js";
import { TransactionFileWriter } from "../data/file-writer.js";

const logger = createNewLogger("transaction-analyzer");

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
     * @param {Database} logger The logger.
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
    async analyzeTransactions(transactions, accountAddress) {
        const transactionDate = new Date(transactions[0].timestamp);
        console.log("%s %s", transactionDate.toLocaleDateString(), transactionDate.toLocaleTimeString());
        for (const transaction of transactions) {
            switch (transaction.type) {
                case 'appl':
                    await this.handleApplicationCall(transaction, accountAddress);
                    break;
                case 'axfer':
                    await this.handleAssetTransferTransaction(transaction, accountAddress);
                    break;
                case 'pay':
                    await this.handlePaymentTransaction(transaction, accountAddress);
                    break;
                default:
                    logger.error("Cannot handle transaction type of %s", transaction.type);
                    break;
            }
        }
    }

    /**
     * Analyze the application transaction. These are calls to an app like a "smart contract"
     * and do not technically transfer money. They are usually grouped with another transaction
     * that do exchange ASA / Algos.
     * @param {object} transaction The transaction
     * @param {String} accountAddress The account address.
     */
    async handleApplicationCall(transaction, accountAddress) {
        const fee = await this.assetMap.getDisplayValue(0, transaction.fee);
        const appName = await this.knownApplications.getNameById(transaction.appId);

        if (transaction.sender === accountAddress) {
            logger.info("You called the '%s' application with a %d Algo fee.", appName, fee);
        } else {
            logger.info("The '%s' application called you.", appName);
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

        if (paymentAmount) {
            // Log who we sent/received a payment from.
            const displayAmount = await this.assetMap.getDisplayValue(0, paymentAmount);

            if (transaction.sender === accountAddress) {
                const receiverName = await this.knownAddresses.getNameByAddress(transaction.receiver);
                logger.info("You paid %d Algos to the '%s' account.", displayAmount, receiverName);
            } else if (transaction.receiver === accountAddress) {
                const senderName = await this.knownAddresses.getNameByAddress(transaction.sender);
                logger.info("You were paid %d Algos from the '%s' account.", displayAmount, senderName);
            }
        }
    }

    /**
     * Process an AssetTransfer transaction. These are ASA tokens leaving/entering your wallet to another one.
     * Anything that isn't Algorand (e.g. Yieldly, USDC) are technically ASA tokens.
     * @param {object} transaction The transaction object.
     * @param {String} accountAddress The account address to compare.
     */
    async handleAssetTransferTransaction(transaction, accountAddress) {
        const asset = await this.assetMap.fetchAsset(transaction.asset);
        const displayAmount = await this.assetMap.getDisplayValue(asset.id, transaction.amount);

        if (transaction.sender === transaction.receiver && displayAmount === 0) {
            logger.info("User opted-into the '%s' ASA.", asset.name);
        } else if (transaction.sender === accountAddress) {
            const accountName = await this.knownAddresses.getNameByAddress(transaction.receiver);
            logger.info("You transferred %d %s to the '%s' account", displayAmount, asset.name, accountName);
        } else if (transaction.receiver === accountAddress) {
            const accountName = await this.knownAddresses.getNameByAddress(transaction.sender);
            logger.info("You received %d %s from the '%s' account", displayAmount, asset.name, accountName); 
        } else {
            logger.info("What happened here? Sender %s - Receiver %s", transaction.sender, transaction.receiver)
        }
    }

    async close() {
        await this.database.close();
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
            console.log("We'll handle this later.");
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
        await transactionAnalyzer.analyzeTransactions(transactions, accountAddress);
    }
}