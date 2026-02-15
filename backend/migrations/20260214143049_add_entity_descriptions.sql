-- Add description fields for Templates and User Context
-- Using TEXT to allow for ~200 words (approx 1000-1500 chars) comfortably.

ALTER TABLE funds 
ADD COLUMN description TEXT;

ALTER TABLE companies 
ADD COLUMN description TEXT;

ALTER TABLE financial_plans 
ADD COLUMN description TEXT;
