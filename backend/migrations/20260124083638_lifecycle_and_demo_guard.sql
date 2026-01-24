-- Idempotent Migration: Lifecycle and Demo Guard
-- Handles 'Ghost' file conflicts by checking existence before modification.

DO $$
BEGIN
    -- 1. Check if the column 'is_public_template' exists on 'funds'
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'funds'
        AND column_name = 'is_public_template'
    ) THEN
        -- Case A: Column exists. Sanitize it.
        -- 1. Fix any NULLs
        UPDATE funds SET is_public_template = FALSE WHERE is_public_template IS NULL;
        -- 2. Enforce Default
        ALTER TABLE funds ALTER COLUMN is_public_template SET DEFAULT FALSE;
        -- 3. Enforce Not Null
        ALTER TABLE funds ALTER COLUMN is_public_template SET NOT NULL;
    ELSE
        -- Case B: Column does not exist. Create it.
        ALTER TABLE funds ADD COLUMN is_public_template BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- 2. Index for performance (The "Library" View)
-- Uses IF NOT EXISTS to prevent errors on re-runs
CREATE INDEX IF NOT EXISTS idx_funds_public_template ON funds(is_public_template) WHERE is_public_template = TRUE;

-- 3. The Ironclad Guard Function
-- CREATE OR REPLACE handles idempotency for functions
CREATE OR REPLACE FUNCTION guard_public_templates()
RETURNS TRIGGER AS $$
BEGIN
    -- ⚠️ SECURITY: REPLACE THIS UUID WITH YOUR ACTUAL DEMO ADMIN TENANT ID ⚠️
    -- Logic: Only the specific Demo Admin Tenant can set is_public_template = TRUE
    IF NEW.is_public_template = TRUE AND NEW.tenant_id != '00000000-0000-0000-0000-000000000000'::uuid THEN
        RAISE EXCEPTION 'Security Violation: Only the designated Demo Admin can publish templates.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. The Trigger
-- Drop first to ensure clean state, then recreate
DROP TRIGGER IF EXISTS enforce_template_security ON funds;

CREATE TRIGGER enforce_template_security
BEFORE INSERT OR UPDATE ON funds
FOR EACH ROW
EXECUTE FUNCTION guard_public_templates();
