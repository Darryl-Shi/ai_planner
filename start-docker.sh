#!/bin/bash

# AI Calendar Planner - Docker Quick Start Script

set -e

echo "🚀 AI Calendar Planner - Docker Setup"
echo "========================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://www.docker.com/get-started"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker is installed"
echo ""

# Check if .env.docker.local exists
if [ ! -f .env.docker.local ]; then
    echo "⚙️  Creating environment configuration..."

    if [ ! -f .env.docker ]; then
        echo "❌ .env.docker template not found!"
        exit 1
    fi

    cp .env.docker .env.docker.local

    echo ""
    echo "🔐 Generating secure keys..."

    # Generate encryption key
    ENCRYPTION_KEY=$(openssl rand -hex 32)

    # Generate session secret
    SESSION_SECRET=$(openssl rand -hex 32)

    # Update .env.docker.local
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env.docker.local
        sed -i '' "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env.docker.local
    else
        # Linux
        sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env.docker.local
        sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env.docker.local
    fi

    echo "✅ Generated ENCRYPTION_KEY"
    echo "✅ Generated SESSION_SECRET"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env.docker.local and add your Google OAuth credentials:"
    echo "   - GOOGLE_CLIENT_ID"
    echo "   - GOOGLE_CLIENT_SECRET"
    echo ""
    echo "Get these from: https://console.cloud.google.com/apis/credentials"
    echo ""
    read -p "Press Enter after you've updated .env.docker.local..."
fi

echo ""
echo "🐳 Starting Docker containers..."
echo ""

# Start Docker Compose
docker compose --env-file .env.docker.local up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check if backend is healthy
if docker compose ps | grep -q "backend.*healthy"; then
    echo "✅ Backend is running"
else
    echo "⚠️  Backend is starting up..."
fi

# Check if frontend is healthy
if docker compose ps | grep -q "frontend"; then
    echo "✅ Frontend is running"
fi

# Check if postgres is healthy
if docker compose ps | grep -q "postgres.*healthy"; then
    echo "✅ Database is running"
fi

echo ""
echo "🎉 AI Calendar Planner is starting!"
echo ""
echo "📍 Access points:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:3001"
echo "   Database:  localhost:5432"
echo ""
echo "📋 Useful commands:"
echo "   View logs:     docker compose logs -f"
echo "   Stop:          docker compose stop"
echo "   Restart:       docker compose restart"
echo "   Clean up:      docker compose down"
echo ""
echo "For more info, see DOCKER.md"
echo ""

# Offer to open logs
read -p "Would you like to view the logs? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose logs -f
fi
