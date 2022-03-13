import * as indexerApi from "./api/indexer.js";
import data from "./data/common.js";
import { RawTransactionImporter, TransactionFileWriter } from "./data/file-writer.js";


export class TransactionAnalyzer {
    /**
     * Create a new transaction analyzer that looks through your transactions
     * and makes notes of taxable events.
     * @param {indexerApi} indexerApi The indexer api.
     * @param {TransactionFileWriter} fileWriter The transaction file writer
     */
    constructor(indexerApi, fileWriter, logger) {
        this.indexerApi = indexerApi;
        this.fileWriter = fileWriter;
        this.logger = logger;
    }

    init() {
        //TODO: Load data from the database.
        this.assetMap = data.AssetMap;
        this.knownApplications = data.KnownApplications;
        this.knownAddresses = data.KnownAddresses;
    }

    /**
     * Check if the transaction is a non-taxable opt-in transaction.
     * @param {transaction} transaction The transaction
     * @returns True if the transaction was an asset opt-in transaction.
     */
    isOptInTransaction(transaction) {
        const transactionType = transaction['tx-type'];
        let isOptIn = false;
        let innerTransaction = null;

        if (transactionType === 'axfer') {
            innerTransaction = transaction['asset-transfer-transaction'];
        } else if (transactionType === 'pay') {
            innerTransaction = transaction['payment-transaction'];
        }

        if (innerTransaction != null
           && innerTransaction.receiver === transaction.sender
           && transaction.amount === 0) {
            console.log(`User opted in to ${asset.name}. Skipping`);
            this.fileWriter.skip(transaction, "Opt-In")
            isOptIn = true;
        }
        return isOptIn;
    }

    /**
     * Analyze the transaction and perform an action based on it's type.
     * @param {transaction} transaction The transaction object.
     * @param {String} accountAddress The account address to compare.
     */
    async analyzeTransaction(transaction, accountAddress) {
        if (this.isOptInTransaction(transaction)) {
            return;
        }
        const transactionType = transaction['tx-type'];

        switch (transactionType) {
            case 'appl':
                await this.handleApplicationCall(transaction, accountAddress);
                break;
            case 'axfer':
                const transferTransaction = transaction['asset-transfer-transaction']
                await this.writeTaxableTransaction(transaction, transferTransaction, accountAddress);
                break;
            case 'pay':
                await this.handlePaymentTransaction(transaction, accountAddress);
                break;
            default:
                console.error("Unknown transaction type of %d", transactionType);
                break;
        }
    }

    // Log what app calls are being done.
    async handleApplicationCall(transaction, accountAddress) {
        const appTransaction = transaction['application-transaction'];
        const appId = appTransaction['application-id'];
        const fee = await this.assetMap.getDisplayValue(0, transaction.fee);
        const appName = await this.knownApplications.getNameById(appId);

        //TODO: Not sure I need this. I guess if I was tracking this too I could.
        // let accountNames = appTransactions.accounts;

        if (transaction.sender === accountAddress) {
            console.log("You called the %s application with a %d Algo fee.", appName, fee);
        } else {
            console.log("The %s application called you.", appName);
        }
        this.fileWriter.skip(transaction, "Application");
    }

    async handlePaymentTransaction(transaction, accountAddress) {
        const paymentTransaction = transaction['payment-transaction'];
        const paymentAmount = paymentTransaction.amount;
        // Could I figure this out which payments are "fees" vs. "staking" from the surrounding 
        // transactions? I would have to do a database query or something.
        // if it's staking, we would pay taxes I think?
        if (paymentAmount) {
            // Log who we sent/received a payment from.
            const displayAmount = await this.assetMap.getDisplayValue(0, paymentAmount);

            if (transaction.sender === accountAddress) {
                const receiverName = await this.knownAddresses.getNameByAddress(paymentTransaction.receiver);
                console.log("You paid %d Algos to the %s account.", displayAmount, receiverName);
            } else if (paymentTransaction.receiver === accountAddress) {
                const senderName = await this.knownAddresses.getNameByAddress(transaction.sender);
                console.log("You were paid %d Algos from the %s account.", displayAmount, senderName);
            }
        }
        this.fileWriter.skip(transaction, "Payment");
    }

    /**
     * Process an asset transaction, this is crypto leaving/entering your wallet to another wallet.
     * @param {object} transaction The transaction object.
     * @param {String} accountAddress The account address to compare.
     */
    async writeTaxableTransaction(transaction, innerTransaction, accountAddress) {
        const assetId = innerTransaction['asset-id'];
        const asset = await this.assetMap.fetchAsset(assetId);
        const displayAmount = await this.assetMap.getDisplayValue(assetId, innerTransaction.amount);
        const blockInfo = await this.indexerApi.getBlockDetails(transaction['confirmed-round']);
        const data = {
            quantity: displayAmount,
            timestamp: new Date(blockInfo.timestamp * 1000), // blockInfo.timestamp stores value in seconds.
            currencyName: asset.name,
            id: transaction.id,
            note: transaction.note,
            action: innerTransaction.receiver === accountAddress ? "Buy" : "Sell"
        };
        if (transaction.sender === accountAddress) {
            const accountName = await this.knownAddresses.getNameByAddress(innerTransaction.receiver);
            console.log("You transferred %d %s to the %s account", displayAmount, asset.name, accountName);
        } else {
            const accountName = await this.knownAddresses.getNameByAddress(transaction.sender);
            console.log("You received %d %s from the %s account", displayAmount, asset.name, accountName); 
        }

        this.fileWriter.writeTransaction(data);
    }
}

export class TransactionStagingFileWriter {
    constructor(indexerApi, accountAddress) {
        this.assetMap = data.AssetMap;
        this.accountAddress = accountAddress;
        this.indexerApi = indexerApi;
        this.fileWriter = new RawTransactionImporter(`staging_transactions.csv`);
    }
    async importTransaction (transaction) {
        const transactionType = transaction['tx-type'];

        let innerTransaction = {};
        if (transactionType === 'appl') {
            // fake asset info for the purpose of having something in a row
            innerTransaction = {
                'asset-id': -1,
                'amount': 0,
                'receiver': ''
            };
        } else if (transactionType === 'pay') {
            innerTransaction = transaction['payment-transaction'];
        } else if (transactionType === 'axfer') {
            innerTransaction = transaction['asset-transfer-transaction'];
        }

        const assetId = innerTransaction['asset-id'] || 0; // if no asset is provided assume algorand.

        if (!assetId && transactionType === 'pay') {
            console.log("hi");
        }
        const blockInfo = await this.indexerApi.getBlockDetails(transaction['confirmed-round']);
        const data = {
            quantity: innerTransaction.amount,
            timestamp: new Date(blockInfo.timestamp * 1000), // blockInfo.timestamp stores value in seconds.
            asset: assetId,
            id: transaction.id,
            groupId: transaction.group,
            note: transaction.note,
            sender: transaction.sender,
            receiver: innerTransaction.receiver,
            type: transactionType
        };
        this.fileWriter.writeTransaction(data);
    }

    close() {
        this.fileWriter.close();
    }
}