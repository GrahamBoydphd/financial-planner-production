#!/bin/bash
# Save as: pack_context.sh in the root folder

# 1. CONSTANTS
CONTEXT_FILE="ARCHITECTURAL_CONTEXT.md"
ERROR_FILE="last_error.log"
OUTPUT_FILE="ai_prompt_packet.txt"

# 2. CHECK FOR ARCHITECTURE
if [ ! -f "$CONTEXT_FILE" ]; then
    echo "⚠️  Warning: $CONTEXT_FILE not found."
fi

# 3. PARSE PROMPT
PROMPT_MSG="$1"
shift

# 4. BUILD PACKET
echo "Building context packet..."

{
    echo "<system_context>"
    echo "You are an expert Rust/TypeScript developer."
    echo "Strictly follow the architectural guidelines below."
    echo "CRITICAL OUTPUT RULES:"
    echo "1. When providing code, output the FULL FILE content. Do not use placeholders like '// ... rest of code'."
    echo "2. Wrap every file in XML tags: <file path='path/to/file.ext'>FULL CODE</file>."
    echo "</system_context>"
    echo ""
        
    if [ -f "$CONTEXT_FILE" ]; then
        echo "<architectural_guidelines>"
        cat "$CONTEXT_FILE"
        echo "</architectural_guidelines>"
        echo ""
    fi

    echo "<task_instruction>"
    echo "$PROMPT_MSG"
    echo "</task_instruction>"
    echo ""

    # AUTOMATICALLY INCLUDE ERROR LOG IF IT EXISTS
    if [ -f "$ERROR_FILE" ]; then
        echo "<last_build_error>"
        echo "The user attempted to build/run the code and received this error:"
        cat "$ERROR_FILE"
        echo "</last_build_error>"
        echo ""
        echo "NOTE: Focus on fixing the error above based on the source code below."
        echo ""
    fi

    echo "<source_code>"
    for file in "$@"; do
        if [ -f "$file" ]; then
            echo "--- START FILE: $file ---"
            cat "$file"
            echo "--- END FILE: $file ---"
            echo ""
        else
            echo "⚠️  Skipping invalid file: $file" >&2
        fi
    done
    echo "</source_code>"

} > "$OUTPUT_FILE"

echo "✅ Packet created: $OUTPUT_FILE"
if [ -f "$ERROR_FILE" ]; then
    echo "   (Included 'last_error.log' automatically)"
fi
