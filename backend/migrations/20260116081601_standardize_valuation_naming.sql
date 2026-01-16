-- Migration: Standardize Valuation Naming
ALTER TABLE valuation_assumptions
RENAME COLUMN name TO valuation_name;
