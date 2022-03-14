import * as indexerApi from "./api/indexer.js";
import { TransactionAnalyzer } from "./transactions.js";
import { TransactionFileWriter } from "./data/file-writer.js";
import { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, printf, splat } = format;


(async function main(args) {
    const accountAddress =  args[2];
    const account = await indexerApi.getAccountInformation(accountAddress);
    if (!account) {
        throw new Error("Unknown account.");
    }
    const myFormat = printf(({ level, message, label, timestamp }) => {
        return `${timestamp} [${label}] ${level}: ${message}`;
    });    
    const logger = createLogger({
        format: combine(
            label({ label: 'TransactionAnalyzer'}),
            timestamp({ format: 'MM/DD/YYYY hh:mm:ss'}),
            splat(),
            myFormat
        ),
        transports: [new transports.File({ filename: 'combined.log' }), new transports.Console()]
    });
    const options = {
        afterDate: "2021-01-01T00:00:00Z",
        beforeDate: "2022-01-01T00:00:00Z",
        size: 100,
        nextToken: null,
        address: accountAddress
    };

    let transactionData = await indexerApi.getTransactionList(options);
    options.nextToken = transactionData['next-token'];

    const transactionFileWriter = new TransactionFileWriter("2021_taxable_events.csv");
    const transactionAnalyzer = new TransactionAnalyzer(indexerApi, transactionFileWriter, logger);
    transactionAnalyzer.init();

    while (options.nextToken) {
        const transactions = transactionData.transactions || [];

        for (const transaction of transactions) {
            await transactionAnalyzer.analyzeTransaction(transaction, accountAddress);
        }
    
        transactionData = await indexerApi.getTransactionList(options);
        options.nextToken = transactionData['next-token'];
    }

    transactionFileWriter.close();
    transactionFileWriter.writeReport();
})(process.argv);