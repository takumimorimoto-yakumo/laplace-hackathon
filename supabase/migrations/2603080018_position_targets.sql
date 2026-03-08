-- Add price target and stop loss to virtual_positions
-- These are set by the agent's AI when opening a position.

ALTER TABLE virtual_positions
  ADD COLUMN IF NOT EXISTS price_target NUMERIC,
  ADD COLUMN IF NOT EXISTS stop_loss NUMERIC,
  ADD COLUMN IF NOT EXISTS reasoning TEXT;
