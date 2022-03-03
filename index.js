import * as indexerApi from "./api/indexer.js";
import { TransactionAnalyzer } from "./transactions.js";
import { TransactionFileWriter } from "./data/file-writer.js";


(async function main(args) {
    const accountAddress =  args[2];
    const account = await indexerApi.getAccountInformation(accountAddress);
    if (!account) {
        throw new Error("Unknown account.");
    }
    const options = {
        afterDate: "2021-01-01T00:00:00Z",
        beforeDate: "2021-12-31T23:59:59Z",
        size: 100,
        nextToken: null,
        address: accountAddress
    };

    let transactionData = await indexerApi.getTransactionList(options);
    options.nextToken = transactionData['next-token'];

    const transactionFileWriter = new TransactionFileWriter("2021_taxable_events.csv");
    const transactionAnalyzer = new TransactionAnalyzer(indexerApi, transactionFileWriter);
    transactionAnalyzer.init();

    while (options.nextToken != null) {
        const transactions = transactionData.transactions || [];

        transactions.forEach(async (transaction) => {
            await transactionAnalyzer.analyzeTransaction(transaction, accountAddress);
         });
        
        transactionData = await indexerApi.getTransactionList(options);
        options.nextToken = transactionData['next-token'];

        if (options.nextToken) {
            console.log("Got a new page of %d results w/ another token %s",
            transactionData.transactions.length,
            options.nextToken);
        }
    }

    transactionFileWriter.close();
    transactionFileWriter.writeReport();
})(process.argv);