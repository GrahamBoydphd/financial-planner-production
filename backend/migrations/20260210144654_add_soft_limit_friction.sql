-- Add Soft Limit (Friction Tax) settings to Funds (Global Default)
ALTER TABLE funds 
ADD COLUMN default_soft_limit_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN default_soft_limit_threshold NUMERIC NOT NULL DEFAULT 10000000000.0, -- 10 Billion
ADD COLUMN default_soft_limit_fraction NUMERIC NOT NULL DEFAULT 0.70;         -- 70%

-- Add Soft Limit (Friction Tax) settings to Financial Plans (Simulation Unit)
ALTER TABLE financial_plans
ADD COLUMN soft_limit_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN soft_limit_threshold NUMERIC NOT NULL DEFAULT 10000000000.0,
ADD COLUMN soft_limit_fraction NUMERIC NOT NULL DEFAULT 0.70;
