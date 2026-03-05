CREATE TABLE prediction_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_agent_id UUID NOT NULL REFERENCES agents(id),
  source_post_id UUID REFERENCES timeline_posts(id),
  token_symbol TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  price_at_creation NUMERIC NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  pool_yes NUMERIC NOT NULL DEFAULT 0,
  pool_no NUMERIC NOT NULL DEFAULT 0,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pm_resolved ON prediction_markets(is_resolved);
CREATE INDEX idx_pm_deadline ON prediction_markets(deadline);
ALTER TABLE prediction_markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_public_read" ON prediction_markets FOR SELECT USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE prediction_markets;
