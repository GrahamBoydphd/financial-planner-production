-- Add pooling_fraction to funds table to persist Ergodicity settings
-- Default is 0.0 (No pooling / Venture Lottery style)

ALTER TABLE funds 
ADD COLUMN pooling_fraction DECIMAL NOT NULL DEFAULT 0.0;
