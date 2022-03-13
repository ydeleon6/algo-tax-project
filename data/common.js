import crypto from "crypto";
import * as indexer from "../api/indexer.js";

// TODO: Load applications / asset data from a database or something.
// Do people stil use MongoDB? Could be useful.
const KnownApplications = {
    '233725850': {
        name: 'Yieldly Staking Contract',
    },
    '233725850': {
        name: 'Yieldly Staking Contract',
    },
    '233725844': {
        name: 'Yieldly NLL Contract',
    },
    '233725843': {
        name: 'Yieldly Opting Contract'
    },
    '233725848': {
        name: 'Yieldly Proxy Contract'
    },
    '348079765': {
        name: 'YLDLY x OPUL Staking Pools Contract'
    },
    '447336112': {
        name: 'YLDLY x CHOICE Staking Pools Contract'
    },
    '511597182': {
        name: 'YLDLY x AKITA Staking Pools Contract'
    },
    '593289960': {
        name: 'YLDY x TREES Staking Pools Contract'
    },
    async getNameById(appId) {
        let app = this[appId];
        if (!app && appId) {
            const appInfo = await indexer.getApplicationInfo(appId);
            //console.log(appInfo);
            this[appId] = { name: 'Unknown App ' + appId }
            app = this[appId];
        }
        return app.name;
    }
};

const KnownAddresses = {
    'FMBXOFAQCSAD4UWU4Q7IX5AV4FRV6AKURJQYGXLW3CTPTQ7XBX6MALMSPY': {
        name: 'Yieldly Escrow'
    },
    'W3RTY34WM3WNAPESJX3NCHX6KP32O6V2RI5WNB3RBKKZE3RQAXYTLNUWCI': {
        name: 'Tinyman ALGO x USDC Liqudity Pool'
    },
    async getNameByAddress(address) {
        const place = this[address];
        if (!place) {
            this[address] = 'Unknown address ' + address;
            return this[address];
        }
        return place.name;
    }
}

const AssetMap =   {
    '-1': { name: 'N/A', id: -1, decimals: 1 },
    '0': { name:'Algorand', id: 0, decimals: 6 },
    '31566704': { name: 'USDC', id: 31566704, decimals: 6 },
    '226701642': { name: 'Yieldly', id: 226701642, decimals: 6 },
    '287867876': { name: 'Opulous', id: 287867876, decimals: 10 },
    '297995609': { name: 'Choice Coin', id: 297995609, decimals: 2 },
    '444108880': { name: 'CryptoTrees', id: 444108880, decimals: 0 },
    '384303832': { name: 'Akita Inu', id: 384303832, decimals: 0 },
    /**
     * Find the asset in the map and cache it if it's not there.
     * @param {number} assetId The asset id.
     * @returns The asset.
     */
    async fetchAsset(assetId) {
        if (!this[assetId] && assetId > 0) {
            this[assetId] = await indexer.getAssetInfo(assetId);
        }
        return this[assetId];
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
  

export default {
    KnownApplications,
    KnownAddresses,
    AssetMap,
    newGuid: uuidv4
};