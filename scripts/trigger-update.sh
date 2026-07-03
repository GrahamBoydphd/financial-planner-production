#!/bin/bash

# --- CONFIGURATION ---
# Replace with your actual server IP or Host alias from ~/.ssh/config
SERVER_HOST="root@51.15.117.59" 

# 2. The SSH Identity
# This MUST be the path to the actual file on your laptop, not an API key.
SSH_KEY="~/.ssh/id_ed25519_Scaleway_EIS-Financial-Planning-Dev-SSH-key"

# 3. Server Directory
SERVER_DIR="~/app"

# ---------------------------------------------------------
# Parse Arguments
# ---------------------------------------------------------
if [ "$#" -ne 1 ]; then
    echo "Usage: ./scripts/trigger-update.sh \"repo branch\" "
    exit 1
fi

GIT_BRANCH="$1"

echo "🚀 Triggering remote update on $SERVER_HOST..."

ssh -i $SSH_KEY $SERVER_HOST << EOF
    set -e
    
    echo "📂 Navigating to $SERVER_DIR..."
    cd $SERVER_DIR

    # From here new code to make a backup of the database that we can roll back to
    echo "📸 Tagging current running code for immediate rollback..."
    # 🎯 THESE TWO LINES AUTOMATE THE CODE SNAPSHOT
    docker tag app-backend:latest app-backend:pre-upgrade-snapshot || true
    docker tag app-frontend:latest app-frontend:pre-upgrade-snapshot || true
    
    echo "🛑 Freezing database and taking application offline..."
    docker compose -f docker-compose.prod.yml stop backend frontend db

    echo "📸 Creating database snapshot archive..."
    sudo tar -czf ~/postgres-predeploy-snapshot.tar.gz -C /var/lib/docker/volumes/app_db_data_prod/_data .

    echo "💾 Unfreezing core database engine..."
    docker compose -f docker-compose.prod.yml start db
    # To here new code to make a backup of the database that we can roll back to

    echo "⬇️  Pulling changes from GitHub..."
    # You mentioned using this branch name earlier
    git pull origin $GIT_BRANCH

    echo "🏗️  Compiling and Rebuilding (Production)..."
    
    # CRITICAL FIX: Tell Docker to use the PROD file
    # --remove-orphans kills the old/confused containers automatically
    docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

    echo "✅ Server updated successfully!"
EOF
