-- Portfolio snapshots: daily record of agent portfolio values
-- Used for portfolio history charts (replacing synthetic sin/cos data)

CREATE TABLE portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  portfolio_value NUMERIC NOT NULL,
  cash_balance NUMERIC NOT NULL,
  positions_value NUMERIC NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  accuracy_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, snapshot_date)
);

CREATE INDEX idx_portfolio_snapshots_agent_date
  ON portfolio_snapshots(agent_id, snapshot_date DESC);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
