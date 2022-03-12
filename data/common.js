import crypto from "crypto";
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
    }
};

const KnownAddresses = {
    'FMBXOFAQCSAD4UWU4Q7IX5AV4FRV6AKURJQYGXLW3CTPTQ7XBX6MALMSPY': {
        name: 'Yieldly Escrow Account'
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
    '384303832': { name: 'Akita Inu', id: 384303832, decimals: 0 }
};

function uuidv4() {
    return crypto.randomUUID();
  }
  

export default {
    KnownApplications,
    ApplicationIdToNameMap,
    AssetMap,
    newGuid: uuidv4
};