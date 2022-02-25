import * as algoApi from "./algoapi.js";


export class TransactionAnalyzer {
    /**
     * Create a new transaction analyzer.
     * @param {algoApi} algoApi The algo api
     * @param {object} assetMap A map of asset ids and their data.
     */
    constructor(algoApi, assetMap) {
        this.algoApi = algoApi;
        this.assetMap = assetMap;
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
                await this.handleApplicationTransaction(transaction);
                break;
            case 'axfer':
                const transferTransaction = transaction['asset-transfer-transaction']
                await this.handleAssetTransferTransaction(transaction, transferTransaction, accountAddress);
                break;
            case 'pay':
                const paymentTransaction = transaction['payment-transaction'];
                paymentTransaction['asset-id'] = 0; // 0 is Algo.
                if (paymentTransaction.amount > 0) {
                    await this.handleAssetTransferTransaction(transaction, paymentTransaction,  accountAddress);
                }
                break;
            default:
                console.log("Unknown transaction type of %d", transactionType);
                break;
        }
    }

    getAppType(txnType) {
        switch(txnType) {
            case 'appl':
                return 'ApplicationCall';
            case 'axfer':
                return 'AssetTransfer';
            case 'pay':
                return 'PaymentTransaction';
        }
        return 'Unknown'
    }

    async handlePaymentTransaction(transaction) {
        console.log(JSON.stringify(transaction, null, 3))
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
            console.log(`User opted in to ${asset.name}.`);
            return;
        }
        const quantity = `${realQuantity} ${asset.name}`;
        const blockInfo = await this.algoApi.getBlockDetails(transaction['confirmed-round'])
        const date = new Date((blockInfo.timestamp * 1000)); // timestamp stores value in seconds.
        const timestamp = date.toLocaleDateString() + " " + date.toLocaleTimeString();

        if (innerTransaction.receiver === accountAddress) {
            console.log(`You are receiving ${quantity} from ${transaction.sender} on ${timestamp}.`);
        } else {
            console.log(`You are sending ${quantity} to ${innerTransaction.receiver} on ${timestamp}.`);
        }
    }

    /**
     * Process an application transaction. These can come from smart contracts like Yieldly staking pools, de-fi stuff, etc.
     * @param {object} transaction The transaction object.
     */
     async handleApplicationTransaction(transaction, innerTransaction, accountAddress) {
        const applicationId = transaction['application-id'];
        //console.debug(`App Call to ${applicationId}`);
    }
}