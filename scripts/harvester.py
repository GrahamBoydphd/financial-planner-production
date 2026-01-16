# Save as: scripts/harvester.py
import os, sys
from google import genai

# Using the identifier for the stable Flash 2.0 model
MODEL_ID = "gemini-2.0-flash"

API_KEY = os.environ.get("GOOGLE_API_KEY")

def harvest():
    if not API_KEY:
        print("❌ Error: GOOGLE_API_KEY not found in environment.")
        sys.exit(1)

    try:
        with open("./scripts/harvest_packet.txt", "r") as f:
            content = f.read()
    except FileNotFoundError:
        print("❌ Error: harvest_packet.txt not found. Run harvest_docs.sh first.")
        sys.exit(1)

    client = genai.Client(api_key=API_KEY)

    print(f"🤖 Analyzing code using {MODEL_ID}...")

    prompt = f"""
    You are a Technical Writer. Based on the source code provided below, generate a comprehensive
    Markdown file titled 'USER_MANUAL_TECHNICAL_REF.md'.

    Structure it by:
    1. Input Field Glossary (Label, Purpose, Validation rules).
    2. Simulation Parameters (Explain NRIG, Student-T, and Flat models based on the code logic).
    3. UI Logic (Explain how fields like 'Student/Individual' bypass work).

    CODE CONTEXT:
    {content}
    """

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt
        )

        # Ensure the directory exists
        os.makedirs("./docs", exist_ok=True)

        with open("./docs/USER_MANUAL_TECHNICAL_REF.md", "w") as f:
            f.write(response.text)

        print("✅ Success! File saved to: ./docs/USER_MANUAL_TECHNICAL_REF.md")
    except Exception as e:
        print(f"❌ API Error: {e}")

if __name__ == "__main__":
    harvest()
