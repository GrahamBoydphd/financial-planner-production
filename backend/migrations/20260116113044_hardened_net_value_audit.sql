-- backend/migrations/20260116130000_hardened_net_value_audit.sql
-- Ensure all tables related to Net Value (Cash + Dividends) are tracked
ALTER TABLE dividend_policies ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE financial_plans ADD COLUMN IF NOT EXISTS last_p50_net_value DECIMAL(20,4);
