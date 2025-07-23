#!/bin/bash

# Docker startup script with auto-generation of visualization data

set -e  # Exit on any error

DATA_FILE="data/docker/visualization.bin"

echo "🚀 Starting Amsterdam Time Machine Docker containers..."

# Create Docker data directory
mkdir -p data/docker

# Create network
echo "📡 Creating Docker network..."
npm run docker:network

# Check if visualization data exists
if [ ! -f "$DATA_FILE" ]; then
    echo "⚠️  No Docker visualization data found at $DATA_FILE"
    echo "📊 Generating visualization data (this may take ~20 minutes)..."
    echo "💡 You can skip this in future by running 'bun run docker:generate' separately"
    
    # Run preprocessor to generate data in Docker data folder
    docker run --rm --name atm-preprocessor-generate --env-file .env -v $(pwd)/data/docker:/app/data:rw atm-preprocessor
    
    echo "✅ Visualization data generated successfully!"
else
    echo "✅ Docker visualization data found, skipping generation"
fi

# Start containers with Docker-specific data folder
echo "🌐 Starting application containers..."
docker run -d --name atm-app --network atm-network --env-file .env --restart unless-stopped -p 3000:3000 -v $(pwd)/data/docker:/app/data:rw atm-app

echo "🎉 Containers started successfully!"
echo "📱 App available at: http://localhost:3000"
echo "📋 View logs with: bun run docker:logs:app"