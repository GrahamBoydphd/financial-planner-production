-- Add explicit columns for User Intent (Target Mean) vs Engine Parameter (Mu)
-- This resolves ambiguity for skewed distributions like NRIG.

-- 1. Update Revenue Items
ALTER TABLE revenue_items
ADD COLUMN IF NOT EXISTS target_mean DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS vol_mu DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS vol_input_mode TEXT DEFAULT 'simple',
ADD COLUMN IF NOT EXISTS vol_fatness_level TEXT,
ADD COLUMN IF NOT EXISTS vol_skew_level TEXT,
ADD COLUMN IF NOT EXISTS vol_width_level TEXT;

-- Data Migration: Preserve existing behavior by treating old mean as both target and location
UPDATE revenue_items SET target_mean = vol_mean, vol_mu = vol_mean;


-- 2. Update Expense Items
ALTER TABLE expense_items
ADD COLUMN IF NOT EXISTS target_mean DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS vol_mu DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS vol_input_mode TEXT DEFAULT 'simple',
ADD COLUMN IF NOT EXISTS vol_fatness_level TEXT,
ADD COLUMN IF NOT EXISTS vol_skew_level TEXT,
ADD COLUMN IF NOT EXISTS vol_width_level TEXT;

UPDATE expense_items SET target_mean = vol_mean, vol_mu = vol_mean;


-- 3. Update Capital Growth Policies
ALTER TABLE capital_growth_policies
ADD COLUMN IF NOT EXISTS target_mean DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS vol_mu DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS vol_input_mode TEXT DEFAULT 'simple',
ADD COLUMN IF NOT EXISTS vol_fatness_level TEXT,
ADD COLUMN IF NOT EXISTS vol_skew_level TEXT,
ADD COLUMN IF NOT EXISTS vol_width_level TEXT;

UPDATE capital_growth_policies SET target_mean = vol_mean, vol_mu = vol_mean;

-- Note: We intentionally leave 'vol_mean' in place for now to prevent immediate breakage,
-- but the code will switch to using 'target_mean' and 'vol_mu'.
