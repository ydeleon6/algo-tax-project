import fs from "fs";
import path from "path";
import * as algoApi from "./algoapi.js";
import { TransactionAnalyzer } from "./transactions.js";


(async function main(args) {
    const accountAddress =  args[2];
    const account = await algoApi.getAccountInformation(accountAddress);
    if (!account) {
        throw new Error("Unknown account.");
    }
    if (fs.existsSync("./results.csv")) {
        fs.unlinkSync("./results.csv");
    }
    const resultFilePath = path.join(path.dirname("./index.js"), "results.csv");
    const fileStream = fs.createWriteStream(resultFilePath, "utf8");
    fileStream.on("drain", () => {
        console.log("Flushing data.");
    });
    fileStream.write('Currency Name,Quantity,Buy/Sale,Timestamp\n');
    const transactionAnalyzer = new TransactionAnalyzer(algoApi, fileStream);
    transactionAnalyzer.init();

    // AlgoExplorer api is surprisingly fast, limit to 10 requests / sec.
    const options = {
        afterDate: "2021-01-01T00:00:00Z",
        beforeDate: "2022-01-01T00:00:00Z",
        size: 100,
        nextToken: null
    };

    let currentPage = 0;
    let transactionData = await algoApi.getTransactionList(accountAddress, options);
    options.nextToken = transactionData['next-token'];

    while (options.nextToken != null && currentPage < pageLimit) {
        transactionData.transactions.forEach(async (transaction) => {
            await transactionAnalyzer.analyzeTransaction(transaction, accountAddress)
        });
        
        transactionData = await algoApi.getTransactionList(accountAddress, options);
        options.nextToken = transactionData['next-token'];

        if (options.nextToken) {
            console.log("Got a new page of %d results w/ another token at %s",
            transactionData.transactions.length,
            options.nextToken);
        }
        currentPage++;
    }
    fileStream.close();
})(process.argv);