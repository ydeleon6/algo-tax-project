import fetch from "node-fetch";

const HttpVerb = Object.freeze({
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE'
});

export async function callAlgorandApi(relativeUrl, method, customHeaders = null) {
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

    const fullUrl = "https://algoindexer.algoexplorerapi.io" + relativeUrl;
    const response = await fetch(fullUrl, requestInfo);
    const result = await response.json();
    const isSuccessful = response.status === 200;
    
    if (!isSuccessful) {
        console.log(result);
        throw new Error(response.statusText);
    }

    return result;
}

export async function getAccountInformation(accountId) {
    const accountInfoUrl = `/v2/accounts/${accountId}`;
    const accountJson = await callAlgorandApi(accountInfoUrl, HttpVerb.GET);
    return accountJson.account;
}

export async function getTransactionList(accountId, options) {
    let baseTransactionUrl = `/v2/transactions?address=${accountId}`;
    if (options.afterDate) {
        baseTransactionUrl += `&after-time=${options.afterDate}`
    }
    if (options.beforeDate) {
        baseTransactionUrl += `&before-time=${options.beforeDate}`
    }
    if (options.size) {
        baseTransactionUrl += `&limit=${options.size}`;
    }
    if (options.nextToken) {
        baseTransactionUrl += `&next=${options.nextToken}`;
    }
    const transactionJson = await callAlgorandApi(baseTransactionUrl, HttpVerb.GET);
    return transactionJson;
}

export async function getBlockDetails(roundNumber) {
    const transactionUrl = `/v2/blocks/${roundNumber}`;
    const blockJson = await callAlgorandApi(transactionUrl, HttpVerb.GET);
    return blockJson;
}

async function getAssetInfo(assetId) {
    const assetInfoUrl = `/v2/assets/${assetId}`;
    const assetInfo = (await callAlgorandApi(assetInfoUrl, HttpVerb.GET)).asset;
    const assetName = assetInfo.params.name;
    const decimals = assetInfo.params.decimals; 
    const fullAsset = {
        name: assetName,
        id: assetId,
        decimals: decimals,
    };
    return fullAsset;
}

export async function getFullAssetData(assetIds) {
    const assetPromises = assetIds.map(getAssetInfo);
    const fullAssetData = (await Promise.allSettled(assetPromises)).map(result => result.value);
    return fullAssetData;
}

export async function getApplicationInfo(applicationId) {
    const applicationSearchUrl = `/v2/applications?application-id=${applicationId}`;
    const response = await callAlgorandApi(applicationSearchUrl, HttpVerb.GET);
    return response;
}