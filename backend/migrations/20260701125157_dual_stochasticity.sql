-- Add migration script here

-- 1. Create revenue_item_volatility_policies table
CREATE TABLE revenue_item_volatility_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_item_id UUID NOT NULL REFERENCES revenue_items(id) ON DELETE CASCADE,
    mode_name VARCHAR NOT NULL,
    volatility_type VARCHAR NOT NULL,
    vol_min NUMERIC,
    vol_max NUMERIC,
    vol_intervals INT,
    vol_mean NUMERIC,
    vol_scale NUMERIC,
    vol_freedom NUMERIC,
    vol_alpha NUMERIC,
    vol_beta NUMERIC,
    target_mean NUMERIC,
    vol_mu NUMERIC,
    vol_input_mode VARCHAR,
    vol_fatness_level VARCHAR,
    vol_skew_level VARCHAR,
    vol_width_level VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(revenue_item_id, mode_name)
);

-- 2. Create expense_item_volatility_policies table
CREATE TABLE expense_item_volatility_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_item_id UUID NOT NULL REFERENCES expense_items(id) ON DELETE CASCADE,
    mode_name VARCHAR NOT NULL,
    volatility_type VARCHAR NOT NULL,
    vol_min NUMERIC,
    vol_max NUMERIC,
    vol_intervals INT,
    vol_mean NUMERIC,
    vol_scale NUMERIC,
    vol_freedom NUMERIC,
    vol_alpha NUMERIC,
    vol_beta NUMERIC,
    target_mean NUMERIC,
    vol_mu NUMERIC,
    vol_input_mode VARCHAR,
    vol_fatness_level VARCHAR,
    vol_skew_level VARCHAR,
    vol_width_level VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(expense_item_id, mode_name)
);

-- 3. Migrate existing volatility data from revenue_items
INSERT INTO revenue_item_volatility_policies (
    id, revenue_item_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, target_mean, vol_mu,
    vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
)
SELECT
    gen_random_uuid(), id, 'compounding_growth', volatility_type, vol_min, vol_max, vol_intervals,
    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, target_mean, vol_mu,
    vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
FROM revenue_items
WHERE volatility_type IS NOT NULL;

-- 4. Migrate existing volatility data from expense_items
INSERT INTO expense_item_volatility_policies (
    id, expense_item_id, mode_name, volatility_type, vol_min, vol_max, vol_intervals,
    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, target_mean, vol_mu,
    vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
)
SELECT
    gen_random_uuid(), id, 'compounding_growth', volatility_type, vol_min, vol_max, vol_intervals,
    vol_mean, vol_scale, vol_freedom, vol_alpha, vol_beta, target_mean, vol_mu,
    vol_input_mode, vol_fatness_level, vol_skew_level, vol_width_level
FROM expense_items
WHERE volatility_type IS NOT NULL;

-- 5. Drop deprecated columns from revenue_items
ALTER TABLE revenue_items
    DROP COLUMN volatility_type,
    DROP COLUMN vol_min,
    DROP COLUMN vol_max,
    DROP COLUMN vol_intervals,
    DROP COLUMN vol_mean,
    DROP COLUMN vol_scale,
    DROP COLUMN vol_freedom,
    DROP COLUMN vol_alpha,
    DROP COLUMN vol_beta,
    DROP COLUMN target_mean,
    DROP COLUMN vol_mu,
    DROP COLUMN vol_input_mode,
    DROP COLUMN vol_fatness_level,
    DROP COLUMN vol_skew_level,
    DROP COLUMN vol_width_level;

-- 6. Drop deprecated columns from expense_items
ALTER TABLE expense_items
    DROP COLUMN volatility_type,
    DROP COLUMN vol_min,
    DROP COLUMN vol_max,
    DROP COLUMN vol_intervals,
    DROP COLUMN vol_mean,
    DROP COLUMN vol_scale,
    DROP COLUMN vol_freedom,
    DROP COLUMN vol_alpha,
    DROP COLUMN vol_beta,
    DROP COLUMN target_mean,
    DROP COLUMN vol_mu,
    DROP COLUMN vol_input_mode,
    DROP COLUMN vol_fatness_level,
    DROP COLUMN vol_skew_level,
    DROP COLUMN vol_width_level;
