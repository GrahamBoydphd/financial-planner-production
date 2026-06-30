#!/bin/bash

# --- CONFIGURATION ---
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BRANCH_NAME="ai-fix-$TIMESTAMP"
PROMPT_FILE="./scripts/ai_prompt_packet.txt"
RESPONSE_FILE="./scripts/ai_solution.md"

# DEFAULT MODEL
AI_MODEL="gemini-3.1-pro-preview"
THINK_FLAG=""

# 1. PARSE OPTIONAL FLAGS
# ---------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -m|--model) AI_MODEL="$2"; shift 2 ;;
        -t|--think) THINK_FLAG="--think"; shift 1 ;;
        *) break ;; # Stop parsing flags, move on to task and files
    esac
done

# 2. PARSE TASK ARGUMENTS
# ---------------------------------------------------------
if [ "$#" -lt 2 ]; then
    echo "Usage: ./scripts/do_task.sh [-m model] [-t] \"Task Description\" file1 file2 ..."
    echo "Example (Fast Lane): ./scripts/do_task.sh -m gemini-3.5-flash \"Fix typo\" file.ts"
    echo "Example (Thinking):  ./scripts/do_task.sh -m gemini-3.5-flash -t \"Fix logic\" file.ts"
    echo "Example (Heavy Pro): ./scripts/do_task.sh \"Refactor backend\" file.rs"
    exit 1
fi

TASK="$1"
shift
TARGET_FILES="$@"

# 3. ROBUST PATHING
# ---------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/.venv"

PYTHON_CMD="$VENV_DIR/bin/python3"
PIP_CMD="$VENV_DIR/bin/pip"

# 4. LOAD SECRETS
# ---------------------------------------------------------
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo "⚠️  Warning: .env file not found in $PROJECT_ROOT."
fi

# 5. AUTO-MANAGE VIRTUAL ENV
# ---------------------------------------------------------
if [ ! -d "$VENV_DIR" ]; then
    echo "🔧 Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

echo "📦 Verifying latest google-genai SDK..."
"$PIP_CMD" install --upgrade google-genai > /dev/null 2>&1

# 6. PRE-FLIGHT API CHECK
# ---------------------------------------------------------
echo "📡 Verifying API access to $AI_MODEL..."
if ! "$PYTHON_CMD" "$PROJECT_ROOT/scripts/builder.py" --model "$AI_MODEL" --check; then
    echo "🛑 Task aborted to prevent git branching errors."
    exit 1
fi

# 7. SAFETY SNAPSHOT
# ---------------------------------------------------------
if [[ -n $(git status -s) ]]; then
    echo "📸  Uncommitted changes detected. Creating safety snapshot..."
    git stash push -u -m "Pre-Agent-Snapshot-$TIMESTAMP" > /dev/null 2>&1
    git stash apply > /dev/null 2>&1
    echo "✅  Snapshot saved! (Ref: Pre-Agent-Snapshot-$TIMESTAMP)"
else
    echo "✨  Working tree is clean. No snapshot needed."
fi

# 8. CREATE BRANCH
# ---------------------------------------------------------
git checkout -b "$BRANCH_NAME" 2>/dev/null || echo "Switched to branch: $BRANCH_NAME"
echo "🌿 Branch '$BRANCH_NAME' active."

# 9. GENERATE SOLUTION
# ---------------------------------------------------------
echo "📦 Packaging context..."
"$PROJECT_ROOT/scripts/pack_context.sh" "$TASK" $TARGET_FILES 

if [ $? -ne 0 ]; then
    echo "❌ Packaging failed."
    exit 1
fi

# Pass the think flag (will be empty if not requested, or '--think' if requested)
echo "🤖 Executing AI Builder..."
"$PYTHON_CMD" "$PROJECT_ROOT/scripts/builder.py" --model "$AI_MODEL" $THINK_FLAG "$PROMPT_FILE" > "$RESPONSE_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Builder failed."
    exit 1
fi

echo "✅ AI response saved to: $RESPONSE_FILE"

# 10. INTERACTIVE REVIEW
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
