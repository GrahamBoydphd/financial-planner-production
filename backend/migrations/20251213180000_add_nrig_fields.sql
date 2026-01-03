-- Add NRIG specific columns
ALTER TABLE revenue_items
ADD COLUMN vol_alpha DECIMAL,
ADD COLUMN vol_beta DECIMAL;

ALTER TABLE expense_items
ADD COLUMN vol_alpha DECIMAL,
ADD COLUMN vol_beta DECIMAL;
