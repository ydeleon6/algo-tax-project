import sqlite3 from "sqlite3";
import path from "path";


class Database {
    constructor(databasePath) {
        this.currentDirPath = path.dirname("./database.js");
        this.databasePath = path.resolve(this.currentDirPath, databasePath);
        this.db = null;
    }

    connect() {
        this.db = new sqlite3.Database(this.databasePath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                throw new Error(err.message);
            }
            console.debug("Connected to the SQLite3 database.");
        });
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

export class TransactionsDb extends Database {
    constructor(){
        super("../transactions.db");
    }

}
