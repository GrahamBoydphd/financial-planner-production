#!/bin/bash

# --- CONFIGURATION ---
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BRANCH_NAME="ai-fix-$TIMESTAMP"
PROMPT_FILE="./scripts/ai_prompt_packet.txt"
RESPONSE_FILE="./scripts/ai_solution.md"

# 1. ROBUST PATHING (Find Project Root)
# ---------------------------------------------------------
# This ensures variables work even if you run the script from a subfolder
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/.venv"

# Define EXPLICIT binaries (Bypasses need for 'activate')
PYTHON_CMD="$VENV_DIR/bin/python3"
PIP_CMD="$VENV_DIR/bin/pip"

# 2. LOAD SECRETS
# ---------------------------------------------------------
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo "⚠️  Warning: .env file not found in $PROJECT_ROOT."
fi

# 3. AUTO-MANAGE VIRTUAL ENV (Explicit Mode)
# ---------------------------------------------------------
if [ ! -d "$VENV_DIR" ]; then
    echo "🔧 Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Check/Install Library using the VENV's pip
if ! "$PIP_CMD" freeze | grep -q "google-genai"; then
    echo "📦 Installing google-genai..."
    "$PIP_CMD" install google-genai
fi

# 4. PARSE ARGUMENTS
# ---------------------------------------------------------
if [ "$#" -lt 2 ]; then
    echo "Usage: ./scripts/do_task.sh \"Task Description\" file1 file2 ..."
    exit 1
fi

TASK="$1"
shift
TARGET_FILES="$@"

# 5. CREATE BRANCH
# ---------------------------------------------------------
git checkout -b "$BRANCH_NAME" 2>/dev/null || echo "Switched to branch: $BRANCH_NAME"
echo "Branch '$BRANCH_NAME' active."

# 6. GENERATE SOLUTION
# ---------------------------------------------------------
echo "Packaging context..."

# Use explicit path for script calls too
"$PROJECT_ROOT/scripts/pack_context.sh" "$TASK" $TARGET_FILES 

if [ $? -ne 0 ]; then
    echo "Packaging failed."
    exit 1
fi

echo "Running Builder..."
# CRITICAL FIX: Use the VENV python binary directly
"$PYTHON_CMD" "$PROJECT_ROOT/scripts/builder.py" "$PROMPT_FILE" > "$RESPONSE_FILE"

if [ $? -ne 0 ]; then
    echo "Builder failed."
    exit 1
fi

echo "✅ AI response saved to: $RESPONSE_FILE"

# 7. INTERACTIVE REVIEW
# ---------------------------------------------------------
echo "---------------------------------------------------"
echo "Please review '$RESPONSE_FILE' now."
echo "---------------------------------------------------"

while true; do
    read -p "Do you want to apply these changes to the code? (y/n): " yn
    case $yn in
        [Yy]* ) 
            echo "Applying changes..."
            if [ -f "$PROJECT_ROOT/scripts/apply.py" ]; then
                "$PYTHON_CMD" "$PROJECT_ROOT/scripts/apply.py" "$RESPONSE_FILE"
                echo "Done! Check your files."
            else
                echo "Error: 'apply.py' not found."
            fi
            break;;
        [Nn]* ) 
            echo "Skipping application."
            break;;
        * ) echo "Please answer yes or no.";;
    esac
done
