-- 1. Add IMT Classification to Companies (Point 2 & 5)
ALTER TABLE companies
ADD COLUMN industry TEXT,
ADD COLUMN business_model TEXT,
ADD COLUMN technology TEXT;

-- 2. Add Cost of Revenue to Revenue Items (Point 3)
ALTER TABLE revenue_items
ADD COLUMN cost_of_revenue_percent DECIMAL;

-- 3. Create Capital Injections Table (Point 6)
CREATE TABLE capital_injections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    month INTEGER NOT NULL
);

-- 4. Create Dividend Policy Table (Point 4 & 7)
CREATE TABLE dividend_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    safety_threshold DECIMAL NOT NULL DEFAULT 0,
    payout_ratio DECIMAL NOT NULL DEFAULT 0
);

-- 5. Create Credit Facility Table (Point 5 & 10)
CREATE TABLE credit_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    facility_limit DECIMAL NOT NULL DEFAULT 0,
    interest_rate DECIMAL NOT NULL DEFAULT 0,
    is_annual_rate BOOLEAN NOT NULL DEFAULT TRUE
);
