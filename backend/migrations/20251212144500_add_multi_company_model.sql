-- V3__add_multi_company_model.sql

-- 1. Create Funds Table
CREATE TABLE funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Companies Table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Insert Default Data (To handle existing plans safely)
INSERT INTO funds (id, user_id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Default Fund');

INSERT INTO companies (id, fund_id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Default Company');

-- 4. Alter Financial Plans Table
-- Add column as nullable first
ALTER TABLE financial_plans ADD COLUMN company_id UUID;

-- Backfill existing rows with the Default Company ID
UPDATE financial_plans SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- Make it NOT NULL and add Foreign Key
ALTER TABLE financial_plans ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE financial_plans ADD CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES companies(id);

-- Drop the old user_id column
ALTER TABLE financial_plans DROP COLUMN user_id;
