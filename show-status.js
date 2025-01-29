const sqlite3 = require('sqlite3').verbose();

// Connect to SQLite database
const db = new sqlite3.Database('wallets.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
        process.exit(1);
    }
    console.log('Connected to database');
});

// Get and display database statistics
async function showDatabaseStats() {
    try {
        console.log('\n=== Database Statistics ===\n');

        // Get total mnemonics
        const mnemonics = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM mnemonics', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log('Total mnemonic phrases:', mnemonics);

        // Get total wallets
        const wallets = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM wallets', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log('Total wallets:', wallets);

        // Get active wallets count
        const activeWallets = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(DISTINCT wallet_address) as count FROM active_wallets', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log('Total active wallets:', activeWallets);

        // Get active wallets by chain
        const chainStats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT chain_name, COUNT(*) as count 
                FROM active_wallets 
                GROUP BY chain_name
                ORDER BY count DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (chainStats.length > 0) {
            console.log('\nActive wallets by chain:');
            chainStats.forEach(stat => {
                console.log(`${stat.chain_name}: ${stat.count}`);
            });
        }

        // Get latest active wallet
        const latestActive = await new Promise((resolve, reject) => {
            db.get(`
                SELECT wallet_address, chain_name, created_at
                FROM active_wallets
                ORDER BY created_at DESC
                LIMIT 1
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (latestActive) {
            console.log('\nMost recent active wallet:');
            console.log('Address:', latestActive.wallet_address);
            console.log('Chain:', latestActive.chain_name);
            console.log('Found at:', new Date(latestActive.created_at).toLocaleString());
        }

    } catch (error) {
        console.error('Error retrieving statistics:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Database disconnection error:', err.message);
            }
            console.log('\nDatabase connection closed');
        });
    }
}

// Run the program
showDatabaseStats().catch(console.error);