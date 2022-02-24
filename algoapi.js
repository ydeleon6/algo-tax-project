import fetch from "node-fetch";

export const ALGO_INDEXER_URL = "https://algoindexer.algoexplorerapi.io";

const HttpVerb = Object.freeze({
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE'
});

export async function callAlgorandApi(url, method, customHeaders = null) {
    const requestInfo = {
        method: method,     // The type of HTTP request. The types are GET, POST, PUT, DELETE
        cache: 'no-cache', // we tell the server not to cache our request.
    };

    let finalHeaders = {
        'Content-Type': 'application/json' // we tell the server to send us text as JSON.
    }
    if (customHeaders) {
        // Copy our finalHeaders 'over' the customHeaders. We override content-type right now.
        finalHeaders = Object.assign(customHeaders, finalHeaders);
    }

    const response = await fetch(url, requestInfo);
    const result = await response.json();
    const isSuccessful = response.status === 200;
    
    if (!isSuccessful) {
        console.log(result);
        throw new Error(response.statusText);
    }

    return result;
}

export async function getAccountInformation(accountId) {
    const accountInfoUrl = ALGO_INDEXER_URL + "/v2/accounts/" + accountId;
    const accountJson = await callAlgorandApi(accountInfoUrl, HttpVerb.GET);
    return accountJson.account;
}

export async function getTransactionList(accountId, size) {
    // only tax shit grater than teh regular transaction cost.
    const transactionUrl = `${ALGO_INDEXER_URL}/v2/transactions?limit=${size}&address=${accountId}`;//&currency-greater-than=1000?limit=${size}`;
    const transactionJson = await callAlgorandApi(transactionUrl, HttpVerb.GET);
    return transactionJson.transactions;
}

async function getAssetInfo(asset) {
    const assetId = asset["asset-id"];
    const assetInfoUrl = `${ALGO_INDEXER_URL}/v2/assets/${assetId}`;
    const assetInfo = (await callAlgorandApi(assetInfoUrl, HttpVerb.GET)).asset;
    const assetName = assetInfo.params.name;
    const decimals = assetInfo.params.decimals; 
    const currentBalance = asset.amount / Math.pow(10, decimals);
    const fullAsset = {
        name: assetName,
        id: assetId,
        decimals: decimals,
        balance: currentBalance
    };
    return fullAsset;
}

export async function getFullAssetData(assets) {
    const assetPromises = assets.map(getAssetInfo);
    const fullAssetData = (await Promise.allSettled(assetPromises)).map(result => result.value);
    return fullAssetData;
}