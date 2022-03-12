import fetch from "node-fetch";
import { HttpVerb } from "./common.js";

const baseUrl = new URL("https://algoindexer.algoexplorerapi.io");

async function callAlgorandIndexerApi(relativeUrl, method, customHeaders = null) {
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
    const fullUrl = new URL(relativeUrl, baseUrl);
    const response = await fetch(fullUrl, requestInfo);
    const result = await response.json();
    const isSuccessful = response.status === 200;
    
    if (!isSuccessful) {
        console.log(result);
        throw new Error(response.statusText);
    }

    return result;
}

/**
 * Get information about the Algorand account.
 * @param {String} accountAddress The Algorand account public address.
 * @returns The account information.
 */
export async function getAccountInformation(accountAddress) {
    const accountInfoUrl = `/v2/accounts/${accountAddress}`;
    const accountJson = await callAlgorandIndexerApi(accountInfoUrl, HttpVerb.GET);
    return accountJson.account;
}

/**
 * Search for Algorand transactions for the given options.
 * @param {object} options Additional options to pass to the transaction search API.
 * @returns A list of transactions.
 */
export async function getTransactionList(options) {
    let baseTransactionUrl = `/v2/transactions`;

    if (options.address) {
        baseTransactionUrl += `?address=${options.address}`;
    }
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
    const transactionJson = await callAlgorandIndexerApi(baseTransactionUrl, HttpVerb.GET);
    return transactionJson;
}

/**
 * Search for a transaction block for the given round number.
 * @param {Number} roundNumber The block's round number.
 * @returns Block details
 */
export async function getBlockDetails(roundNumber) {
    const transactionUrl = `/v2/blocks/${roundNumber}`;
    const blockJson = await callAlgorandIndexerApi(transactionUrl, HttpVerb.GET);
    return blockJson;
}

/**
 * Get the full information for a given asset ID.
 * @param {Number} assetId The Asset's id.
 * @returns An object with additional asset information.
 */
export async function getAssetInfo(assetId) {
    const assetInfoUrl = `/v2/assets/${assetId}`;
    const assetInfo = (await callAlgorandIndexerApi(assetInfoUrl, HttpVerb.GET)).asset;
    const assetName = assetInfo.params.name;
    const decimals = assetInfo.params.decimals; 
    const fullAsset = {
        name: assetName,
        id: assetId,
        decimals: decimals,
    };
    return fullAsset;
}

/**
 * Get additional information for a given application id.
 * @param {Number} applicationId The application id.
 * @returns A JSON response of the application information.
 */
export async function getApplicationInfo(applicationId) {
    const applicationSearchUrl = `/v2/applications?application-id=${applicationId}`;
    const response = await callAlgorandIndexerApi(applicationSearchUrl, HttpVerb.GET);
    return response;
}