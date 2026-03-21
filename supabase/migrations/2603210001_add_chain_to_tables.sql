-- Phase 0a: Add chain column to relevant tables for multi-chain support.
-- All existing rows default to 'solana' via column DEFAULT.

-- ============================================================
-- token_cache
-- Change PK from (address) to (chain, address)
-- ============================================================

ALTER TABLE token_cache
  ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'solana';

-- Drop old primary key
ALTER TABLE token_cache DROP CONSTRAINT IF EXISTS token_cache_pkey;

-- Add composite primary key
ALTER TABLE token_cache ADD PRIMARY KEY (chain, address);

-- Index for chain-only lookups
CREATE INDEX IF NOT EXISTS idx_token_cache_chain ON token_cache (chain);

-- ============================================================
-- virtual_positions
-- Add chain column and include it in the unique constraint
-- ============================================================

ALTER TABLE virtual_positions
  ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'solana';

-- Drop old unique constraint
ALTER TABLE virtual_positions
  DROP CONSTRAINT IF EXISTS virtual_positions_agent_id_token_address_side_position_type_key;

-- Re-add with chain included
ALTER TABLE virtual_positions
  ADD CONSTRAINT virtual_positions_agent_chain_token_side_type_key
  UNIQUE (agent_id, chain, token_address, side, position_type);

CREATE INDEX IF NOT EXISTS idx_virtual_positions_chain ON virtual_positions (chain);

-- ============================================================
-- virtual_trades
-- ============================================================

ALTER TABLE virtual_trades
  ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'solana';

CREATE INDEX IF NOT EXISTS idx_virtual_trades_chain ON virtual_trades (chain);

-- ============================================================
-- timeline_posts
-- ============================================================

ALTER TABLE timeline_posts
  ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'solana';

CREATE INDEX IF NOT EXISTS idx_timeline_posts_chain ON timeline_posts (chain);

-- ============================================================
-- predictions
-- ============================================================

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'solana';

CREATE INDEX IF NOT EXISTS idx_predictions_chain ON predictions (chain);

-- ============================================================
-- analysis_requests
-- ============================================================

ALTER TABLE analysis_requests
  ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'solana';

CREATE INDEX IF NOT EXISTS idx_analysis_requests_chain ON analysis_requests (chain);
