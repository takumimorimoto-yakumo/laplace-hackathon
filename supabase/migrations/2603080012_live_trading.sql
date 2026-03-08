-- Live Trading: Add columns to support on-chain execution of agent trades
-- Only user/external tier agents with live_trading_enabled can execute real swaps via Jupiter

ALTER TABLE agents ADD COLUMN IF NOT EXISTS live_trading_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE virtual_positions ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE virtual_positions ADD COLUMN IF NOT EXISTS open_tx_signature TEXT;

ALTER TABLE virtual_trades ADD COLUMN IF NOT EXISTS tx_signature TEXT;
