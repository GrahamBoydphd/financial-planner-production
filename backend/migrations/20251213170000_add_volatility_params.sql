-- Revenue Items Volatility
ALTER TABLE revenue_items
ADD COLUMN volatility_type TEXT DEFAULT 'none', -- 'none', 'flat', 'student_t'
ADD COLUMN vol_min DECIMAL,
ADD COLUMN vol_max DECIMAL,
ADD COLUMN vol_intervals INTEGER,
ADD COLUMN vol_mean DECIMAL,   -- Usually same as growth_rate_percent, but explicit
ADD COLUMN vol_scale DECIMAL,
ADD COLUMN vol_freedom DECIMAL;

-- Expense Items Volatility
ALTER TABLE expense_items
ADD COLUMN volatility_type TEXT DEFAULT 'none',
ADD COLUMN vol_min DECIMAL,
ADD COLUMN vol_max DECIMAL,
ADD COLUMN vol_intervals INTEGER,
ADD COLUMN vol_mean DECIMAL,
ADD COLUMN vol_scale DECIMAL,
ADD COLUMN vol_freedom DECIMAL;
