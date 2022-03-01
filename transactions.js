import * as indexerApi from "./api/indexer.js";
import data from "./data.js";


export class TransactionReport {
    constructor() {
        // Transactions we skip because they're like close-rewards
        // or opt-in transactions.
        this.skippedCount = 0;
        // The # of transactions where we received anything substantial.
        this.buyCount = 0;
        // The # of transactions where we sent > 0.02 algo worth of shit.
        this.salesCount = 0;
        // Small transactions we skip because they're like 99.9% sent to 
        // smart contracts like Yieldly/Tinyman. I noticed these aren't more than 0.02
        // algo so w/o more info I'm using this as a rule.
        this.paymentTransactions = 0;
        // Unknown transactions.
        this.unknownTransactions = 0;
        // Application call transactions to Yieldly/Tinyman, I'm pretty sure these
        // don't swap money
        this.appCalls = 0;
    }
}

class DataRow {
    constructor({id, currencyName, quantity, action, timestamp, note}){
        this.id = id;
        this.currencyName = currencyName;
        this.quantity = quantity;
        this.action = action;
        this.timestamp = timestamp;
        this.note = note;
    }

    static get headers(){
        const headers = ["ID","Currency Name","Quantity","Buy/Sale","Timestamp","Note"];
        return `${headers.join(',')}\n`;
    }

    toString() {
        const timeStr = `${this.timestamp.toLocaleDateString()} ${this.timestamp.toLocaleTimeString()}`;
        const row = [
            this.id,
            `${this.currencyName}`,
            this.quantity,
            this.action,
            timeStr,
            `${this.note || ''}`
        ]
        return `${row.join(',')}\n`;
    }
}

export class TransactionAnalyzer {
    /**
     * Create a new transaction analyzer that looks through your transactions
     * and makes notes of taxable events.
     * @param {indexerApi} indexerApi The indexer api.
     * @param {WritableStream} fileStream The file stream to write to.
     */
    constructor(indexerApi, fileStream) {
        this.indexerApi = indexerApi;
        this.fileStream = fileStream;
        this.report = new TransactionReport();
    }

    init() {
        //TODO: Load data from the database.
        this.assetMap = data.AssetMap;
        this.fileStream.write(DataRow.headers);
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
            this.report.skippedCount++;
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
                this.report.appCalls++;
                break;
            case 'axfer':
                const transferTransaction = transaction['asset-transfer-transaction']
                await this.handleAssetTransferTransaction(transaction, transferTransaction, accountAddress);
                break;
            case 'pay':
                await this.handlePaymentTransaction(transaction, accountAddress);
                break;
            default:
                this.report.unknownTransactions++;
                console.log("Unknown transaction type of %d", transactionType);
                break;
        }
    }

    async handlePaymentTransaction(transaction, accountAddress) {
        const paymentTransaction = transaction['payment-transaction'];

        if (paymentTransaction.amount > 2000) {
            if (transaction.note) {
                // if it has a note, skip it - I only use them for sending money between accounts/exchanges
                this.report.skippedCount++;
            } else {
                // report payments greater than the 0.02 algo min.
                paymentTransaction['asset-id'] = 0; // payments are in algo AFAIK
                await this.handleAssetTransferTransaction(transaction, paymentTransaction, accountAddress);
            }
        } else {
            //TODO: It'd be cool to cross-check this with known addresses like Yieldly/Tinyman contracts.
            this.report.paymentTransactions++;
        }
    }

    /**
     * Process an asset transaction, this is crypto leaving/entering your wallet to another wallet.
     * @param {object} transaction The transaction object.
     * @param {String} accountAddress The account address to compare.
     */
    async handleAssetTransferTransaction(transaction, innerTransaction, accountAddress) {
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

        if (data.action === "Buy") {
            this.report.buyCount++;
        } else {
            this.report.salesCount++;
        }
        // write the transaction to the file..
        const dataRow = new DataRow(data);
        this.fileStream.write(dataRow.toString());
    }
}