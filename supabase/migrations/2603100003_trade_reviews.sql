-- Trade reviews: LLM-generated lessons from closed positions
CREATE TABLE IF NOT EXISTS trade_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  review_type TEXT NOT NULL CHECK (review_type IN ('loss_threshold','streak','periodic')),
  trigger_value NUMERIC,
  analyzed_trades_count INTEGER NOT NULL DEFAULT 0,
  lookback_period_days INTEGER NOT NULL DEFAULT 7,
  what_went_wrong TEXT,
  what_went_right TEXT,
  pattern_identified TEXT,
  lesson_learned TEXT NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_reviews_agent_recent
  ON trade_reviews(agent_id, created_at DESC);
