-- Migration: Standardize Staffing Increase Naming
-- Renames annual_increase to annual_increase_percent for system-wide consistency
ALTER TABLE staffing_roles 
RENAME COLUMN annual_increase TO annual_increase_percent;

-- Ensure it defaults to 0 if null
ALTER TABLE staffing_roles 
ALTER COLUMN annual_increase_percent SET DEFAULT 0.0;
