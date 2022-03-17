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
    await transactionAnalyzer.init();

    // save all transactions
    while (options.nextToken) {
        const transactions = transactionData.transactions || [];
        await transactionAnalyzer.save(transactions);    
        transactionData = await indexerApi.getTransactionList(options);
        options.nextToken = transactionData['next-token'];
    }

    const transactions = await transactionAnalyzer.database.getCursor('transactions');
    const resultCount = await transactions.count();
    logger.info("Retrieved %d transactions from the db.", resultCount);

    transactionAnalyzer.close();
    transactionFileWriter.writeReport();
})(process.argv);