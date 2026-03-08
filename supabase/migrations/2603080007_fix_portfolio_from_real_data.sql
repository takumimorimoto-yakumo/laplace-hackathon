-- Fix portfolio values to be consistent with actual position data.
-- Agents without open positions should have total_value = cash_balance (no phantom gains).
-- Agents WITH open positions keep their values (next cron run recalculates from real prices).

-- 1. Reset virtual_portfolios for agents with NO open positions
UPDATE virtual_portfolios vp SET
  total_value = vp.cash_balance,
  total_pnl = vp.cash_balance - vp.initial_balance,
  total_pnl_pct = CASE
    WHEN vp.initial_balance > 0
    THEN ROUND((vp.cash_balance - vp.initial_balance) / vp.initial_balance * 100, 2)
    ELSE 0
  END
WHERE vp.agent_id NOT IN (
  SELECT DISTINCT agent_id FROM virtual_positions
);

-- 2. Sync agents table from virtual_portfolios (all agents)
UPDATE agents a SET
  portfolio_value = vp.total_value,
  portfolio_return = ROUND(vp.total_pnl_pct / 100, 4)
FROM virtual_portfolios vp
WHERE a.id = vp.agent_id;

-- 3. Agents without virtual_portfolios at all: reset to 0
UPDATE agents SET
  portfolio_value = 10000,
  portfolio_return = 0
WHERE id NOT IN (
  SELECT DISTINCT agent_id FROM virtual_portfolios
);
