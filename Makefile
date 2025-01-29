# Default target
.DEFAULT_GOAL := generate

# Check if npm is installed
NPM := $(shell command -v npm 2> /dev/null)

# Check if docker-compose is installed
DOCKER := $(shell command -v docker-compose 2> /dev/null)

# Install dependencies if package.json exists and node_modules doesn't
node_modules: package.json
	@if [ ! -d "node_modules" ]; then \
		if [ -z "$(NPM)" ]; then \
			echo "npm is not installed. Please install Node.js and npm first."; \
			exit 1; \
		fi; \
		echo "Installing dependencies..."; \
		npm install; \
	fi

# Main commands
generate: node_modules
	@echo "Starting wallet generation..."
	npm run generate

watch: node_modules
	@echo "Starting watch mode..."
	npm run generate:watch

# Additional commands
status: node_modules
	@echo "Showing database status..."
	npm run status

active: node_modules
	@echo "Showing active wallets..."
	npm run active

# Preset commands for bulk processing
bulk-small: node_modules
	@echo "Running small bulk process..."
	npm run bulk:small

bulk-medium: node_modules
	@echo "Running medium bulk process..."
	npm run bulk:medium

bulk-large: node_modules
	@echo "Running large bulk process..."
	npm run bulk:large

# Watch mode with different intervals
watch-quick: node_modules
	@echo "Starting quick watch mode..."
	npm run watch:quick

watch-slow: node_modules
	@echo "Starting slow watch mode..."
	npm run watch:slow

# Test commands
test-mail: node_modules
	@echo "Testing email configuration..."
	npm run test:mail

# Docker commands
docker-build:
	@if [ -z "$(DOCKER)" ]; then \
		echo "docker-compose is not installed. Please install Docker first."; \
		exit 1; \
	fi
	@echo "Building Docker image..."
	docker-compose build

docker-up:
	@if [ -z "$(DOCKER)" ]; then \
		echo "docker-compose is not installed. Please install Docker first."; \
		exit 1; \
	fi
	@echo "Starting Docker container..."
	docker-compose up -d

docker-down:
	@if [ -z "$(DOCKER)" ]; then \
		echo "docker-compose is not installed. Please install Docker first."; \
		exit 1; \
	fi
	@echo "Stopping Docker container..."
	docker-compose down

docker-logs:
	@if [ -z "$(DOCKER)" ]; then \
		echo "docker-compose is not installed. Please install Docker first."; \
		exit 1; \
	fi
	@echo "Showing Docker logs..."
	docker-compose logs -f

docker-watch: docker-up
	@echo "Starting watch mode in Docker..."
	@echo "Use 'make docker-logs' to view the logs"

# Clean command
clean:
	@echo "Cleaning up..."
	rm -rf node_modules
	rm -f wallets.db

# Help command
help:
	@echo "Available commands:"
	@echo "  make          - Generate wallets (default)"
	@echo "  make watch    - Start watch mode"
	@echo "  make status   - Show database statistics"
	@echo "  make active   - Show active wallets"
	@echo "  make bulk-small   - Process 5 mnemonics"
	@echo "  make bulk-medium  - Process 20 mnemonics"
	@echo "  make bulk-large   - Process 50 mnemonics"
	@echo "  make watch-quick  - Watch mode with 2s interval"
	@echo "  make watch-slow   - Watch mode with 10s interval"
	@echo "  make test-mail    - Test email configuration"
	@echo "  make clean    - Remove node_modules and database"
	@echo "  make help     - Show this help message"
	@echo ""
	@echo "Docker commands:"
	@echo "  make docker-build  - Build Docker image"
	@echo "  make docker-up     - Start Docker container"
	@echo "  make docker-down   - Stop Docker container"
	@echo "  make docker-logs   - Show Docker logs"
	@echo "  make docker-watch  - Start watch mode in Docker"

.PHONY: generate watch status active bulk-small bulk-medium bulk-large watch-quick watch-slow clean help test-mail docker-build docker-up docker-down docker-logs docker-watch