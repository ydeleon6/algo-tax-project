import * as indexerApi from "./api/indexer.js";
import { TransactionAnalyzer, TransactionStagingFileWriter } from "./transactions.js";
import { TransactionFileWriter } from "./data/file-writer.js";
import { TransactionsDb } from "./data/database.js";


(async function main(args) {
    const accountAddress =  args[2];
    const account = await indexerApi.getAccountInformation(accountAddress);
    if (!account) {
        throw new Error("Unknown account.");
    }
    const transactionsCsvWriter = new TransactionStagingFileWriter(indexerApi);
    const options = {
        afterDate: "2021-01-01T00:00:00Z",
        beforeDate: "2021-12-31T23:59:59Z",
        size: 100,
        nextToken: null,
        address: accountAddress
    };

    let currentPage = 0;
    let transactionData = await indexerApi.getTransactionList(options);
    options.nextToken = transactionData['next-token'];

    while (options.nextToken != null) {
        const transactions = transactionData.transactions || [];

        transactions.forEach(async (transaction) => {
            // write all transactions to a .csv so we can cross-check them later.
            await transactionsCsvWriter.importTransaction(transaction);
            //await transactionAnalyzer.analyzeTransaction(transaction, accountAddress);
         });
        
        transactionData = await indexerApi.getTransactionList(options);
        options.nextToken = transactionData['next-token'];

        if (options.nextToken) {
            console.log("Got a new page of %d results w/ another token %s",
            transactionData.transactions.length,
            options.nextToken);
        }
        currentPage++;
    }

    transactionsCsvWriter.close();
    //fileWriter.close();
    //fileWriter.writeReport();
})(process.argv);