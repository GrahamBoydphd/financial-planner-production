-- Up: Convert single target IDs to Arrays
ALTER TABLE events 
DROP COLUMN IF EXISTS fund_id,
DROP COLUMN IF EXISTS company_id;

ALTER TABLE events 
ADD COLUMN fund_ids UUID[] DEFAULT '{}',
ADD COLUMN company_ids UUID[] DEFAULT '{}';

-- Update the scope check to ensure at least one target is defined
ALTER TABLE events DROP CONSTRAINT IF EXISTS event_scope_check;
ALTER TABLE events ADD CONSTRAINT event_scope_check 
CHECK (plan_id IS NOT NULL OR array_length(fund_ids, 1) > 0 OR array_length(company_ids, 1) > 0);
