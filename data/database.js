import sqlite3 from "sqlite3";
import path from "path";


class Database {
    constructor(databasePath) {
        this.currentDirPath = path.dirname("./database.js");
        this.databasePath = path.resolve(this.currentDirPath, databasePath);
        this.db = null;
        this.isConnected = false;
    }

    /**
     * Connect to the database.
     * @returns {Promise<sqlite3.Database>} A database object.
     */
    async getConnection() {
        const self = this;

        if (this.isConnected) {
            return Promise.resolve(self.db);
        }

        let connectionPromise = new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(self.databasePath, sqlite3.OPEN_READWRITE, function(err) {
                if (err) {
                    reject(err);
                } else {
                    self.isConnected = true;
                    resolve(true);
                }
            });
        });
        await connectionPromise;
        return this.db;
    }

    close() {
        this.db.close(err => {
            if (err) {
                throw new Error(err.message);
            }
        })
    }
}

export class TransactionDataAccess {
    constructor(){
        this.database = new Database("transactions.db");
    }

    async dropSchema() {
        const connection = await this.database.getConnection();
        const dropTableSql = `DROP TABLE IF EXISTS "transactions"`;
        return new Promise((resolve, reject) => {
            connection.run(dropTableSql, function(result, err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    async initializeSchema() {
        const connection = await this.database.getConnection();

        const createTransactionSchemaSql = `
        CREATE TABLE IF NOT EXISTS "transactions" (
            "ID" INTEGER NOT NULL PRIMARY KEY,
            "Timestamp" TEXT,
            "Txn ID" TEXT,
            "Group ID" TEXT,
            "Type" TEXT,
            "Sender" TEXT,
            "Receiver" TEXT,
            "Asset" TEXT,
            "Quantity" TEXT,
            "Note" TEXT
        );`;
        return new Promise((resolve, reject) => {
            connection.run(createTransactionSchemaSql, function(runResult, err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(runResult);
                }
            });
        })
    }

    async importTransactions(transactions) {
        const connection = await this.database.getConnection();
        // TODO: Run prepared statement SQL for importing a single (or batch of?) transactions.
    }
}
