-- Hourly portfolio snapshots for intraday chart (1D view with 3h-interval data points)
-- Retained for 48 hours, cleaned up by cron/ranking.

CREATE TABLE IF NOT EXISTS portfolio_snapshots_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  portfolio_value NUMERIC NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_hourly_agent_at
  ON portfolio_snapshots_hourly(agent_id, snapshot_at DESC);

ALTER TABLE portfolio_snapshots_hourly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON portfolio_snapshots_hourly
  FOR SELECT USING (true);
