import crypto from "crypto";
import * as indexer from "./indexer.js";
import mongodb from "mongodb";
import fs from "fs/promises";
const { MongoClient } = mongodb;
// Replace the uri string with your MongoDB deployment's connection string.
const uri = "mongodb://root:example@localhost:27017?retryWrites=true&writeConcern=majority";


class Database {
    constructor(name) {
        this.name = name;
        this.database;
    }

    async open() {
        this.client = new MongoClient(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        await this.client.connect();
        this.database = this.client.db(this.name);
    }

    async getCursor(collectionName) {
        const dbCollection = this.database.collection(collectionName);
        const cursor = await dbCollection.find();
        return cursor;
    }

    async getCollection (collectionName) {
        const cursor = await this.getCursor(collectionName);
        const resultCount = await cursor.count();
        if (resultCount === 0) {
            return [];
        }
        return await cursor.toArray();
    }

    async save (collectionName, documents) {
        if (!documents) {
            return null;
        }
        let result = null;
        if (Array.isArray(documents) && documents.length === 1) {
            result = await this.database.collection(collectionName).insertOne(documents[0]);
        } else {
            result = await this.database.collection(collectionName).insertMany(documents);
        }
        return result;
    }

    async insertIfNotExists(dbCollectionName, object) {
        const dbCollection = this.database.collection(dbCollectionName);
        if (!object._id) {
            const result = await dbCollection.findOne({ name: object.name });
            if (!result) {
                await dbCollection.insertOne(object);
            }
        }
    };

    async close() {
        this.isInitialized = false;
        await this.client.close();
    }
}

const applications = {
    async loadCache(database) {
        const data = await database.getCollection('applications');
        data.forEach(app => {
            this.cache[app.id] = app;
        });
    },
    cache: {},
    getApplication(appId) {
        let app = this.cache[appId];
        if (!app) {
            //const appInfo = await indexer.getApplicationInfo(appId);
            app ={ id: appId, name: 'Unknown App ' + appId, intent: "Unknown" };
            this.cache[appId] = app;
        }
        return app;
    }
};

const accounts = {
    async loadCache(database) {
        const accounts = await database.getCollection('accounts');
        accounts.forEach(account => {
            this.cache[account.address] = account;
        });
    },
    cache: {},
    getAccount(address) {
        let place = this.cache[address];
        if (!place) {
            this.cache[address] = { address: address, name: 'Unknown address ' + address, intent: "Unknown" };
            place = this.cache[address];
        }
        return place;
    }
}

const assets =   {
    async loadCache(database) {
        const assets = await database.getCollection('assets');
        assets.forEach(asset => {
            this.cache[asset.id] = asset;
        });
    },
    cache: {},
    /**
     * Find the asset in the map and cache it if it's not there.
     * @param {number} assetId The asset id.
     * @returns The asset.
     */
    async fetchAsset(assetId) {
        if (!this.cache[assetId] && assetId > 0) {
            const asset = await indexer.getAssetInfo(assetId);
            this.cache[assetId] = asset;
        }
        return this.cache[assetId];
    },
    /**
     * Converts the quantity into a user-friendly value with decimals.
     * @param {number} assetId The Asset id.
     * @param {number} quantity The amount of ASA you want to format.
     * @returns A formatted value to display to users.
     */
    async getDisplayValue(assetId, quantity) {
        const asset =  await this.fetchAsset(assetId);
        return quantity / Math.pow(10, asset.decimals);
    },
    /**
     * Get the name of the Asset.
     * @param {number} assetId The asset id.
     * @returns The asset's name.
     */
    async getNameById(assetId) {
        const asset =  await this.fetchAsset(assetId);
        return asset.name;
    }
};

function uuidv4() {
    return crypto.randomUUID();
}

async function loadDbSchema(db) {
    const databaseJson = await fs.readFile("database.json", { encoding: 'utf-8' });
    const schema = JSON.parse(databaseJson);
    try {
        const assets = await db.collection('assets');
        await assets.insertMany(schema.assets);

        const accounts = await db.collection('accounts');
        await accounts.insertMany(schema.accounts);

        const apps = await db.collection('applications');
        await apps.insertMany(schema.applications);
    } catch (e) {
        console.error(e);
        throw e;
    }
}

export default {
    accounts,
    assets,
    applications,
    Database,
    newGuid: uuidv4,
    loadDbSchema
};