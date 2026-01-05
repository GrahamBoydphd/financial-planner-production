import sys
import re
import os

def apply_changes(response_file):
    try:
        with open(response_file, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: File '{response_file}' not found.")
        sys.exit(1)

    # Regex to find <file path="...">content</file>
    # flags=re.DOTALL allows matching across newlines
    pattern = re.compile(r'<file path=[\'"](.*?)[\'"]>(.*?)</file>', re.DOTALL)
    matches = pattern.findall(content)

    if not matches:
        print("⚠️  No XML <file> tags found in response.")
        print("   (Did the AI follow the output format rules?)")
        sys.exit(0)

    print(f"🔍 Found {len(matches)} file(s) to update.")

    for file_path, file_content in matches:
        # Clean up: Remove leading/trailing newlines from the content
        # This handles the newline usually present after <file ...>
        clean_content = file_content.strip() + "\n"
        
        # Security: Ensure we aren't writing outside the repo
        if ".." in file_path or file_path.startswith("/"):
            print(f"⛔ SKIPPING suspicious path: {file_path}")
            continue

        # Ensure directory exists (only if file is in a subdirectory)
        directory = os.path.dirname(file_path)
        if directory:
            os.makedirs(directory, exist_ok=True)

        print(f"📝 Writing to: {file_path}")
        with open(file_path, 'w') as f:
            f.write(clean_content)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 apply.py <response_file>")
        sys.exit(1)
    
    apply_changes(sys.argv[1])
