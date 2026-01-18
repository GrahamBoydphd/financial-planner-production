DROP TABLE IF EXISTS staffing_roles;

CREATE TABLE staffing_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    role_name VARCHAR(255) NOT NULL,
    annual_salary DECIMAL NOT NULL,
    start_month INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    annual_increase DECIMAL NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
