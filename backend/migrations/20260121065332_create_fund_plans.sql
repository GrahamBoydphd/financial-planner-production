CREATE TABLE IF NOT EXISTS fund_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    plan_name VARCHAR(255) NOT NULL,
    selected_plans JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fund_plans_fund_id ON fund_plans(fund_id);
