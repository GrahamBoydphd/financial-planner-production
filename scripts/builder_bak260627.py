import os
import sys
from google import genai
from google.genai import types

# --- CONFIGURATION ---
# The premium, paid model. Requires billing enabled in AI Studio.
MODEL_VERSION = "gemini-3-pro-preview" 

API_KEY = os.environ.get("GOOGLE_API_KEY")

if not API_KEY:
    print("❌ Error: GOOGLE_API_KEY is empty.")
    sys.exit(1)

def build_code(prompt_file):
    # 1. Import Check
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("❌ Error: 'google-genai' library not found.")
        print("   Run: pip install google-genai")
        sys.exit(1)

    # 2. Read Packet
    try:
        with open(prompt_file, "r") as f:
            prompt_content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: Could not find file '{prompt_file}'")
        sys.exit(1)
    
    # 3. Initialize Client
    client = genai.Client(api_key=API_KEY)

    print(f"🤖 Connecting to {MODEL_VERSION} (Paid Tier)...")
    
    try:
        # 4. Stream Response with "Thinking" (Gemini 3 Feature)
        # We enable 'thinking' to let the model reason before writing code.
        response = client.models.generate_content_stream(
            model=MODEL_VERSION,
            contents=prompt_content,
            config=types.GenerateContentConfig(
                temperature=0.1, 
                # thinking_config=types.ThinkingConfig(include_thoughts=False) # Optional: uncomment to hide thought process
            )
        )
        
        for chunk in response:
            if chunk.text:
                print(chunk.text, end="", flush=True)
        print("\n")
        
    except Exception as e:
        print(f"\n❌ API Error: {e}")
        if "429" in str(e):
            print("   (Check: Did you enable Pay-As-You-Go billing in AI Studio?)")
        if "403" in str(e):
            print("   (Check: Is your API Key valid and linked to the billed project?)")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: python3 builder.py <packet_file>")
        sys.exit(1)
    
    build_code(sys.argv[1])
