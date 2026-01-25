-- Add the insolvency_threshold column with a default of 100.0
ALTER TABLE financial_plans 
ADD COLUMN insolvency_threshold DECIMAL NOT NULL DEFAULT 100.0;
