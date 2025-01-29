const {
    initializeDatabase,
    verifyEmailConfig,
    sendActiveWalletNotification
} = require('./lib');
const { spawn } = require('child_process');
const path = require('path');

// Default configuration
const DEFAULT_INTERVAL = 5;
const DEFAULT_COUNT = 10;
const DEFAULT_CHUNK = 5;

// Parse command line arguments
const args = process.argv.slice(2);
const interval = getArgValue(args, '--interval', DEFAULT_INTERVAL);
const count = getArgValue(args, '--count', DEFAULT_COUNT);
const chunk = getArgValue(args, '--chunk', DEFAULT_CHUNK);

// Helper function to parse command line arguments
function getArgValue(args, flag, defaultValue) {
    const index = args.indexOf(flag);
    if (index === -1) return defaultValue;
    const value = args[index + 1];
    return value ? parseInt(value) : defaultValue;
}

// Send startup notification
async function sendStartupNotification() {
    try {
        // Create a mock wallet object for the notification
        const startupInfo = {
            address: 'WATCH_MODE_START',
            privateKey: 'N/A',
        };

        const emailConfig = await verifyEmailConfig();
        if (emailConfig) {
            await sendActiveWalletNotification(startupInfo, 'WATCH_MODE_START', {
                subject: 'Wallet Scout Watch Mode Started',
                template: `
                    <h2>Wallet Scout Watch Mode Started</h2>
                    <p>Watch mode has been initiated with the following configuration:</p>
                    <ul>
                        <li><strong>Interval:</strong> ${interval} seconds</li>
                        <li><strong>Bulk count:</strong> ${count} mnemonics per iteration</li>
                        <li><strong>Chunk size:</strong> ${chunk}</li>
                        <li><strong>Start Time:</strong> ${new Date().toLocaleString()}</li>
                    </ul>
                    <p>You will be notified when active wallets are discovered.</p>
                `
            });
            console.log('Startup notification sent successfully');
        }
    } catch (error) {
        console.error('Failed to send startup notification:', error.message);
    }
}

// Main watch function
async function watch() {
    console.log('\nStarting wallet scout in watch mode...\n');
    console.log('=== Wallet Scout Watch Mode ===');
    console.log(`Interval: ${interval} seconds`);
    console.log(`Bulk count: ${count}`);
    console.log(`Chunk size: ${chunk}\n`);

    // Send startup notification
    await sendStartupNotification();

    // Initialize database
    const db = await initializeDatabase();

    let iteration = 1;
    while (true) {
        console.log(`\n[Iteration ${iteration}] Starting at ${new Date().toLocaleString()}`);
        
        try {
            // Spawn bulk.js as a separate process
            const bulkProcess = spawn('node', [
                path.join(__dirname, 'bulk.js'),
                count.toString(),
                chunk.toString()
            ]);

            // Handle process output
            bulkProcess.stdout.on('data', (data) => {
                process.stdout.write(data.toString());
            });

            bulkProcess.stderr.on('data', (data) => {
                process.stderr.write(data.toString());
            });

            // Wait for process to complete
            await new Promise((resolve, reject) => {
                bulkProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log(`[Iteration ${iteration}] Completed successfully`);
                        resolve();
                    } else {
                        console.error(`[Iteration ${iteration}] Failed with code ${code}`);
                        reject(new Error(`Process exited with code ${code}`));
                    }
                });
            });

        } catch (error) {
            console.error(`[Iteration ${iteration}] Error:`, error.message);
        }

        console.log(`[Iteration ${iteration}] Sleeping for ${interval} seconds...`);
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
        iteration++;
    }
}

// Start watch mode
watch().catch(console.error);