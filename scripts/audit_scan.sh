#!/bin/bash

# 🛡️ Fortress Standard Zero-Defect Scanner
# Date: 2026-01-16
# Purpose: Identifies f64 drift, SELECT * wildcards, and improper SQL comments.

echo "🔍 Starting Fortress Standard Audit..."
echo "---------------------------------------"

# 1. Search for forbidden f64 types in financial logic
echo "Checking for forbidden 'f64' in handlers and projection engine..."
grep -r "f64" backend/src/handlers/ backend/src/projection.rs | grep -v "external_lib" 
if [ $? -eq 0 ]; then
    echo "❌ FAIL: f64 instances found. Replace with rust_decimal::Decimal."
else
    echo "✅ PASS: No f64 instances found."
fi

echo ""

# 2. Search for SQL wildcards
echo "Checking for 'SELECT *' in SQL queries..."
grep -r "SELECT \*" . --include="*.rs" --include="*.sql"
if [ $? -eq 0 ]; then
    echo "❌ FAIL: SELECT * found. Every query must explicitly list columns."
else
    echo "✅ PASS: No SELECT * instances found."
fi

echo ""

# 3. Check for naming scope (Simple 'name' keys)
echo "Checking for unscoped 'name' fields..."
# Look for fields named exactly "name" in JSON or Struct definitions
grep -r "\"name\":" . --include="*.rs" --include="*.json"
grep -r " name:" . --include="*.rs"
if [ $? -eq 0 ]; then
    echo "❌ FAIL: Unscoped 'name' fields found. Use 'entity_name' (e.g., role_name)."
else
    echo "✅ PASS: All names appear scoped."
fi

echo ""

# 4. Check for Percent Naming/Format
echo "Checking for growth/rate fields missing '_percent' suffix..."
grep -r "growth_rate" . | grep -v "_percent"
if [ $? -eq 0 ]; then
    echo "⚠️  WARNING: Found 'growth_rate' without '_percent' suffix."
else
    echo "✅ PASS: Growth fields follow naming convention."
fi

echo ""

# 5. Check for improper SQL comment syntax
echo "Checking for '#' comments in SQL/Rust literals..."
grep -r "# " . --include="*.sql"
if [ $? -eq 0 ]; then
    echo "❌ FAIL: '#' found in SQL files. Replace with '--'."
else
    echo "✅ PASS: SQL comments are valid."
fi

echo "---------------------------------------"
echo "Audit Complete."
