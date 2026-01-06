#!/bin/bash
# Save as: try_build.sh in the root folder
# Usage: ./try_build.sh

# Path to backend
cd backend

echo "🦀 Attempting Cargo Build..."
# Capture both Standard Output (1) and Error (2)
cargo build 2>&1 | tee ../last_error.log

# Check if build succeeded
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "✅ Build Succeeded!"
    rm ../last_error.log 2>/dev/null # Clean up error log if successful
else
    echo "❌ Build Failed. Error saved to 'last_error.log' in root."
fi
