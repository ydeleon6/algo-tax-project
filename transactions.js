import winston from "winston";
import * as indexerApi from "./api/indexer.js";
import data from "./data/common.js";
import { TransactionFileWriter } from "./data/file-writer.js";


export class TransactionAnalyzer {
    /**
     * Create a new transaction analyzer that looks through your transactions
     * and makes notes of taxable events.
     * @param {indexerApi} indexerApi The indexer api.
     * @param {TransactionFileWriter} fileWriter The transaction file writer
     * @param {winston.Logger} logger The logger.
     */
    constructor(indexerApi, fileWriter, logger) {
        this.indexerApi = indexerApi;
        this.fileWriter = fileWriter;
        this.logger = logger;
    }

    async init() {
        await data.loadDbSchema();
        const database = new data.Database('algorand');
        await database.open();
        await data.applications.loadCache(database);
        await data.accounts.loadCache(database);
        await data.assets.loadCache(database);
        this.assetMap = data.assets;
        this.knownApplications = data.applications;
        this.knownAddresses = data.accounts;
        this.database = database;
    }

    /**
     * Analyze the transaction and perform an action based on it's type.
     * @param {transaction} transaction The transaction object.
     * @param {String} accountAddress The account address to compare.
     */
    async analyzeTransaction(transaction, accountAddress) {
        const transactionType = transaction['tx-type'];

        switch (transactionType) {
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
                this.logger.error("Cannot handle transaction type of %s", transactionType);
                break;
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
        const appTransaction = this._getInnerTransaction(transaction);
        const appId = appTransaction['application-id'];
        const fee = await this.assetMap.getDisplayValue(0, transaction.fee);
        const appName = await this.knownApplications.getNameById(appId);

        if (transaction.sender === accountAddress) {
            this.logger.info("You called the '%s' application with a %d Algo fee.", appName, fee);
        } else {
            this.logger.info("The '%s' application called you.", appName);
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
        const paymentTransaction = this._getInnerTransaction(transaction);
        const paymentAmount = paymentTransaction.amount;

        if (paymentAmount) {
            // Log who we sent/received a payment from.
            const displayAmount = await this.assetMap.getDisplayValue(0, paymentAmount);

            if (transaction.sender === accountAddress) {
                const receiverName = await this.knownAddresses.getNameByAddress(paymentTransaction.receiver);
                this.logger.info("You paid %d Algos to the '%s' account.", displayAmount, receiverName);
            } else if (paymentTransaction.receiver === accountAddress) {
                const senderName = await this.knownAddresses.getNameByAddress(transaction.sender);
                this.logger.info("You were paid %d Algos from the '%s' account.", displayAmount, senderName);
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
        const innerTransaction = this._getInnerTransaction(transaction);
        const assetId = innerTransaction['asset-id'];
        const asset = await this.assetMap.fetchAsset(assetId);
        const displayAmount = await this.assetMap.getDisplayValue(assetId, innerTransaction.amount);

        if (transaction.sender === innerTransaction.receiver && displayAmount === 0) {
            this.logger.info("User opted-into the '%s' ASA.", asset.name);
        } else if (transaction.sender === accountAddress) {
            const accountName = await this.knownAddresses.getNameByAddress(innerTransaction.receiver);
            this.logger.info("You transferred %d %s to the '%s' account", displayAmount, asset.name, accountName);
        } else {
            const accountName = await this.knownAddresses.getNameByAddress(transaction.sender);
            this.logger.info("You received %d %s from the '%s' account", displayAmount, asset.name, accountName); 
        }
    }

    async close() {
        await this.database.close();
        this.fileWriter.close();
    }

    async save(transactions, tag) {
        const data = await Promise.all(transactions.map(async transaction => {
            const innerTransaction = this._getInnerTransaction(transaction);
            const blockInfo = await this.indexerApi.getBlockDetails(transaction['confirmed-round']);
            return {
                type: transaction['tx-type'],
                appId: innerTransaction['application-id'] || '',
                asset: innerTransaction['asset-id'] || '',
                quantity: innerTransaction.amount || '',
                timestamp: new Date(blockInfo.timestamp * 1000), // blockInfo.timestamp stores value in seconds.
                id: transaction.id,
                group: transaction.group,
                note: transaction.note,
                fee: transaction.fee,
                receiver: innerTransaction.receiver || '',
                sender: transaction.sender,
                tag: tag
            };
        }));

        this.logger.info("Writing %d transactions to the db.", data.length);
        await this.database.save('transactions', data);
    }

    _getInnerTransaction(transaction) {
        switch (transaction['tx-type']) {
            case 'pay':
                return transaction['payment-transaction'];
            case 'axfer':
                return transaction['asset-transfer-transaction'];
            case 'appl':
                return transaction['application-transaction'];
            default:
                return "Unknown";
        }
    }

}

