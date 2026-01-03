-- Migration: Add Cascade Delete to Financial Plans

-- Note: The 'companies' table already has ON DELETE CASCADE defined in its creation,
-- so we only need to fix the 'financial_plans' table.

ALTER TABLE financial_plans
DROP CONSTRAINT IF EXISTS fk_company;

ALTER TABLE financial_plans
ADD CONSTRAINT fk_company
    FOREIGN KEY (company_id)
    REFERENCES companies(id)
    ON DELETE CASCADE;
