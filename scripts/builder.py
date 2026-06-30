import os
import sys
import argparse
from google import genai
from google.genai import types

def test_api(model_version, api_key):
    """Performs a 1-token pre-flight check to verify model access and quota."""
    client = genai.Client(api_key=api_key)
    try:
        client.models.generate_content(
            model=model_version,
            contents="ping",
            config=types.GenerateContentConfig(max_output_tokens=1)
        )
        print(f"✅ {model_version} is online and quota is available.")
        sys.exit(0)
    except Exception as e:
        error_str = str(e).lower()
        if "404" in error_str or "not found" in error_str:
            print(f"🚨 HALT: Model '{model_version}' is not available to this API key.")
        elif "429" in error_str or "quota" in error_str or "exhausted" in error_str:
            print("🚨 HALT: Quota Exceeded! You have run out of tokens for the day.")
        elif "403" in error_str or "permission" in error_str:
            print("🚨 HALT: Permission Denied. Check API key restrictions.")
        else:
            print(f"🚨 HALT: API Check Failed - {e}")
        sys.exit(1)

def build_code(model_version, api_key, prompt_file, use_thinking):
    """The main architectural builder function."""
    try:
        with open(prompt_file, "r") as f:
            prompt_content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: Could not find file '{prompt_file}'")
        sys.exit(1)
    
    client = genai.Client(api_key=api_key)
    
    # Dynamically inject the thinking config if requested
    config_kwargs = {"temperature": 0.1}
    if use_thinking:
        print(f"🧠 'Thinking' mode activated for {model_version}...")
        config_kwargs["thinking_config"] = types.ThinkingConfig(include_thoughts=True)
    else:
        print(f"🤖 Generating standard response via {model_version}...")

    config = types.GenerateContentConfig(**config_kwargs)
    
    try:
        response = client.models.generate_content_stream(
            model=model_version,
            contents=prompt_content,
            config=config
        )
        
        for chunk in response:
            if chunk.text:
                print(chunk.text, end="", flush=True)
        print("\n")
        
    except Exception as e:
        print(f"\n❌ Generation Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Builder")
    parser.add_argument("--model", type=str, default="gemini-3.1-pro-preview", help="Model to use")
    parser.add_argument("--check", action="store_true", help="Run pre-flight check")
    parser.add_argument("--think", action="store_true", help="Enable reasoning engine")
    parser.add_argument("packet_file", nargs='?', help="Prompt packet file")

    args = parser.parse_args()

    API_KEY = os.environ.get("GOOGLE_API_KEY")
    if not API_KEY:
        print("❌ Error: GOOGLE_API_KEY is missing from your environment.")
        sys.exit(1)

    if args.check:
        test_api(args.model, API_KEY)
    elif args.packet_file:
        build_code(args.model, API_KEY, args.packet_file, args.think)
    else:
        parser.print_help()
        sys.exit(1)
