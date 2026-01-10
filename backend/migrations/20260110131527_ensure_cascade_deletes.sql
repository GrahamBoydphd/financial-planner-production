-- Migration: Ensure Cascade Deletes
-- Description: Updates foreign key constraints to enforce ON DELETE CASCADE across the hierarchy.
-- This ensures that deleting a Fund, Company, or Plan automatically cleans up all related child records.

-- 1. Funds -> Companies
ALTER TABLE companies 
    DROP CONSTRAINT IF EXISTS companies_fund_id_fkey,
    ADD CONSTRAINT companies_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES funds(id) ON DELETE CASCADE;

-- 2. Companies -> Financial Plans
ALTER TABLE financial_plans 
    DROP CONSTRAINT IF EXISTS financial_plans_company_id_fkey,
    ADD CONSTRAINT financial_plans_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- 3. Financial Plans -> Revenue Items
ALTER TABLE revenue_items 
    DROP CONSTRAINT IF EXISTS revenue_items_plan_id_fkey,
    ADD CONSTRAINT revenue_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES financial_plans(id) ON DELETE CASCADE;

-- 4. Financial Plans -> Expense Items
ALTER TABLE expense_items 
    DROP CONSTRAINT IF EXISTS expense_items_plan_id_fkey,
    ADD CONSTRAINT expense_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES financial_plans(id) ON DELETE CASCADE;

-- 5. Financial Plans -> Staffing Roles
ALTER TABLE staffing_roles 
    DROP CONSTRAINT IF EXISTS staffing_roles_plan_id_fkey,
    ADD CONSTRAINT staffing_roles_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES financial_plans(id) ON DELETE CASCADE;

-- 6. Financial Plans -> Capital Injections
ALTER TABLE capital_injections 
    DROP CONSTRAINT IF EXISTS capital_injections_plan_id_fkey,
    ADD CONSTRAINT capital_injections_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES financial_plans(id) ON DELETE CASCADE;
