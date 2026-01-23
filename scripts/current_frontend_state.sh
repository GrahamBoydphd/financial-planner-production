#!/bin/bash
outfile="current_frontend_state.txt"
echo "=== FRONTEND STATE DUMP $(date) ===" > $outfile

# Function to safely append file content with a header
append_file() {
    find frontend/app frontend/lib -name "$1" | sort | while read file; do
        echo "========================================" >> $outfile
        echo "PATH: $file" >> $outfile
        echo "========================================" >> $outfile
        cat "$file" >> $outfile
        echo -e "\n\n" >> $outfile
    done
}

# 1. The Core Route Files (handling params and layout)
append_file "page.tsx"
append_file "layout.tsx"

# 2. The Client Components (where the actual UI logic lives)
append_file "ClientPage.tsx"

# 3. The Data Contract (Critical for the Architect)
append_file "api.ts"

echo "Dump complete. Please upload $outfile"
