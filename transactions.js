import * as algoApi from "./algoapi.js";
import data from "./data.js";


export class TransactionAnalyzer {
    /**
     * Create a new transaction analyzer that looks through your transactions
     * and makes notes of taxable events.
     * @param {algoApi} algoApi The algo api
     * @param {WritableStream} assetMap The file stream to write to.
     */
    constructor(algoApi, fileStream) {
        this.algoApi = algoApi;
        this.fileStream = fileStream;
    }

    init() {
        this.assetMap = data.AssetMap;
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
                //await this.handleApplicationTransaction(transaction);
                break;
            case 'axfer':
                const transferTransaction = transaction['asset-transfer-transaction']
                await this.handleAssetTransferTransaction(transaction, transferTransaction, accountAddress);
                break;
            case 'pay':
                const paymentTransaction = transaction['payment-transaction'];
                paymentTransaction['asset-id'] = 0; // 0 is Algo.
                if (paymentTransaction.amount > 2000) { // 0.02 algo is the most i've spent on an app call to Yieldly/Tinyman.
                    await this.handleAssetTransferTransaction(transaction, paymentTransaction,  accountAddress);
                }
                break;
            default:
                console.log("Unknown transaction type of %d", transactionType);
                break;
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
            const results = await this.algoApi.getFullAssetData([assetId]);
            // add to the asset map
            asset = results[0];
            this.assetMap[assetId] = asset;
        }

        const realQuantity = innerTransaction.amount / Math.pow(10, asset.decimals);
        
        if ((innerTransaction.receiver === transaction.sender) && realQuantity === 0) {
            console.log(`User opted in to ${asset.name}. Skipping`);
            return;
        }
        const blockInfo = await this.algoApi.getBlockDetails(transaction['confirmed-round']);
        const date = new Date((blockInfo.timestamp * 1000)); // timestamp stores value in seconds.
        const timestamp = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        const action = innerTransaction.receiver === accountAddress ? "Buy" : "Sale";
        const dataRow = `${realQuantity},'${asset.name}',${action},${timestamp}\n`;
        this.fileStream.write(dataRow);
    }
}