-- Move pooling_fraction from funds to fund_plans
-- 1. Add the column to fund_plans (default 0.0)
ALTER TABLE fund_plans 
ADD COLUMN pooling_fraction DECIMAL NOT NULL DEFAULT 0.0;

-- 2. Remove the column from funds (cleanup)
ALTER TABLE funds 
DROP COLUMN pooling_fraction;
