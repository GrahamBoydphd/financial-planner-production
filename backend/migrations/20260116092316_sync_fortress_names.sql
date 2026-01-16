-- Standardize Event Shocks
ALTER TABLE event_shocks RENAME COLUMN name TO event_name;

-- Ensure all tables have created_at if requested
-- (Adding IF NOT EXISTS logic where applicable)
ALTER TABLE dividend_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
