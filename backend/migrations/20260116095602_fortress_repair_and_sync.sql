-- 1. Standardize Event Shocks (Rename if 'name' still exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_shocks' AND column_name='name') THEN
        ALTER TABLE event_shocks RENAME COLUMN name TO event_name;
    END IF;
END $$;

-- 2. Add 'created_at' and enforce NOT NULL for core tables
-- This resolves the "trait bound DateTime<Utc>: From<Option...>" errors
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    AND table_name IN ('revenue_items', 'expense_items', 'capital_injections', 'dividend_policies', 'credit_facilities', 'valuation_assumptions', 'event_shocks')
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()', t);
        EXECUTE format('UPDATE %I SET created_at = NOW() WHERE created_at IS NULL', t);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at SET NOT NULL', t);
    END LOOP;
END $$;

-- 3. Standardize Credit Facility naming (resolves 'limit_amount' mismatch)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_facilities' AND column_name='limit_amount') THEN
        ALTER TABLE credit_facilities RENAME COLUMN limit_amount TO facility_limit;
    END IF;
END $$;
