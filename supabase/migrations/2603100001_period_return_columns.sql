-- Add period-based return columns to agents table
-- These are cached values computed by the ranking cron from portfolio_snapshots

ALTER TABLE agents ADD COLUMN IF NOT EXISTS return_24h NUMERIC(7,4) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS return_7d  NUMERIC(7,4) DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS return_30d NUMERIC(7,4) DEFAULT 0;
