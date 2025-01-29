const sqlite3 = require('sqlite3').verbose();

// Connect to SQLite database
const db = new sqlite3.Database('wallets.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
        process.exit(1);
    }
    console.log('Connected to database');
});

// Display active wallets
function showActiveWallets() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                wallet_address,
                private_key,
                chain_name,
                created_at
            FROM active_wallets
            ORDER BY created_at DESC
        `;

        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            if (rows.length === 0) {
                console.log('\nNo active wallets found.');
            } else {
                console.log('\n=== Active Wallets List ===\n');
                rows.forEach((row, index) => {
                    console.log(`[Wallet ${index + 1}]`);
                    console.log('Address:', row.wallet_address);
                    console.log('Private Key:', row.private_key);
                    console.log('Chain:', row.chain_name);
                    console.log('Created:', new Date(row.created_at).toLocaleString());
                    console.log('------------------------');
                });
                console.log(`\nTotal: ${rows.length} active wallets`);
            }
            resolve();
        });
    });
}

// Main function
async function main() {
    try {
        await showActiveWallets();
    } catch (error) {
        console.error('Error occurred:', error);
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
main().catch(console.error);