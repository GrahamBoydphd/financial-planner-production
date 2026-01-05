#!/bin/bash

# 1. Setup Variables
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BRANCH_NAME="ai-fix-$TIMESTAMP"
PROMPT_FILE="ai_prompt_packet.txt"
RESPONSE_FILE="ai_solution.md"

# 2. Parse Arguments
TASK="$1"
shift
TARGET_FILES="$@"

# 3. Create Branch
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout -b "$BRANCH_NAME"
echo "Branch '$BRANCH_NAME' created."

# 4. Generate Solution
echo "Packaging context..."
./pack_context.sh "$TASK" $TARGET_FILES > "$PROMPT_FILE"

if [ $? -ne 0 ]; then
    echo "Packaging failed."
    exit 1
fi

echo "Running Builder..."
python3 builder.py "$PROMPT_FILE" > "$RESPONSE_FILE"

if [ $? -ne 0 ]; then
    echo "Builder failed."
    exit 1
fi

echo "✅ AI response saved to: $RESPONSE_FILE"

# ---------------------------------------------------------
# 5. Interactive Review & Apply (The Missing Part)
# ---------------------------------------------------------

echo "---------------------------------------------------"
echo "Please review '$RESPONSE_FILE' now."
echo "---------------------------------------------------"

# Loop to force a valid Y/N answer
while true; do
    read -p "Do you want to apply these changes to the code? (y/n): " yn
    case $yn in
        [Yy]* ) 
            echo "Applying changes..."
            # Check if apply.py exists
            if [ -f "apply.py" ]; then
                python3 apply.py "$RESPONSE_FILE"
                echo "Done! Check your files."
            else
                echo "Error: 'apply.py' not found. Cannot apply changes automatically."
            fi
            break;;
        [Nn]* ) 
            echo "Skipping application. You can manually apply '$RESPONSE_FILE' later."
            break;;
        * ) echo "Please answer yes or no.";;
    esac
done
