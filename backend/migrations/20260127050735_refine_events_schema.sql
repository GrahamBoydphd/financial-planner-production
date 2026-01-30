-- 1. Ensure Table Exists (Handle Rename vs Create)
DO $$
BEGIN
    -- If 'events' already exists, do nothing regarding table name.
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
        RAISE NOTICE 'Table events already exists.';
    -- If 'event_shocks' exists, rename it.
    ELSIF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_shocks') THEN
        ALTER TABLE event_shocks RENAME TO events;
    -- If neither exists, create 'events' from scratch (Safety Net).
    ELSE
        CREATE TABLE events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    END IF;
END $$;

-- 2. Ensure Columns Exist (Idempotent Add/Rename)
-- We now strictly operate on 'events' which is guaranteed to exist.
DO $$
BEGIN
   -- Handle Column Renames safely
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

-- 3. Add Missing Columns (Safe 'IF NOT EXISTS')
ALTER TABLE events ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES funds(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES financial_plans(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_category VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_month INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS impact_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS impact_value DECIMAL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_months INTEGER;

-- 4. Semantic Columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS likelihood_annual_pct DECIMAL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS magnitude VARCHAR(50);
ALTER TABLE events ADD COLUMN IF NOT EXISTS direction VARCHAR(50);
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_category VARCHAR(50);

-- 5. Relax Constraints (Safe 'DROP NOT NULL')
ALTER TABLE events ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE events ALTER COLUMN start_month DROP NOT NULL;
ALTER TABLE events ALTER COLUMN impact_value DROP NOT NULL;
ALTER TABLE events ALTER COLUMN impact_type DROP NOT NULL;
ALTER TABLE events ALTER COLUMN duration_months DROP NOT NULL;

-- 6. Clean up old numeric columns
ALTER TABLE events DROP COLUMN IF EXISTS severity;
ALTER TABLE events DROP COLUMN IF EXISTS volatility_type;
ALTER TABLE events DROP COLUMN IF EXISTS vol_mean;
ALTER TABLE events DROP COLUMN IF EXISTS vol_scale;
ALTER TABLE events DROP COLUMN IF EXISTS vol_min;
ALTER TABLE events DROP COLUMN IF EXISTS vol_max;
ALTER TABLE events DROP COLUMN IF EXISTS vol_intervals;
ALTER TABLE events DROP COLUMN IF EXISTS vol_freedom;
ALTER TABLE events DROP COLUMN IF EXISTS vol_alpha;
ALTER TABLE events DROP COLUMN IF EXISTS vol_beta;

-- 7. Update Constraints
ALTER TABLE events DROP CONSTRAINT IF EXISTS event_scope_check;
ALTER TABLE events ADD CONSTRAINT event_scope_check 
CHECK (plan_id IS NOT NULL OR fund_id IS NOT NULL OR company_id IS NOT NULL);
