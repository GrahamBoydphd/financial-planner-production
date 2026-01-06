#!/bin/bash

# --- CONFIGURATION ---
# 1. Load Secrets from .env (if it exists)
if [ -f .env ]; then
    export $(grep -v '^\s*#' .env | xargs)
#    export $(cat .env | xargs)
fi

# 2. Scaleway Registry
REGISTRY="rg.nl-ams.scw.cloud/evolutesix-financial-planning" 
IMAGE_NAME="eis-financial-planning"
TAG=${1:-latest}
FULL_IMAGE_URL="$REGISTRY/$IMAGE_NAME:$TAG"

# --- EXECUTION ---
set -e

echo "🚀 Starting Deployment..."
echo "Target: $FULL_IMAGE_URL"

# 3. Auto-Login (Only if not logged in)
# We check if we can access the registry. If not, we try to login using the key from .env
if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Docker is not running."
    exit 1
fi

echo "🔐 Checking Registry Auth..."
# Try to log in automatically if we have the key
if [ -n "$SCW_SECRET_KEY" ]; then
    echo "   Key found in .env - Logging in..."
    echo "$SCW_SECRET_KEY" | docker login rg.nl-ams.scw.cloud -u nologin --password-stdin
fi

# 4. Build & Push
echo "📦 Building..."
docker build --platform linux/amd64 -t "$FULL_IMAGE_URL" .

echo "☁️  Pushing..."
docker push "$FULL_IMAGE_URL"

echo "✅ Deployed: $FULL_IMAGE_URL"
