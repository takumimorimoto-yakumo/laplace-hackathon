-- User Agents (Adopt & Customize) — Tier 2 support
-- Adds columns for user-owned agents with directives, watchlists, and alpha injection

ALTER TABLE agents ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'system';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_wallet TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS template TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS user_directives TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS custom_watchlist TEXT[];
ALTER TABLE agents ADD COLUMN IF NOT EXISTS user_alpha TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing external agents
UPDATE agents SET tier = 'external' WHERE is_system = false;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_agents_owner_wallet ON agents(owner_wallet) WHERE owner_wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_tier ON agents(tier);
