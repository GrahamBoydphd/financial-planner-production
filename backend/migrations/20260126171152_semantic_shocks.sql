-- Rename Table
ALTER TABLE IF EXISTS event_shocks RENAME TO events;

-- Rename Columns
DO $$
BEGIN
   IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='events' AND column_name='shock_name') THEN
       ALTER TABLE events RENAME COLUMN shock_name TO event_name;
   END IF;
   IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='events' AND column_name='name') THEN
       ALTER TABLE events RENAME COLUMN name TO event_name;
   END IF;
   IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='events' AND column_name='shock_month') THEN
       ALTER TABLE events RENAME COLUMN shock_month TO start_month;
   END IF;
   IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='events' AND column_name='shock_category') THEN
       ALTER TABLE events RENAME COLUMN shock_category TO event_category;
   END IF;
END $$;

-- Add Scope Columns
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES funds(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Relax plan_id constraint
ALTER TABLE events ALTER COLUMN plan_id DROP NOT NULL;

-- Add Constraint: Must have at least one target
ALTER TABLE events DROP CONSTRAINT IF EXISTS event_scope_check;
ALTER TABLE events ADD CONSTRAINT event_scope_check 
CHECK (plan_id IS NOT NULL OR fund_id IS NOT NULL OR company_id IS NOT NULL);

-- Add Semantic Columns
ALTER TABLE events
ADD COLUMN IF NOT EXISTS event_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS likelihood_annual_pct DECIMAL,
ADD COLUMN IF NOT EXISTS magnitude VARCHAR(50),
ADD COLUMN IF NOT EXISTS direction VARCHAR(50),
ADD COLUMN IF NOT EXISTS duration_category VARCHAR(50);

-- Cleanup Numeric Columns
ALTER TABLE events
DROP COLUMN IF EXISTS severity,
DROP COLUMN IF EXISTS volatility_type,
DROP COLUMN IF EXISTS vol_mean,
DROP COLUMN IF EXISTS vol_scale,
DROP COLUMN IF EXISTS vol_min,
DROP COLUMN IF EXISTS vol_max,
DROP COLUMN IF EXISTS vol_intervals,
DROP COLUMN IF EXISTS vol_freedom,
DROP COLUMN IF EXISTS vol_alpha,
DROP COLUMN IF EXISTS vol_beta;
