import * as indexerApi from "./api/indexer.js";
import { TransactionAnalyzer, TransactionStagingFileWriter } from "./transactions.js";
import { TransactionFileWriter } from "./data/file-writer.js";
import { TransactionDataAccess } from "./data/database.js";


const createTransactionsStagingFile = async (accountAddress) => {
    const options = {
        afterDate: "2021-01-01T00:00:00Z",
        beforeDate: "2021-12-31T23:59:59Z",
        limit: 100,
        nextToken: null,
        address: accountAddress
    };

    let transactionData = await indexerApi.getTransactionList(options);
    options.nextToken = transactionData['next-token'];

    const transactionsCsvWriter = new TransactionStagingFileWriter(indexerApi, accountAddress);
    // write all transactions to a .csv so we can cross-check them later.
    while (options.nextToken != null) {
        const transactions = transactionData.transactions || [];

        transactions.forEach(async (transaction) => {
            await transactionsCsvWriter.importTransaction(transaction);
         });
        
        transactionData = await indexerApi.getTransactionList(options);
        options.nextToken = transactionData['next-token'];

        if (options.nextToken) {
            console.log("Got a new page of %d results w/ another token %s",
            transactionData.transactions.length,
            options.nextToken);
        }
    }

    transactionsCsvWriter.close();
};

(async function main(args) {
    const accountAddress =  args[2];
    const account = await indexerApi.getAccountInformation(accountAddress);
    if (!account) {
        throw new Error("Unknown account.");
    }

    // Create staging file.
    //await createTransactionsStagingFile(accountAddress);

    let transactionsDb = new TransactionDataAccess();
    let result = await transactionsDb.dropSchema();
    console.log(result);
    result = await transactionsDb.initializeSchema();
    console.log(result);

    //fileWriter.close();
    //fileWriter.writeReport();
})(process.argv);