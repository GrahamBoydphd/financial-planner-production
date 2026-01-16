#!/bin/bash

# Configuration
# Default to localhost:8000, can be overridden by API_URL env var
API_URL="${API_URL:-http://localhost:8000}"

# Generate a random username to avoid collision on repeated runs
RANDOM_SUFFIX=$(date +%s)
USERNAME="verify_user_${RANDOM_SUFFIX}"
USER_EMAIL="test_${RANDOM_SUFFIX}@example.com"
PASSWORD="Password123!"

echo "========================================"
echo "AUTH VERIFICATION SCRIPT"
echo "Target: $API_URL"
echo "User:   $USERNAME"
echo "Email:  $USER_EMAIL"
echo "========================================"

# Check for jq
if ! command -v jq &> /dev/null; then
    echo "Error: 'jq' is not installed. Please install it to run this script."
    exit 1
fi

# 1. Register User
echo -n "[1/4] Registering User ($USERNAME)... "
REG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"email\": \"$USER_EMAIL\", \"password\": \"$PASSWORD\"}")

if [ $? -ne 0 ]; then
    echo "FAIL (Connection Error)"
    exit 1
fi

REG_BODY=$(echo "$REG_RESPONSE" | head -n -1)
REG_CODE=$(echo "$REG_RESPONSE" | tail -n 1)

if [[ "$REG_CODE" == "200" || "$REG_CODE" == "201" ]]; then
    echo "PASS ($REG_CODE)"
else
    echo "FAIL ($REG_CODE)"
    echo "Response: $REG_BODY"
    exit 1
fi

# 2. Login User
echo -n "[2/4] Logging In... "
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}")

LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)
LOGIN_CODE=$(echo "$LOGIN_RESPONSE" | tail -n 1)

if [[ "$LOGIN_CODE" == "200" ]]; then
    # Extract token
    TOKEN=$(echo "$LOGIN_BODY" | jq -r '.token')

    if [[ "$TOKEN" == "null" || -z "$TOKEN" ]]; then
        echo "FAIL (No token in response)"
        echo "Response: $LOGIN_BODY"
        exit 1
    fi
    echo "PASS"
else
    echo "FAIL ($LOGIN_CODE)"
    echo "Response: $LOGIN_BODY"
    exit 1
fi

# 3. Access Protected Route WITH Token
echo -n "[3/4] Accessing Protected Route (WITH Token)... "
PROTECTED_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/plans" \
  -H "Authorization: Bearer $TOKEN")

PROTECTED_BODY=$(echo "$PROTECTED_RESPONSE" | head -n -1)
PROTECTED_CODE=$(echo "$PROTECTED_RESPONSE" | tail -n 1)

if [[ "$PROTECTED_CODE" == "200" ]]; then
    echo "PASS"
else
    echo "FAIL ($PROTECTED_CODE)"
    echo "Response: $PROTECTED_BODY"
    exit 1
fi

# 4. Access Protected Route WITHOUT Token
echo -n "[4/4] Accessing Protected Route (WITHOUT Token)... "
UNAUTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/plans")

UNAUTH_BODY=$(echo "$UNAUTH_RESPONSE" | head -n -1)
UNAUTH_CODE=$(echo "$UNAUTH_RESPONSE" | tail -n 1)

if [[ "$UNAUTH_CODE" == "401" ]]; then
    echo "PASS"
else
    echo "FAIL (Expected 401, got $UNAUTH_CODE)"
    echo "Response: $UNAUTH_BODY"
    exit 1
fi

echo "========================================"
echo "VERIFICATION SUCCESSFUL"
echo "========================================"
