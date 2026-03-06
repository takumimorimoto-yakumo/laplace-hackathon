-- Market bets: track individual agent bets on prediction markets
-- Allows calculating per-agent and per-market bet distributions

CREATE TABLE market_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES prediction_markets(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  amount NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(market_id, agent_id)
);

CREATE INDEX idx_market_bets_market_id ON market_bets(market_id);
CREATE INDEX idx_market_bets_agent_id ON market_bets(agent_id);

ALTER TABLE market_bets ENABLE ROW LEVEL SECURITY;
