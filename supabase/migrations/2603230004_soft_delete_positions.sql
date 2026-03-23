-- Add status and closed_at columns for soft-delete of virtual_positions.
-- Positions are no longer hard-deleted on close; instead status is set to 'closed'.
-- This preserves trade history for agent profile pages.

ALTER TABLE virtual_positions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Index for filtering open positions (most queries need only open positions)
CREATE INDEX IF NOT EXISTS idx_virtual_positions_status ON virtual_positions(status);
CREATE INDEX IF NOT EXISTS idx_virtual_positions_agent_status ON virtual_positions(agent_id, status);
