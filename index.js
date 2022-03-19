import { analyzeTransactions } from "./analyzer/transaction-analyzer.js";
import { importTransactions } from "./analyzer/transaction-importer.js";
import data from "./data/common.js";

(async function main(args) {
    const accountAddress = args[2].trim();
    const database = new data.Database('algorand');
    await database.open();

    await data.applications.loadCache(database);
    await data.accounts.loadCache(database);
    await data.assets.loadCache(database);

    // 1) import all transactions to a database.
    //await importTransactions(database, accountAddress);

    // 2) analyze them
    await analyzeTransactions(database, accountAddress);

    await database.close();
})(process.argv); 