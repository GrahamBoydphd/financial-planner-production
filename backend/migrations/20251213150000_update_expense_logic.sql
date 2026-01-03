-- V4__update_expense_logic.sql

-- Rename the column to reflect generic growth (monthly)
ALTER TABLE expense_items 
RENAME COLUMN annual_increase_percent TO growth_rate_percent;

-- Ensure it defaults to 0 if null (safety)
ALTER TABLE expense_items 
ALTER COLUMN growth_rate_percent SET DEFAULT 0;
