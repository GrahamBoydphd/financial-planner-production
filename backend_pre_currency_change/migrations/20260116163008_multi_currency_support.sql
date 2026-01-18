-- 1. Add Currency to Fund (Portfolio Level)
ALTER TABLE funds ADD COLUMN IF NOT EXISTS currency_code CHAR(3) NOT NULL DEFAULT 'USD';

-- 2. Add Currency to Company (Entity/Legal Level)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency_code CHAR(3) NOT NULL DEFAULT 'USD';

-- 3. Add Currency to Financial Plans (Operational/Projection Level)
ALTER TABLE financial_plans ADD COLUMN IF NOT EXISTS currency_code CHAR(3) NOT NULL DEFAULT 'USD';

-- 4. Create Exchange Rates Table for V3 Consolidation
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency CHAR(3) NOT NULL,
    to_currency CHAR(3) NOT NULL,
    rate DECIMAL(20,6) NOT NULL,
    rate_month DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID NOT NULL REFERENCES tenants(id)
);
