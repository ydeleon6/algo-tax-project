import * as algoApi from "./algoapi.js";
import { TransactionAnalyzer } from "./transactions.js";
import data from "./data.js";


(async function main(args) {
    const accountAddress =  args[2];
    const account = await algoApi.getAccountInformation(accountAddress);
    if (!account) {
        throw new Error("Unknown account.");
    }
    const transactionAnalyzer = new TransactionAnalyzer(algoApi, data.AssetMap);
    // AlgoExplorer api is surprisingly fast, limit to 10 requests / sec.
    const options = {
        afterDate: "2021-01-01T00:00:00Z",
        beforeDate: "2022-01-01T00:00:00Z",
        size: 100,
    };

    let transactionData = await algoApi.getTransactionList(accountAddress, options);
    let nextToken = transactionData['next-token'];

    //TODO: Write output to a file / csv output then upload into DB
    //TODO: Write a loop that gets new data w/ the new token
    //TODO: File a bug w/ AlgoExplorer, the Indexer doesn't seem to respect `limit` with both after/before dates work.

    transactionData.transactions.forEach(async (transaction) => {
        await transactionAnalyzer.analyzeTransaction(transaction, accountAddress)
    });
    
    console.log("Retreiving a new page of results w/ %s.", nextToken);
    options.nextToken = nextToken;
    transactionData = await algoApi.getTransactionList(accountAddress, options);
    console.log("Got a new page of %d results w/ another token at %s",
        transactionData.transactions.length,
        transactionData['next-token']);
})(process.argv);