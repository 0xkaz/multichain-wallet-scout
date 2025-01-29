
# Multi-Chain Wallet Generator and Transaction Checker

A Node.js application that generates Ethereum-compatible wallets and checks for transactions across multiple blockchain networks.

## Features

- Generate mnemonic phrases and derive multiple wallets
- Check transactions across multiple chains:
  - Ethereum Mainnet
  - Polygon
  - Arbitrum
  - Binance Smart Chain
  - Avalanche C-Chain
  - Base Chain
  - OP Mainnet
- Store wallet information in SQLite database
- Track active wallets with transactions
- Bulk processing support
- Rate limiting and error handling
- Progress tracking and statistics
- Periodic execution with customizable intervals
- Comprehensive npm scripts for various operations
- Make commands for easy execution
- Email notifications for active wallet discovery
- SMTP integration for notifications
- Test suite for email functionality

## Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)
- make (for Make commands)
- SMTP server access for email notifications
- Docker and Docker Compose (for Docker installation)

## Installation

### Standard Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd [repository-name]
```

2. Install dependencies:
```bash
npm install
# or simply
make
```

3. Configure environment variables:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your email settings
nano .env
```

4. Configure RPC endpoints (if needed) in `lib.js`

### Docker Installation

1. Clone the repository and configure environment:
```bash
git clone [repository-url]
cd [repository-name]
cp .env.example .env
# Edit .env with your settings
```

2. Build and run with Docker Compose:
```bash
docker-compose up -d
```

3. View logs:
```bash
docker-compose logs -f
```

4. Stop the container:
```bash
docker-compose down
```

#### Docker Configuration

The Docker setup includes:
- Automatic restart on failure
- Volume mounting for database persistence
- Health checks every 30 seconds
- Log rotation (max 3 files of 10MB each)
- Environment variable configuration via .env file

Environment variables can be configured in the .env file:
```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
NOTIFICATION_EMAIL=recipient@example.com
EMAIL_SUBJECT="Active Wallet Found!"
EMAIL_FROM_NAME="Wallet Scout"

# Watch Mode Configuration
WATCH_INTERVAL=5
WATCH_BATCH_SIZE=10
WATCH_CHUNK_SIZE=5
```

## Email Configuration

Set up email notifications by configuring the following variables in your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
NOTIFICATION_EMAIL=recipient@example.com

# Email Notification Settings
EMAIL_SUBJECT="Active Wallet Found!"
EMAIL_FROM_NAME="Wallet Scout"
```

For Gmail users:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password as SMTP_PASS

Test your email configuration:
```bash
# Using npm
npm run test:mail

# Using make
make test-mail
```

## Usage

### Quick Start with Make Commands

Basic operations:
```bash
# Generate and check wallets
make

# Start watch mode
make watch

# Show database statistics
make status

# View active wallets
make active
```

Bulk processing:
```bash
# Process 5 mnemonics
make bulk-small

# Process 20 mnemonics
make bulk-medium

# Process 50 mnemonics
make bulk-large
```

Watch mode variations:
```bash
# Fast execution (2-second interval)
make watch-quick

# Slow execution (10-second interval)
make watch-slow
```

Maintenance:
```bash
# Remove node_modules and database
make clean

# Show available commands
make help
```

### NPM Scripts

One-time operations:
```bash
# Generate and check wallets (default settings)
npm run generate

# View active wallets
npm run active

# Display database statistics
npm run status
```

Bulk processing presets:
```bash
# Process 5 mnemonics in small batches
npm run bulk:small

# Process 20 mnemonics in medium batches
npm run bulk:medium

# Process 50 mnemonics in large batches
npm run bulk:large
```

### Watch Mode (Periodic Execution)

Basic watch mode with default settings:
```bash
npm run generate:watch
```

Preset intervals:
```bash
# Fast execution (2-second interval)
npm run watch:quick

# Slow execution (10-second interval)
npm run watch:slow
```

Custom watch mode configuration:
```bash
npm run generate:watch -- --interval=3 --count=5 --chunk=2
```

Watch mode parameters:
- `interval`: Sleep duration between executions (seconds)
- `count`: Number of mnemonics to process in each iteration
- `chunk`: Batch size for processing

### Direct Script Execution

Generate and check wallets:
```bash
node bulk.js [number_of_mnemonics] [chunk_size]
```

Start watch mode:
```bash
node watch.js --interval=5 --count=10 --chunk=5
```

View active wallets:
```bash
node show-active-wallets.js
```

Check statistics:
```bash
node show-status.js
```

## Database Structure

The system uses SQLite with three main tables:

### mnemonics
- Stores generated mnemonic phrases
- Fields: id, mnemonic, created_at

### wallets
- Stores wallet information
- Fields: id, mnemonic_id, private_key, wallet_address, derivation_path, [chain]_tx flags, created_at

### active_wallets
- Tracks wallets with transactions
- Fields: id, wallet_address, private_key, chain_name, created_at

## Output Examples

### Bulk Processing
```
Progress: 10/50 (20.00%) | Checked: 30 | Found: 0 | Speed: 7.39 wallets/sec | ETA: 13.5s

=== Processing Summary ===
Processing time: 4.06 seconds
Mnemonic processing speed: 2.46 per second
Wallet processing speed: 7.39 per second
Wallets checked: 30
Transactions found: 0
```

### Watch Mode
```
=== Wallet Scout Watch Mode ===
Interval: 5 seconds
Bulk count: 10
Chunk size: 5

[Iteration 1] Starting at 2025-01-29 22:30:00
...
[Iteration 1] Completed successfully
[Iteration 1] Sleeping for 5 seconds...
```

### Statistics
```
=== Database Statistics ===
Total mnemonic phrases: 251
Total wallets: 753
Total active wallets: 0
```

## Performance Considerations

- Uses parallel processing for efficient transaction checking
- Implements rate limiting to prevent API throttling
- Batch processing to optimize database operations
- Memory-efficient processing of large datasets
- Configurable execution intervals for periodic processing

## Error Handling

- Automatic retry for failed RPC requests
- Rate limit management
- Timeout handling
- Database transaction safety
- Graceful shutdown in watch mode

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.