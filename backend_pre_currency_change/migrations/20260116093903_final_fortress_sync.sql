-- 1. Add missing created_at columns required by plans.rs queries
ALTER TABLE revenue_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE expense_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE capital_injections ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dividend_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE credit_facilities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE valuation_assumptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Standardize Credit Facility naming if not already done
-- Previous errors showed limit_amount was missing; rename it to facility_limit
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_facilities' AND column_name='limit_amount') THEN
        ALTER TABLE credit_facilities RENAME COLUMN limit_amount TO facility_limit;
    END IF;
END $$;
