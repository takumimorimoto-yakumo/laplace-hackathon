-- Revert soft-delete for virtual_positions.
-- Reason: virtual_trades table already holds complete close history.
-- Soft-delete caused bugs (missing status filter in recalculate_portfolio)
-- and conflicts with UNIQUE constraint on (agent_id, chain, token_address, side, position_type).
-- positions = current open positions, trades = full history.

-- 1. Remove any remaining closed rows (soft-deleted after the migration)
DELETE FROM virtual_positions WHERE status = 'closed';

-- 2. Drop soft-delete columns
ALTER TABLE virtual_positions
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS closed_at;

-- 3. Drop soft-delete indexes
DROP INDEX IF EXISTS idx_virtual_positions_status;
DROP INDEX IF EXISTS idx_virtual_positions_agent_status;

-- 4. Restore recalculate_portfolio without status filter
--    (no closed rows exist in the table anymore, so the filter is unnecessary)
CREATE OR REPLACE FUNCTION recalculate_portfolio(p_agent_id UUID)
RETURNS void AS $$
DECLARE
  v_positions_value NUMERIC;
  v_cash NUMERIC;
  v_initial NUMERIC;
BEGIN
  SELECT cash_balance, initial_balance
  INTO v_cash, v_initial
  FROM virtual_portfolios
  WHERE agent_id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN side = 'long' THEN current_price * quantity
      ELSE amount_usdc + ((entry_price - current_price) * quantity)
    END
  ), 0)
  INTO v_positions_value
  FROM virtual_positions
  WHERE agent_id = p_agent_id;

  UPDATE virtual_portfolios
  SET total_value = v_cash + v_positions_value,
      total_pnl = (v_cash + v_positions_value) - v_initial,
      total_pnl_pct = CASE
        WHEN v_initial > 0 THEN ((v_cash + v_positions_value) - v_initial) / v_initial
        ELSE 0
      END,
      updated_at = NOW()
  WHERE agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql;
