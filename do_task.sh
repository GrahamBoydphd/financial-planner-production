#!/bin/bash

TASK="$1"
TARGET_FILES="${@:2}"

if [ -z "$TASK" ]; then
    echo "Usage: ./do_task.sh \"Instruction\" file1 file2..."
    exit 1
fi

TIMESTAMP=$(date +%H%M)
BRANCH_NAME="ai-fix-$TIMESTAMP"
RESPONSE_FILE="ai_solution.md"

# 1. Safety Check
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: Working directory is dirty."
    echo "   Please commit or stash changes first."
    exit 1
fi

echo "🚀 Step 1: Generating Solution on branch '$BRANCH_NAME'..."

# 2. Create branch & Generate
git checkout -b "$BRANCH_NAME" > /dev/null 2>&1
./pack_context.sh "$TASK" $TARGET_FILES | python3 builder.py /dev/stdin > "$RESPONSE_FILE"

echo "✅ Solution generated in '$RESPONSE_FILE'."
echo "---------------------------------------------------"

# 3. Review Pause
read -p "👀 Review '$RESPONSE_FILE'. Apply to codebase? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted. Reverting..."
    git checkout - > /dev/null 2>&1
    git branch -D "$BRANCH_NAME" > /dev/null 2>&1
    exit 0
fi

echo "🚀 Step 2: Applying changes..."
python3 apply.py "$RESPONSE_FILE"

echo "---------------------------------------------------"
echo "🛠️  Step 3: Verification (Running Cargo Build)..."

# We use the 'try_build.sh' you already created to capture errors
./try_build.sh

# Capture the exit code of the build script
BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
    echo "🎉 SUCCESS: Build passed!"
    echo "   You are currently on branch '$BRANCH_NAME'."
    echo "   Run 'git merge $BRANCH_NAME' from main to keep it."
else
    echo "---------------------------------------------------"
    echo "⚠️  BUILD FAILED."
    echo "   You have two options:"
    echo "   [k] KEEP the changes (stay on branch '$BRANCH_NAME' and debug manually)."
    echo "   [d] DISCARD changes (revert to main instantly)."
    
    read -p "👉 Choose (k/d): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Dd]$ ]]; then
        echo "🔥 Discarding changes and returning to main..."
        git checkout - > /dev/null 2>&1
        git branch -D "$BRANCH_NAME" > /dev/null 2>&1
    else
        echo "👍 Changes kept. You are on branch '$BRANCH_NAME'."
        echo "   The error log is saved in 'last_error.log'."
    fi
fi
