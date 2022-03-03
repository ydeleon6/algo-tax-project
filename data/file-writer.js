import fs from "fs";
import path from "path";

export class TransactionFileReport {
    constructor() {
        // Transactions we skip because they're like close-rewards
        // or opt-in transactions.
        this.skippedCount = 0;
        // The # of transactions where we received anything substantial.
        this.buyCount = 0;
        // The # of transactions where we sent > 0.02 algo worth of shit.
        this.salesCount = 0;
        // Small transactions we skip because they're like 99.9% sent to 
        // smart contracts like Yieldly/Tinyman. I noticed these aren't more than 0.02
        // algo so w/o more info I'm using this as a rule.
        this.paymentTransactions = 0;
        // Unknown transactions.
        this.unknownTransactions = 0;
        // Application call transactions to Yieldly/Tinyman, I'm pretty sure these
        // don't swap money
        this.appCalls = 0;
    }
}


class CsvWriter {
    constructor(fileName) {
        this.rootDir = path.dirname("./file-writer.js");
        const fullFileName = path.join(this.rootDir, fileName);
        if (fs.existsSync(fullFileName)) {
            fs.unlinkSync(fullFileName);
        }
        this.resultFilePath = fullFileName;
        this.fileStream = fs.createWriteStream(this.resultFilePath, "utf-8");
    }

    writeCsvRow(data){
        this.fileStream.write(`${data.join(',')}\n`);
    }

    writeTransaction(){}

    close() {
        this.fileStream.close();
    }
}

export class TransactionFileWriter extends CsvWriter {
    constructor(fileName) {
        super(fileName);
        this.fileStream.write(`ID,Currency Name,Quantity,Buy/Sale,Timestamp,Note\n`);
        this.report = new TransactionFileReport();
    }

    writeTransaction(data) {
        if (data.action === "Buy") {
            this.report.buyCount++;
        } else if (data.action === "Sell") {
            this.report.salesCount++;
        }
        const timeStr = `${data.timestamp.toLocaleDateString()} ${data.timestamp.toLocaleTimeString()}`;
        const row = [
            data.id,
            `${data.currencyName}`,
            data.quantity,
            data.action,
            timeStr,
            `${data.note || ''}`
        ]
        this.writeCsvRow(row);
    }

    skip(transaction, reason){
        // TODO: Write skipped transaction to a separate result file?
        if (reason === "Payment") {
            this.report.paymentTransactions++;
        } else if (reason === "Application") {
            this.report.appCalls++;
        } else {
            this.report.skippedCount++;
        }
    }
    
    writeReport() {
        const report = JSON.stringify(this.report, null, 4);
        const reportFilePath = path.join(this.rootDir, "report.json");
        const reportStream = fs.createWriteStream(reportFilePath, "utf-8");
        reportStream.write(report);
        reportStream.close();
    }
}

export class RawTransactionImporter extends CsvWriter {
    constructor(fileName) {
        super(fileName);
        this.fileStream.write("Timestamp,Txn ID,Group ID,Type,Sender,Receiver,Asset,Quantity,Note,Application ID\n");
    }

    writeTransaction(data) {
        const timeStr = `${data.timestamp.toLocaleDateString()} ${data.timestamp.toLocaleTimeString()}`;
        const row = [
            timeStr,
            data.id,
            `${data.groupId || ''}`,
            data.type,
            data.sender,
            data.receiver,
            `${data.asset < 0 ? '' : data.asset}`,
            data.quantity,
            `${data.note || ''},`,
            `${data.applicationId || ''}`
        ];
        this.writeCsvRow(row);
    }
    
    close() {
        this.fileStream.close();
    }
}