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
    constructor(indexerApi, fileWriter) {
        this.indexerApi = indexerApi;
        this.fileWriter = fileWriter;
    }

    init() {
        //TODO: Load data from the database.
        this.assetMap = data.AssetMap;
    }

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
                this.fileWriter.skip(transaction, "Application")
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

    async handlePaymentTransaction(transaction, accountAddress) {
        const paymentTransaction = transaction['payment-transaction'];

        if (paymentTransaction.amount >= 2000) {
            if (transaction.note) {
                // if it has a note, skip it - I only use them for sending money between accounts/exchanges
                this.fileWriter.skip(transaction);
            } else {
                // report payments greater than the 0.02 algo min.
                paymentTransaction['asset-id'] = 0; // payments are in algo AFAIK
                await this.writeTaxableTransaction(transaction, paymentTransaction, accountAddress);
            }
        } else {
            //TODO: It'd be cool to cross-check this with known addresses like Yieldly/Tinyman contracts.
            this.fileWriter.skip(transaction, "Payment");
        }
    }

    /**
     * Process an asset transaction, this is crypto leaving/entering your wallet to another wallet.
     * @param {object} transaction The transaction object.
     * @param {String} accountAddress The account address to compare.
     */
    async writeTaxableTransaction(transaction, innerTransaction, accountAddress) {
        const assetId = innerTransaction['asset-id'];
        let asset = this.assetMap[assetId];

        if (!asset) {
            console.log("Unknown asset %d", assetId);
            const results = await this.indexerApi.getAssetInfo(assetId);
            // add to the asset map
            asset = results[0];
            this.assetMap[assetId] = asset;
        }
        const blockInfo = await this.indexerApi.getBlockDetails(transaction['confirmed-round']);
        const data = {
            quantity: innerTransaction.amount / Math.pow(10, asset.decimals),
            timestamp: new Date(blockInfo.timestamp * 1000), // blockInfo.timestamp stores value in seconds.
            currencyName: asset.name,
            id: transaction.id,
            note: transaction.note,
            action: innerTransaction.receiver === accountAddress ? "Buy" : "Sell"
        };
        this.fileWriter.writeTransaction(data);
    }
}

export class TransactionStagingFileWriter {

    constructor(indexerApi, accountAddress) {
        this.assetMap = data.AssetMap;
        this.accountAddress = accountAddress;
        this.indexerApi = indexerApi;
        this.filename = `staging_transactions.csv`;
        this.fileWriter = new RawTransactionImporter(this.filename);
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
        } else if (transactionType === 'appl') {
            innerTransaction = transaction['application-transaction']
        }

        const assetId = innerTransaction['asset-id'] || 0; // if no asset is provided assume algorand.
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
            applicationId: innerTransaction['application-id'],
            type: transactionType
        };
        this.fileWriter.writeTransaction(data);
    }

    close() {
        this.fileWriter.close();
    }
}