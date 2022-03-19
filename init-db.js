import data from "./data/common.js";

(async function run(args) {
    const connection = new data.Database('algorand');
    await connection.open();
    await data.loadDbSchema(connection.database);
    await connection.close();
})(process.argv);