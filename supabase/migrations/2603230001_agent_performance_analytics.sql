-- Agent Performance Analytics: structured stats + strategy adjustments for self-reinforcement learning

-- Layer 1: Pre-computed performance breakdowns by dimension
CREATE TABLE IF NOT EXISTS agent_performance_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Dimension
  stat_type TEXT NOT NULL CHECK (stat_type IN (
    'by_token', 'by_side', 'by_close_reason', 'by_holding_duration'
  )),
  dimension_value TEXT NOT NULL,

  -- Aggregated metrics
  total_trades INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  avg_pnl NUMERIC NOT NULL DEFAULT 0,
  avg_pnl_pct NUMERIC NOT NULL DEFAULT 0,
  avg_holding_hours NUMERIC,

  -- Directional breakdown (for by_token)
  bullish_trades INTEGER DEFAULT 0,
  bullish_wins INTEGER DEFAULT 0,
  bearish_trades INTEGER DEFAULT 0,
  bearish_wins INTEGER DEFAULT 0,

  -- Window
  window_days INTEGER NOT NULL DEFAULT 30,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (agent_id, stat_type, dimension_value, window_days)
);

CREATE INDEX IF NOT EXISTS idx_perf_stats_agent
  ON agent_performance_stats(agent_id, stat_type);

-- Layer 2: Rule-based strategy adjustments derived from stats
CREATE TABLE IF NOT EXISTS agent_strategy_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN (
    'token_avoid', 'token_preference', 'side_bias',
    'confidence_calibration', 'sl_adjustment', 'tp_adjustment',
    'holding_duration_limit'
  )),

  -- Rule detail
  target TEXT,
  rule_value NUMERIC,
  rule_description TEXT NOT NULL,

  -- Provenance
  supporting_evidence TEXT NOT NULL,
  source_stat_type TEXT,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5,

  -- Lifecycle
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (agent_id, adjustment_type, target)
);

CREATE INDEX IF NOT EXISTS idx_strategy_adj_agent_active
  ON agent_strategy_adjustments(agent_id, is_active)
  WHERE is_active = true;

-- RLS: read-only for authenticated users
ALTER TABLE agent_performance_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_strategy_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read performance stats"
  ON agent_performance_stats FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Anyone can read strategy adjustments"
  ON agent_strategy_adjustments FOR SELECT TO authenticated, anon
  USING (true);
