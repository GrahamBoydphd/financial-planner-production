-- 1. Add trigger_strategy to primary shell tables
ALTER TABLE revenue_items ADD COLUMN trigger_strategy VARCHAR(50) NOT NULL DEFAULT 'time_based';
ALTER TABLE expense_items ADD COLUMN trigger_strategy VARCHAR(50) NOT NULL DEFAULT 'time_based';

-- 2. Create the Relational Phase Tables
CREATE TABLE revenue_item_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_item_id UUID NOT NULL REFERENCES revenue_items(id) ON DELETE CASCADE,
    phase_sequence INT NOT NULL,
    trigger_month INT,
    trigger_threshold VARCHAR(255),
    trigger_operator VARCHAR(50),
    growth_rate_percent VARCHAR(255) NOT NULL,
    cost_of_revenue_percent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(revenue_item_id, phase_sequence)
);

CREATE TABLE expense_item_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_item_id UUID NOT NULL REFERENCES expense_items(id) ON DELETE CASCADE,
    phase_sequence INT NOT NULL,
    trigger_month INT,
    trigger_threshold VARCHAR(255),
    trigger_operator VARCHAR(50),
    growth_rate_percent VARCHAR(255) NOT NULL,
    pct_of_revenue VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(expense_item_id, phase_sequence)
);

-- 3. Data Bridge: Backfill initial "Phase 1" records for all historical items
INSERT INTO revenue_item_phases (revenue_item_id, phase_sequence, trigger_month, growth_rate_percent, cost_of_revenue_percent)
SELECT id, 1, 1, growth_rate_percent, cost_of_revenue_percent FROM revenue_items;

INSERT INTO expense_item_phases (expense_item_id, phase_sequence, trigger_month, growth_rate_percent, pct_of_revenue)
SELECT id, 1, 1, growth_rate_percent, pct_of_revenue FROM expense_items;

-- 4. Set up Relational Phase pointers inside Volatility Policy tables
ALTER TABLE revenue_item_volatility_policies ADD COLUMN revenue_item_phase_id UUID REFERENCES revenue_item_phases(id) ON DELETE CASCADE;
ALTER TABLE expense_item_volatility_policies ADD COLUMN expense_item_phase_id UUID REFERENCES expense_item_phases(id) ON DELETE CASCADE;

-- 5. Re-route historical volatility policies to point to the new Phase 1 records
UPDATE revenue_item_volatility_policies p
SET revenue_item_phase_id = r_phase.id
FROM revenue_item_phases r_phase
WHERE p.revenue_item_id = r_phase.revenue_item_id AND r_phase.phase_sequence = 1;

UPDATE expense_item_volatility_policies p
SET expense_item_phase_id = r_phase.id
FROM expense_item_phases r_phase
WHERE p.expense_item_id = r_phase.expense_item_id AND r_phase.phase_sequence = 1;

-- 6. Harden foreign keys to be NOT NULL now that data is safely copied
ALTER TABLE revenue_item_volatility_policies ALTER COLUMN revenue_item_phase_id SET NOT NULL;
ALTER TABLE expense_item_volatility_policies ALTER COLUMN expense_item_phase_id SET NOT NULL;

-- 7. Apply structural uniqueness constraints to Phase-level stochastic modes
ALTER TABLE revenue_item_volatility_policies ADD CONSTRAINT unique_revenue_phase_mode UNIQUE(revenue_item_phase_id, mode_name);
ALTER TABLE expense_item_volatility_policies ADD CONSTRAINT unique_expense_phase_mode UNIQUE(expense_item_phase_id, mode_name);

-- 8. Cut the direct linkages to the old root item tables
-- (Dropping these columns automatically purges their old unique constraints)
ALTER TABLE revenue_item_volatility_policies DROP COLUMN revenue_item_id;
ALTER TABLE expense_item_volatility_policies DROP COLUMN expense_item_id;

-- 9. Clean up root shell tables by removing behavior attributes migrated to phases
ALTER TABLE revenue_items DROP COLUMN growth_rate_percent;
ALTER TABLE revenue_items DROP COLUMN cost_of_revenue_percent;

ALTER TABLE expense_items DROP COLUMN growth_rate_percent;
ALTER TABLE expense_items DROP COLUMN pct_of_revenue;-- Add migration script here
