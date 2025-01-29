const { ethers } = require('ethers');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// チェーン設定
const CHAINS = {
    ethereum: {
        name: 'Ethereum',
        rpc: 'https://eth-mainnet.g.alchemy.com/v2/GcaMdML_ABouJgG7Sa2X8Xu5iRH5UTUF'
    },
    polygon: {
        name: 'Polygon',
        rpc: 'https://polygon-mainnet.g.alchemy.com/v2/GcaMdML_ABouJgG7Sa2X8Xu5iRH5UTUF'
    },
    arbitrum: {
        name: 'Arbitrum',
        rpc: 'https://arb-mainnet.g.alchemy.com/v2/GcaMdML_ABouJgG7Sa2X8Xu5iRH5UTUF'
    },
    bsc: {
        name: 'Binance Smart Chain',
        rpc: 'https://bsc-dataseed1.binance.org'
    },
    avalanche: {
        name: 'Avalanche C-Chain',
        rpc: 'https://api.avax.network/ext/bc/C/rpc'
    },
    base: {
        name: 'Base Chain',
        rpc: 'https://mainnet.base.org'
    },
    optimism: {
        name: 'OP Mainnet',
        rpc: 'https://mainnet.optimism.io'
    }
};

// データベース初期化
function initializeDatabase() {
    const db = new sqlite3.Database('wallets.db');
    
    db.serialize(() => {
        // ニーモニックフレーズを管理するテーブル
        db.run(`CREATE TABLE IF NOT EXISTS mnemonics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mnemonic TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // ウォレット情報を管理するテーブル
        db.run(`CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mnemonic_id INTEGER,
            private_key TEXT,
            wallet_address TEXT,
            derivation_path TEXT,
            ethereum_tx BOOLEAN DEFAULT 0,
            polygon_tx BOOLEAN DEFAULT 0,
            arbitrum_tx BOOLEAN DEFAULT 0,
            bsc_tx BOOLEAN DEFAULT 0,
            avalanche_tx BOOLEAN DEFAULT 0,
            base_tx BOOLEAN DEFAULT 0,
            optimism_tx BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (mnemonic_id) REFERENCES mnemonics(id)
        )`);

        // アクティブウォレットを管理するテーブル
        db.run(`CREATE TABLE IF NOT EXISTS active_wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_address TEXT,
            private_key TEXT,
            chain_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });

    return db;
}

// ニーモニックフレーズを保存
function saveMnemonic(db, mnemonic) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare('INSERT INTO mnemonics (mnemonic) VALUES (?)');
        stmt.run(mnemonic, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
        stmt.finalize();
    });
}

// ウォレット情報を保存
function saveWallet(db, mnemonicId, wallet, derivationPath) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(
            'INSERT INTO wallets (mnemonic_id, private_key, wallet_address, derivation_path) VALUES (?, ?, ?, ?)'
        );
        stmt.run(mnemonicId, wallet.privateKey, wallet.address, derivationPath, (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

// アクティブウォレットを保存
function saveActiveWallet(db, wallet, chainName) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(
            'INSERT INTO active_wallets (wallet_address, private_key, chain_name) VALUES (?, ?, ?)'
        );
        stmt.run(wallet.address, wallet.privateKey, chainName, (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

// ニーモニックフレーズからウォレットを生成
async function generateWalletsFromMnemonic(mnemonic) {
    const wallets = [];
    const masterNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
    
    for (let i = 0; i < 3; i++) {
        const childNode = masterNode.deriveChild(i);
        wallets.push({
            privateKey: childNode.privateKey,
            address: childNode.address,
            derivationPath: `m/44'/60'/0'/0/${i}`
        });
    }
    
    return wallets;
}

// トランザクションチェック
async function checkTransactions(address, chain) {
    try {
        const response = await axios.post(chain.rpc, {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionCount',
            params: [address, 'latest']
        });

        const transactionCount = parseInt(response.data.result, 16);
        return transactionCount > 0;
    } catch (error) {
        console.error(`${chain.name}のトランザクションチェックエラー:`, error.message);
        return false;
    }
}

// トランザクションフラグを更新
async function updateTransactionFlags(db, wallet, chainResults) {
    const updates = Object.entries(chainResults)
        .map(([chain, hasTransactions]) => `${chain}_tx = ${hasTransactions ? 1 : 0}`)
        .join(', ');

    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE wallets 
            SET ${updates}
            WHERE wallet_address = ?
        `);
        stmt.run(wallet.address, (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

// ランダムなニーモニックフレーズを生成
function generateMnemonic() {
    const wallet = ethers.Wallet.createRandom();
    return wallet.mnemonic.phrase;
}

module.exports = {
    CHAINS,
    initializeDatabase,
    saveMnemonic,
    saveWallet,
    saveActiveWallet,
    generateWalletsFromMnemonic,
    checkTransactions,
    updateTransactionFlags,
    generateMnemonic
};