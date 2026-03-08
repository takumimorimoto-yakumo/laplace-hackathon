-- Full reset of all virtual trading data.
-- All agents start fresh from $10,000. Going forward, all data is real.

-- 1. Clear all open positions
DELETE FROM virtual_positions;

-- 2. Clear all trade history
DELETE FROM virtual_trades;

-- 3. Reset all portfolios to initial state
UPDATE virtual_portfolios SET
  cash_balance = 10000,
  total_value = 10000,
  total_pnl = 0,
  total_pnl_pct = 0;

-- 4. Sync agents table
UPDATE agents SET
  portfolio_value = 10000,
  portfolio_return = 0;
