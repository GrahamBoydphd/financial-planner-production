-- Add the tenant_id column to enforce multi-tenancy security
ALTER TABLE fund_plans 
ADD COLUMN tenant_id UUID NOT NULL;

-- Index for performance and security filtering
CREATE INDEX idx_fund_plans_tenant_id ON fund_plans(tenant_id);
