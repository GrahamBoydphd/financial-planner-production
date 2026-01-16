-- 1. Add the standardized column
ALTER TABLE capital_growth_policies
ADD COLUMN IF NOT EXISTS growth_rate_percent DECIMAL NOT NULL DEFAULT 0;

-- 2. Data Migration: Move existing Mean values from vol_mean to the new column
UPDATE capital_growth_policies
SET growth_rate_percent = vol_mean
WHERE vol_mean IS NOT NULL;
