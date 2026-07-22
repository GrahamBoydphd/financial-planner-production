-- Add migration script here
ALTER TABLE revenue_items ADD COLUMN trigger_threshold TEXT;
ALTER TABLE revenue_items ADD COLUMN trigger_operator TEXT;

ALTER TABLE expense_items ADD COLUMN trigger_threshold TEXT;
ALTER TABLE expense_items ADD COLUMN trigger_operator TEXT;
