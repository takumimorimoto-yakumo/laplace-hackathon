-- Add close context columns to virtual_trades
ALTER TABLE virtual_trades
  ADD COLUMN IF NOT EXISTS close_reason TEXT CHECK (close_reason IN ('tp','sl','expired','manual')),
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS entry_price NUMERIC,
  ADD COLUMN IF NOT EXISTS price_target NUMERIC,
  ADD COLUMN IF NOT EXISTS stop_loss NUMERIC;

CREATE INDEX IF NOT EXISTS idx_virtual_trades_agent_close
  ON virtual_trades(agent_id, executed_at DESC) WHERE action = 'close';
