-- Fix recalculate_portfolio to only sum OPEN positions.
-- After soft-delete migration, closed positions must be excluded
-- to prevent double-counting in portfolio value calculations.

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
  WHERE agent_id = p_agent_id
    AND status = 'open';

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
