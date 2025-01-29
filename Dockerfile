# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install system dependencies for sqlite3
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create volume for database persistence
VOLUME /app/data

# Set environment variables
ENV NODE_ENV=production
ENV SQLITE_DB_PATH=/app/data/wallets.db

# Create data directory
RUN mkdir -p /app/data

# Set default command to run watch mode
CMD ["npm", "run", "generate:watch"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const fs = require('fs'); \
                 const path = '/app/data/wallets.db'; \
                 if (!fs.existsSync(path)) process.exit(1); \
                 const stats = fs.statSync(path); \
                 if (Date.now() - stats.mtime.getTime() > 300000) process.exit(1);"