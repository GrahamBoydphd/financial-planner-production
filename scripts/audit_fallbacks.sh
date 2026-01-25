#!/bin/bash

echo "🔍 STARTING AUDIT: Seeking Misleading Deterministic Fallbacks..."
echo "=============================================================="

# Define the search terms
TERMS="deterministic_data|detRows|deterministic_value|mode === 'standard'|values\["

# Directories to search
DIRS="frontend/app frontend/components frontend/lib"

# Run the search
# -n: line number
# -r: recursive
# -E: extended regex
# -C 2: show 2 lines of context around the match for better understanding

grep -rnE -C 2 "$TERMS" $DIRS > audit_results.txt

echo "✅ Audit complete. Results saved to 'audit_results.txt'."
echo "--------------------------------------------------------------"
echo "PREVIEW OF SUSPICIOUS HITS (First 20 lines):"
head -n 20 audit_results.txt
echo "..."
echo "--------------------------------------------------------------"
