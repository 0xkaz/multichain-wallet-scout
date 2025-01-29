const {
    CHAINS,
    initializeDatabase,
    saveMnemonic,
    saveWallet,
    saveActiveWallet,
    generateWalletsFromMnemonic,
    checkTransactions,
    updateTransactionFlags,
    generateMnemonic
} = require('./lib');

// Configuration
const MAX_CONCURRENT_REQUESTS = 10;
const BATCH_SIZE = 5;
const REQUEST_TIMEOUT = 10000;
const RETRY_DELAY = 2000;
const MAX_RETRIES = 3;

// Rate limit management
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000;
const REQUESTS_PER_WINDOW = 50;

// Progress counters
let processedMnemonics = 0;
let processedWallets = 0;
let foundTransactions = 0;
let startTime;

// Show progress
function showProgress(total) {
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - startTime) / 1000;
    const speed = processedWallets / elapsedSeconds;
    const eta = ((total - processedMnemonics) / (processedMnemonics / elapsedSeconds)).toFixed(1);
    
    process.stdout.write(`\rProgress: ${processedMnemonics}/${total} (${((processedMnemonics / total) * 100).toFixed(2)}%) | ` +
        `Checked: ${processedWallets} | ` +
        `Found: ${foundTransactions} | ` +
        `Speed: ${speed.toFixed(2)} wallets/sec | ` +
        `ETA: ${eta}s`);
}

// Check rate limit
function checkRateLimit(chainId) {
    const now = Date.now();
    if (!rateLimits.has(chainId)) {
        rateLimits.set(chainId, []);
    }

    const requests = rateLimits.get(chainId);
    const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
    rateLimits.set(chainId, validRequests);

    if (validRequests.length >= REQUESTS_PER_WINDOW) {
        const oldestRequest = validRequests[0];
        const waitTime = RATE_LIMIT_WINDOW - (now - oldestRequest);
        return waitTime > 0 ? waitTime : 0;
    }

    requests.push(now);
    return 0;
}

