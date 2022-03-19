import * as indexerApi from "../data/indexer.js";
import { createNewLogger } from "../logging.js";

const logger = createNewLogger("transaction-importer");

export class TransactionImporter{
    /**
     * Import a batch of transactions to the database.
     * @param {Database} database 
     * @param {indexerApi} indexerApi 
     */
    constructor(database, indexerApi) {
        this.database = database;
        this.indexerApi = indexerApi;
    }

    async save(transactions) {
        const data = await Promise.all(transactions.map(async transaction => {
            const innerTransaction = this._getInnerTransaction(transaction);
            const blockInfo = await this.indexerApi.getBlockDetails(transaction['confirmed-round']);
            return {
                type: transaction['tx-type'],
                appId: innerTransaction['application-id'] || '',
                asset: innerTransaction['asset-id'] || '',
                amount: innerTransaction.amount || '',
                timestamp: (blockInfo.timestamp * 1000), // blockInfo.timestamp stores value in seconds.
                id: transaction.id,
                group: transaction.group,
                note: transaction.note,
                fee: transaction.fee,
                receiver: innerTransaction.receiver || '',
                sender: transaction.sender
            };
        }));

        logger.info("Writing %d transactions to the db.", data.length);
        await this.database.save('transactions', data);
    }

    _getInnerTransaction(transaction) {
        switch (transaction['tx-type']) {
            case 'pay':
                return transaction['payment-transaction'];
            case 'axfer':
                return transaction['asset-transfer-transaction'];
            case 'appl':
                return transaction['application-transaction'];
            default:
                return "Unknown";
        }
    }
}

export async function importTransactions(database, accountAddress) {
    const account = await indexerApi.getAccountInformation(accountAddress);
    if (!account) {
        throw new Error("Unknown account.");
    }
    const options = {
        afterDate: "2021-01-01T00:00:00Z",
        beforeDate: "2022-01-01T00:00:00Z",
        size: 50,
        nextToken: null,
        address: accountAddress
    };

    let transactionData = await indexerApi.getTransactionList(options);
    options.nextToken = transactionData['next-token'];

    const importer = new TransactionImporter(database, indexerApi);

    // save all transactions
    while (options.nextToken) {
        const transactions = transactionData.transactions || [];
        await importer.save(transactions);  
        transactionData = await indexerApi.getTransactionList(options);
        options.nextToken = transactionData['next-token'];
    }

    const transactions = await database.getCursor('transactions');
    const resultCount = await transactions.count();
    logger.info("Retrieved %d transactions from the db.", resultCount);
}