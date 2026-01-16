#!/bin/bash

# --- CONFIGURATION ---
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BRANCH_NAME="ai-fix-$TIMESTAMP"
PROMPT_FILE="./scripts/ai_prompt_packet.txt"
RESPONSE_FILE="./scripts/ai_solution.md"
VENV_DIR=".venv"

# ---------------------------------------------------------
# 1. FIX: Load Secrets from .env (in project root)
# ---------------------------------------------------------
if [ -f .env ]; then
    # export $(grep -v '^\s*#' .env | xargs) # Old method, can be brittle
    set -a
    source .env
    set +a
else
    echo "⚠️  Warning: .env file not found. GOOGLE_API_KEY might be missing."
fi

# ---------------------------------------------------------
# 2. FIX: Auto-Manage Virtual Environment
# ---------------------------------------------------------
# Check if .venv exists, if not create it
if [ ! -d "$VENV_DIR" ]; then
    echo "🔧 Creating Python virtual environment (.venv)..."
    python3 -m venv "$VENV_DIR"
fi

# Activate the environment
source "$VENV_DIR/bin/activate"

# Check if the library is installed; if not, install it
# We check silently (-q) and install if check fails
if ! pip freeze | grep -q "google-genai"; then
    echo "📦 Installing required library: google-genai..."
    pip install google-genai
fi

# ---------------------------------------------------------
# 3. Parse Arguments
# ---------------------------------------------------------
if [ "$#" -lt 2 ]; then
    echo "Usage: ./scripts/do_task.sh \"Task Description\" file1 file2 ..."
    exit 1
fi

TASK="$1"
shift
TARGET_FILES="$@"

# ---------------------------------------------------------
# 4. Create Branch
# ---------------------------------------------------------
# Checks if branch exists or creates it safely
git checkout -b "$BRANCH_NAME" 2>/dev/null || echo "Switched to branch: $BRANCH_NAME"
echo "Branch '$BRANCH_NAME' created/active."

# ---------------------------------------------------------
# 5. Generate Solution
# ---------------------------------------------------------
echo "Packaging context..."

./scripts/pack_context.sh "$TASK" $TARGET_FILES

if [ $? -ne 0 ]; then
    echo "Packaging failed."
    exit 1
fi

echo "Running Builder..."
python3 ./scripts/builder.py "$PROMPT_FILE" > "$RESPONSE_FILE"

if [ $? -ne 0 ]; then
    echo "Builder failed."
    exit 1
fi

echo "✅ AI response saved to: $RESPONSE_FILE"

# ---------------------------------------------------------
# 6. Interactive Review & Apply
# ---------------------------------------------------------

echo "---------------------------------------------------"
echo "Please review '$RESPONSE_FILE' now."
echo "---------------------------------------------------"

while true; do
    read -p "Do you want to apply these changes to the code? (y/n): " yn
    case $yn in
        [Yy]* )
            echo "Applying changes..."
            if [ -f "./scripts/apply.py" ]; then
                python3 ./scripts/apply.py "$RESPONSE_FILE"
                echo "Done! Check your files."
            else
                echo "Error: './scripts/apply.py' not found. Cannot apply changes automatically."
            fi
            break;;
        [Nn]* )
            echo "Skipping application. You can manually apply '$RESPONSE_FILE' later."
            break;;
        * ) echo "Please answer yes or no.";;
    esac
done
