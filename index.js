import * as algoApi from "./algo_api/algoapi.js";


const KnownApplicationIds = {
    '233725850': 'Yieldly'
};


(async function main() {
    const yahirsWalletAddress = "<insert wallet address>";
    const account = await algoApi.getAccountInformation(yahirsWalletAddress);

    // the account object will have an "assets" key that describes all of my opted-in assets.
    // let's print it out.
    const assets = await algoApi.getFullAssetData(account.assets || []);
    const assetMap = assets.map(asset => {
        const assetId = asset.id;
        return {
            [assetId]: asset
        }
    });

    const transactionData = await algoApi.getTransactionList(yahirsWalletAddress, 10);

    function analyzeTransaction(transaction) {
        const transactionType = transaction['tx-type'];
        switch (transactionType) {
            case 'appl':
                handleApplicationTransaction(transaction);
                break;
            case 'axfer':
                handleAssetTransferTransaction(transaction);
                break;
            case 'pay':
                console.log("Handling a payment txn.");
                break;
            default:
                console.log("Unknown transaction type of %d", transactionType);
                break;
        }
    }

    function handleAssetTransferTransaction(transaction) {
        if (transaction.sender == yahirsWalletAddress) {
            console.log("You are selling something.");
        } else {
            console.log("You are receiving something.");
        }
    }

    function handleApplicationTransaction(transaction) {
        const innerTransaction = transaction['application-transaction'];
        const applicationId = innerTransaction['application-id']
        let appName = KnownApplicationIds[applicationId];
        if (!appName) {
            // TODO: Get this from the algorand API.
            console.log("Appname is unknown");
        } else {
            console.log("Handling a Yieldly transaction.");
        }
    }

    transactionData.forEach(analyzeTransaction);
})();