#!/bin/bash
API_URL="http://localhost:8000/api"

# 1. Login to get Token (Replace credentials if needed)
echo "🔑 Logging in..."
LOGIN_RES=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser", "password":"password123"}')

# Extract Token (Simple parsing)
TOKEN=$(echo $LOGIN_RES | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login Failed: $LOGIN_RES"
  echo "👉 Tip: If 'testuser' doesn't exist, register one first via the UI or a register curl."
  exit 1
fi
echo "✅ Token acquired."

# 2. Get the first Fund ID
echo "📂 Fetching Funds..."
FUNDS_RES=$(curl -s -X GET "$API_URL/funds" -H "Authorization: Bearer $TOKEN")
FUND_ID=$(echo $FUNDS_RES | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)

if [ -z "$FUND_ID" ]; then
  echo "❌ No Funds found. Please create a Fund and Company in the UI first."
  exit 1
fi
echo "✅ Target Fund ID: $FUND_ID"

# 3. 🚀 THE V4 SMOKE TEST
echo "🔥 Running V4 Lockstep Simulation..."
START=$(date +%s)
curl -X POST "$API_URL/funds/$FUND_ID/simulate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
END=$(date +%s)

echo ""
echo "---------------------------------------------------"
echo "⏱️  Simulation Time: $((END-START)) seconds"
