-- Upgrading Staffing Roles to Sophisticated Model

-- 1. Rename 'count' to 'target_count' if it exists, otherwise create it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staffing_roles' AND column_name='count') THEN
        ALTER TABLE staffing_roles RENAME COLUMN count TO target_count;
    END IF;
END $$;

-- 2. Add new columns for hiring ramps and inflation
ALTER TABLE staffing_roles 
ADD COLUMN IF NOT EXISTS hiring_plan TEXT NOT NULL DEFAULT 'fixed_count',
ADD COLUMN IF NOT EXISTS hiring_rate INT, -- Nullable, used if plan is monthly_rate
ADD COLUMN IF NOT EXISTS annual_increase DECIMAL NOT NULL DEFAULT 0.0;
