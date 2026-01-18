-- V2__financial_data_models.sql

-- Revenue Items
CREATE TABLE revenue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    -- CRITICAL CHANGE: These must be INTEGER (relative months), not DATE
    start_month INTEGER NOT NULL,
    end_month INTEGER,
    initial_amount DECIMAL NOT NULL,
    growth_rate_percent DECIMAL NOT NULL,
    frequency TEXT NOT NULL
);

-- Expense Items
CREATE TABLE expense_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    -- CRITICAL CHANGE: These must be INTEGER
    start_month INTEGER NOT NULL,
    end_month INTEGER,
    initial_amount DECIMAL NOT NULL,
    annual_increase_percent DECIMAL NOT NULL,
    frequency TEXT NOT NULL,
    pct_of_revenue DECIMAL
);

-- Valuation Assumptions
CREATE TABLE valuation_assumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    multiplier DECIMAL NOT NULL,
    date_applied DATE
);

-- Event Shocks
CREATE TABLE event_shocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    -- CRITICAL CHANGE: Must be INTEGER
    shock_month INTEGER NOT NULL,
    impact_type TEXT NOT NULL,
    impact_value DECIMAL NOT NULL,
    duration_months INTEGER
);

CREATE TABLE capital_growth_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    
    volatility_type TEXT CHECK (volatility_type IN ('none', 'flat', 'student_t', 'nrig')),
    
    -- Parameters
    vol_min DECIMAL,
    vol_max DECIMAL,
    vol_intervals INTEGER,
    vol_mean DECIMAL,
    vol_scale DECIMAL,
    vol_freedom DECIMAL,
    vol_alpha DECIMAL,
    vol_beta DECIMAL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure 1 policy per plan
CREATE UNIQUE INDEX idx_capital_growth_plan ON capital_growth_policies(plan_id);
