#!/bin/bash
# Usage: ./scripts/try_build.sh

# 1. Determine Project Root (Robust)
# Gets the directory where THIS script lives (scripts/), then goes up one level.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ERROR_LOG="$PROJECT_ROOT/last_error.log"

# 2. Go to Backend
cd "$PROJECT_ROOT/backend" || { echo "❌ Backend directory not found!"; exit 1; }

echo "🦀 Attempting Cargo Build (Validation)..."

# 3. Build & Capture Log
# We redirect stderr to stdout (2>&1) so 'tee' captures compilation errors
cargo build 2>&1 | tee "$ERROR_LOG"

# 4. Check Status
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "✅ Build Succeeded!"
    rm "$ERROR_LOG" 2>/dev/null 
else
    echo "❌ Build Failed. Error saved to '$ERROR_LOG'."
    exit 1
fi
