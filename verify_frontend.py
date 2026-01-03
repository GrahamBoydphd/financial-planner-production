from playwright.sync_api import sync_playwright
import time

def verify_inputs_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Navigate to the inputs page with a dummy plan ID
        # The backend is likely down or unreachable, so we expect "Plan not found" or similar
        # But we want to ensure it renders that message and not a white screen of death
        try:
            page.goto("http://localhost:3000/plan/dummy-id/inputs", timeout=10000)
        except Exception as e:
            print(f"Navigation failed: {e}")
        
        # Wait a bit for the error message to render
        time.sleep(2)
        
        # Take a screenshot
        page.screenshot(path="verification.png")
        print("Screenshot taken")
        
        browser.close()

if __name__ == "__main__":
    verify_inputs_page()
