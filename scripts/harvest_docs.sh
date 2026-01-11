#!/bin/bash
# Save as: scripts/harvest_docs.sh

VENV_DIR=".venv"
OUTPUT_FILE="./scripts/harvest_packet.txt"

# ---------------------------------------------------------
# 1. NEW: Load Secrets from .env (Matches do_task.sh logic)
# ---------------------------------------------------------
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo "⚠️  Warning: .env file not found. GOOGLE_API_KEY might be missing."
fi

# ---------------------------------------------------------
# 2. Activate Environment
# ---------------------------------------------------------
if [ -d "$VENV_DIR" ]; then
    source "$VENV_DIR/bin/activate"
else
    echo "❌ Error: Virtual environment not found at $VENV_DIR"
    exit 1
fi

# ---------------------------------------------------------
# 3. Find relevant files
# ---------------------------------------------------------
echo "🔍 Trawling frontend for documentation context..."
# We use -f to ensure we only cat files that actually exist
TARGET_FILES=$(find frontend/components/forms frontend/app/plan/\[planId\]/inputs frontend/lib -type f \( -name "*.tsx" -o -name "*.ts" \))

# ---------------------------------------------------------
# 4. Package the data
# ---------------------------------------------------------
{
    echo "<task>"
    echo "Scan these files and create a detailed Technical Reference for a User Manual."
    echo "Focus on: Input labels, placeholders, validation logic, and the math/descriptions for Investment Policies."
    echo "</task>"
    echo "<source_code>"
    for file in $TARGET_FILES; do
        echo "--- FILE: $file ---"
        cat "$file"
        echo ""
    done
    echo "</source_code>"
} > "$OUTPUT_FILE"

# ---------------------------------------------------------
# 5. Run the specialized harvester
# ---------------------------------------------------------
python3 ./scripts/harvester.py
