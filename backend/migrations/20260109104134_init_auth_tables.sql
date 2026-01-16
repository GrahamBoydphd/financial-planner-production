-- 20260109104134_init_auth_tables.sql

-- 1. Create the Tenants Table (The "Parent" entity)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Update the EXISTING Users Table (Do NOT create it)
-- We add the new columns required for the new Auth system.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 3. Backfill Data (Safety Step)
-- If there are any "Ghost Users" from the old system, give them a default tenant
-- so the NOT NULL constraints don't crash the app later.
DO $$
DECLARE
    default_tenant_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE tenant_id IS NULL) THEN
        -- Create a placeholder tenant
        INSERT INTO tenants (name) VALUES ('Legacy Migration Tenant')
        RETURNING id INTO default_tenant_id;

        -- Assign all orphans to this tenant
        UPDATE users SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    END IF;
END $$;

-- 4. Add Multi-Tenancy to Business Tables
-- We use UUIDs now to match the strict new 'tenants' table.

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

ALTER TABLE funds
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Note: Using 'financial_plans' as defined in 20251207_initial_schema
ALTER TABLE financial_plans
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 5. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_funds_tenant_id ON funds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plans_tenant_id ON financial_plans(tenant_id);
