const { spawn } = require('child_process');
const path = require('path');

// Default configuration
const DEFAULT_INTERVAL = 5; // seconds
const DEFAULT_BULK_COUNT = 10;
const DEFAULT_CHUNK_SIZE = 5;

// Parse command line arguments
const args = process.argv.slice(2);
const intervalArg = args.find(arg => arg.startsWith('--interval='));
const countArg = args.find(arg => arg.startsWith('--count='));
const chunkArg = args.find(arg => arg.startsWith('--chunk='));

const interval = intervalArg ? parseInt(intervalArg.split('=')[1]) : DEFAULT_INTERVAL;
const count = countArg ? parseInt(countArg.split('=')[1]) : DEFAULT_BULK_COUNT;
const chunkSize = chunkArg ? parseInt(chunkArg.split('=')[1]) : DEFAULT_CHUNK_SIZE;

// Validate arguments
if (isNaN(interval) || interval < 1) {
    console.error('Error: Invalid interval value. Using default:', DEFAULT_INTERVAL);
    interval = DEFAULT_INTERVAL;
}

if (isNaN(count) || count < 1) {
    console.error('Error: Invalid count value. Using default:', DEFAULT_BULK_COUNT);
    count = DEFAULT_BULK_COUNT;
}

if (isNaN(chunkSize) || chunkSize < 1) {
    console.error('Error: Invalid chunk size value. Using default:', DEFAULT_CHUNK_SIZE);
    chunkSize = DEFAULT_CHUNK_SIZE;
}

// Function to execute bulk.js
async function executeBulk() {
    return new Promise((resolve, reject) => {
        const process = spawn('node', ['bulk.js', count.toString(), chunkSize.toString()], {
            stdio: 'inherit'
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });

        process.on('error', (err) => {
            reject(err);
        });
    });
}

// Sleep function
function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Main watch loop
async function watch() {
    let iteration = 1;
    
    console.log('\n=== Wallet Scout Watch Mode ===');
    console.log(`Interval: ${interval} seconds`);
    console.log(`Bulk count: ${count}`);
    console.log(`Chunk size: ${chunkSize}\n`);

    while (true) {
        console.log(`\n[Iteration ${iteration}] Starting at ${new Date().toLocaleString()}`);
        
        try {
            await executeBulk();
            console.log(`[Iteration ${iteration}] Completed successfully`);
        } catch (error) {
            console.error(`[Iteration ${iteration}] Error:`, error.message);
        }

        console.log(`[Iteration ${iteration}] Sleeping for ${interval} seconds...`);
        await sleep(interval);
        iteration++;
    }
}

// Handle termination signals
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Gracefully shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM. Gracefully shutting down...');
    process.exit(0);
});

// Start watching
console.log('Starting wallet scout in watch mode...');
watch().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});