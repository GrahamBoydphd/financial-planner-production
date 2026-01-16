-- Enforce tenant_id strictness via PL/pgSQL block
DO $$
DECLARE
    legacy_tenant_id UUID;
BEGIN
    -- 1) Select 'Legacy Migration Tenant' ID (or create if missing)
    SELECT id INTO legacy_tenant_id
    FROM tenants
    WHERE name = 'Legacy Migration Tenant'
    LIMIT 1;

    IF legacy_tenant_id IS NULL THEN
        -- Create the legacy tenant if it doesn't exist
        -- We assume the tenants table has id, name, and created_at columns
        INSERT INTO tenants (id, name, created_at)
        VALUES (gen_random_uuid(), 'Legacy Migration Tenant', NOW())
        RETURNING id INTO legacy_tenant_id;
    END IF;

    -- 2) UPDATE 'funds', 'companies', and 'financial_plans' to set 'tenant_id'
    UPDATE funds
    SET tenant_id = legacy_tenant_id
    WHERE tenant_id IS NULL;

    UPDATE companies
    SET tenant_id = legacy_tenant_id
    WHERE tenant_id IS NULL;

    UPDATE financial_plans
    SET tenant_id = legacy_tenant_id
    WHERE tenant_id IS NULL;

    -- 3) ALTER these tables to set 'tenant_id' to NOT NULL
    -- We use EXECUTE because ALTER TABLE is a DDL statement
    EXECUTE 'ALTER TABLE funds ALTER COLUMN tenant_id SET NOT NULL';
    EXECUTE 'ALTER TABLE companies ALTER COLUMN tenant_id SET NOT NULL';
    EXECUTE 'ALTER TABLE financial_plans ALTER COLUMN tenant_id SET NOT NULL';
END $$;