// Parallel execution control
async function parallelLimit(tasks, limit) {
    const results = [];
    const executing = new Set();
    
    for (const task of tasks) {
        const promise = Promise.resolve().then(() => task());
        results.push(promise);
        executing.add(promise);
        
        const clean = () => executing.delete(promise);
        promise.then(clean).catch(clean);
        
        if (executing.size >= limit) {
            await Promise.race(executing);
        }

        const waitTime = Math.max(...Array.from(rateLimits.values())
            .map(requests => {
                const now = Date.now();
                const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
                return validRequests.length >= REQUESTS_PER_WINDOW ? 
                    RATE_LIMIT_WINDOW - (now - validRequests[0]) : 0;
            }));

        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    
    return Promise.all(results);
}

// Transaction check with retry
async function retryableCheck(wallet, chain, chainId) {
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const waitTime = checkRateLimit(chainId);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
            
            const result = await Promise.race([
                checkTransactions(wallet.address, chain),
                new Promise((_, reject) => {
                    controller.signal.addEventListener('abort', () => 
                        reject(new Error('Request timeout'))
                    );
                })
            ]);
            
            clearTimeout(timeoutId);
            return result;
        } catch (error) {
            if (error.response?.status === 429) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
                continue;
            }
            if (i === MAX_RETRIES - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
    return false;
}

// Check transactions across all chains
async function checkAllChains(wallet) {
    const chainResults = {};
    const chainTasks = Object.entries(CHAINS).map(([chainId, chain]) => async () => {
        try {
            const hasTransactions = await retryableCheck(wallet, chain, chainId);
            chainResults[chainId] = hasTransactions;
            if (hasTransactions) {
                foundTransactions++;
                showProgress(totalMnemonics);
            }
            return { chainId, hasTransactions };
        } catch (error) {
            console.error(`\nTransaction check error for ${chain.name}:`, error.message);
            chainResults[chainId] = false;
            return { chainId, hasTransactions: false };
        }
    });

    await parallelLimit(chainTasks, MAX_CONCURRENT_REQUESTS);
    return chainResults;
}

// Process wallet batch
async function processWalletBatch(db, wallets, mnemonicId) {
    const walletTasks = wallets.map(wallet => async () => {
        try {
            await saveWallet(db, mnemonicId, wallet, wallet.derivationPath);
            const chainResults = await checkAllChains(wallet);
            
            const activeChains = Object.entries(chainResults)
                .filter(([, hasTransactions]) => hasTransactions)
                .map(([chainId]) => CHAINS[chainId].name);

            if (activeChains.length > 0) {
                await Promise.all(activeChains.map(chainName =>
                    saveActiveWallet(db, wallet, chainName)
                ));
            }

            await updateTransactionFlags(db, wallet, chainResults);
            processedWallets++;
            showProgress(totalMnemonics);
            
        } catch (error) {
            console.error('\nWallet processing error:', error.message);
        }
    });

    await parallelLimit(walletTasks, BATCH_SIZE);
}

// Process mnemonic chunk
async function processMnemonicChunk(db, mnemonics) {
    const mnemonicTasks = mnemonics.map(mnemonic => async () => {
        try {
            const mnemonicId = await saveMnemonic(db, mnemonic);
            const wallets = await generateWalletsFromMnemonic(mnemonic);
            await processWalletBatch(db, wallets, mnemonicId);
            processedMnemonics++;
            showProgress(totalMnemonics);
        } catch (error) {
            console.error('\nMnemonic processing error:', error.message);
        }
    });

    await parallelLimit(mnemonicTasks, BATCH_SIZE);
}

// Get statistics
async function getStats(db) {
    const stats = {
        totalMnemonics: 0,
        totalWallets: 0,
        totalActiveWallets: 0,
        activeWalletsByChain: {}
    };

    try {
        // Total mnemonics
        const mnemonicResult = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM mnemonics', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        stats.totalMnemonics = mnemonicResult;

        // Total wallets
        const walletResult = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM wallets', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        stats.totalWallets = walletResult;

        // Total active wallets
        const activeWalletResult = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(DISTINCT wallet_address) as count FROM active_wallets', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        stats.totalActiveWallets = activeWalletResult;

        // Active wallets by chain
        const chainStats = await new Promise((resolve, reject) => {
            db.all('SELECT chain_name, COUNT(*) as count FROM active_wallets GROUP BY chain_name', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        chainStats.forEach(stat => {
            stats.activeWalletsByChain[stat.chain_name] = stat.count;
        });

        return stats;
    } catch (error) {
        console.error('Statistics retrieval error:', error);
        return stats;
    }
}

// Main processing
let totalMnemonics = 0;

async function processBulkMnemonics(count = 10, chunkSize = 5) {
    const db = initializeDatabase();
    totalMnemonics = count;
    startTime = Date.now();
    
    console.log(`Processing ${count} mnemonic phrases (chunk size: ${chunkSize})`);
    console.log('Starting process...\n');

    try {
        // Get statistics before processing
        const beforeStats = await getStats(db);

        for (let i = 0; i < count; i += chunkSize) {
            const chunkCount = Math.min(chunkSize, count - i);
            const mnemonics = Array.from({ length: chunkCount }, () => generateMnemonic());
            await processMnemonicChunk(db, mnemonics);
        }

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        const walletsPerSecond = processedWallets / duration;
        const mnemonicsPerSecond = count / duration;

        // Get statistics after processing
        const afterStats = await getStats(db);

        console.log('\n\n=== Processing Summary ===');
        console.log(`\nCurrent Session:`)
        console.log(`Processing time: ${duration.toFixed(2)} seconds`);
        console.log(`Mnemonic processing speed: ${mnemonicsPerSecond.toFixed(2)} per second`);
        console.log(`Wallet processing speed: ${walletsPerSecond.toFixed(2)} per second`);
        console.log(`Wallets checked: ${processedWallets}`);
        console.log(`Transactions found: ${foundTransactions}`);

        console.log('\nOverall Statistics:');
        console.log(`Total mnemonics: ${afterStats.totalMnemonics}`);
        console.log(`Total wallets: ${afterStats.totalWallets}`);
        console.log(`Total active wallets: ${afterStats.totalActiveWallets}`);

        if (Object.keys(afterStats.activeWalletsByChain).length > 0) {
            console.log('\nActive Wallets by Chain:');
            Object.entries(afterStats.activeWalletsByChain)
                .sort(([, a], [, b]) => b - a)
                .forEach(([chain, count]) => {
                    console.log(`${chain}: ${count}`);
                });
        }

        console.log('\nIncreases in this Session:');
        console.log(`Mnemonics: +${afterStats.totalMnemonics - beforeStats.totalMnemonics}`);
        console.log(`Wallets: +${afterStats.totalWallets - beforeStats.totalWallets}`);
        console.log(`Active wallets: +${afterStats.totalActiveWallets - beforeStats.totalActiveWallets}`);

    } catch (error) {
        console.error('\nBulk processing error:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Database connection error:', err.message);
            }
            console.log('\nDatabase connection closed');
        });
    }
}

// Process command line arguments
const count = process.argv[2] ? parseInt(process.argv[2]) : 10;
const chunkSize = process.argv[3] ? parseInt(process.argv[3]) : 5;

processBulkMnemonics(count, chunkSize).catch(console.error);