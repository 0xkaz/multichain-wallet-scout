# Build stage
FROM node:20-alpine3.19 AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Production stage
FROM node:20-alpine3.19

# Install runtime dependencies
RUN apk add --no-cache python3

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

# Create volume for database persistence
VOLUME /app/data

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