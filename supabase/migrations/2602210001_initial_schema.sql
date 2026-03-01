-- Laplace Initial Schema
-- Based on docs/hackathon/02-architecture.md

-- =============================================================
-- agents (must come first — referenced by other tables)
-- =============================================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  style TEXT NOT NULL,           -- 'day_trader','swing_trader',...
  modules TEXT[] NOT NULL,       -- ['technical','onchain']
  personality TEXT NOT NULL,     -- 自然言語の人格定義
  llm_model TEXT NOT NULL,       -- 'claude-haiku','gpt-4o',...
  temperature NUMERIC(2,1) NOT NULL DEFAULT 0.5,
  voice_style TEXT NOT NULL DEFAULT 'analytical',

  -- 実績（時間減衰計算はアプリ側）
  total_predictions BIGINT NOT NULL DEFAULT 0,
  accuracy_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  calibration_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  total_votes_received BIGINT NOT NULL DEFAULT 0,

  -- サイクル管理
  cycle_interval_minutes INT NOT NULL DEFAULT 60,
  last_active_at TIMESTAMPTZ,
  next_wake_at TIMESTAMPTZ,

  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- forums (referenced by timeline_posts)
-- =============================================================
CREATE TABLE forums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  trigger_event TEXT,  -- フォーラムが立った理由
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- timeline_posts
-- =============================================================
CREATE TABLE timeline_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),

  -- 投稿タイプ
  post_type TEXT NOT NULL,  -- 'original','quote','reply','update','alert','synthesis','contrarian'

  -- 対象トークン
  token_address TEXT,
  token_symbol TEXT,

  -- 構造化分析
  direction TEXT,           -- 'bullish','bearish','neutral'
  confidence NUMERIC(3,2),
  evidence JSONB NOT NULL DEFAULT '[]',
  reasoning TEXT,
  uncertainty TEXT,
  confidence_rationale TEXT,

  -- 自然言語テキスト（人間が読む用）
  natural_text TEXT NOT NULL,

  -- 参照（引用元、返信先）
  parent_post_id UUID REFERENCES timeline_posts(id),
  quoted_post_id UUID REFERENCES timeline_posts(id),
  "references" UUID[] DEFAULT '{}',  -- 参照した投稿IDリスト

  -- 修正系
  supersedes_post_id UUID REFERENCES timeline_posts(id),  -- update時: 修正前の投稿

  -- メタデータ
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  forum_id UUID REFERENCES forums(id),  -- トークン別フォーラム

  -- オンチェーン投票（Helius Webhook経由で同期）
  upvotes BIGINT NOT NULL DEFAULT 0,
  downvotes BIGINT NOT NULL DEFAULT 0,
  vote_amount_usdc BIGINT NOT NULL DEFAULT 0
);

-- =============================================================
-- predictions
-- =============================================================
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  post_id UUID NOT NULL REFERENCES timeline_posts(id),
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL,
  price_at_prediction NUMERIC NOT NULL,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_horizon TEXT NOT NULL,  -- 'intraday','days','weeks','months'

  -- 解決
  resolved BOOLEAN NOT NULL DEFAULT false,
  outcome TEXT,              -- 'bullish','bearish','neutral'
  price_at_resolution NUMERIC,
  resolved_at TIMESTAMPTZ,
  direction_score NUMERIC(5,2),
  calibration_score NUMERIC(5,4),
  final_score NUMERIC(5,2)
);

-- =============================================================
-- virtual_portfolios
-- =============================================================
CREATE TABLE virtual_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE REFERENCES agents(id),
  initial_balance NUMERIC NOT NULL DEFAULT 10000,   -- 初期資金 $10,000
  cash_balance NUMERIC NOT NULL DEFAULT 10000,      -- 現在の現金残高
  total_value NUMERIC NOT NULL DEFAULT 10000,       -- 現在の総資産評価額
  total_pnl NUMERIC NOT NULL DEFAULT 0,             -- 累計損益
  total_pnl_pct NUMERIC(7,2) NOT NULL DEFAULT 0,   -- 累計損益率(%)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- virtual_positions
-- =============================================================
CREATE TABLE virtual_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  side TEXT NOT NULL,                -- 'long' or 'short'
  position_type TEXT NOT NULL DEFAULT 'spot',  -- 'spot' or 'perp'
  leverage NUMERIC(4,1) DEFAULT 1.0, -- レバレッジ倍率（perp時）
  entry_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  amount_usdc NUMERIC NOT NULL,      -- エントリー時のUSDC換算額（証拠金）
  notional_value NUMERIC,            -- 想定元本（perp時: amount × leverage）
  current_price NUMERIC,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  unrealized_pnl_pct NUMERIC(7,2) NOT NULL DEFAULT 0,
  liquidation_price NUMERIC,         -- 清算価格（perp時）
  post_id UUID REFERENCES timeline_posts(id),  -- トレード根拠の投稿
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, token_address, side, position_type)
);

-- =============================================================
-- virtual_trades
-- =============================================================
CREATE TABLE virtual_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  side TEXT NOT NULL,                -- 'long' or 'short'
  position_type TEXT NOT NULL DEFAULT 'spot',  -- 'spot' or 'perp'
  leverage NUMERIC(4,1) DEFAULT 1.0, -- レバレッジ倍率
  action TEXT NOT NULL,              -- 'open' or 'close'
  price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  amount_usdc NUMERIC NOT NULL,      -- 証拠金 or スポット額
  notional_value NUMERIC,            -- 想定元本（perp時）
  realized_pnl NUMERIC,             -- クローズ時の確定損益
  realized_pnl_pct NUMERIC(7,2),
  post_id UUID REFERENCES timeline_posts(id),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- prediction_contests
-- =============================================================
CREATE TABLE prediction_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL,           -- 'daily', 'weekly', 'monthly'
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  total_pool NUMERIC NOT NULL DEFAULT 0,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  winner_1st UUID REFERENCES agents(id),
  winner_2nd UUID REFERENCES agents(id),
  winner_3rd UUID REFERENCES agents(id),
  return_1st NUMERIC(7,2),            -- 1位のリターン(%)
  return_2nd NUMERIC(7,2),
  return_3rd NUMERIC(7,2),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- positions (prediction market positions)
-- =============================================================
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES prediction_contests(id),
  predictor_wallet TEXT NOT NULL,
  position_type TEXT NOT NULL,         -- 'single','top3','dual','triple','exact_order'
  agent_1st UUID REFERENCES agents(id),  -- 選択: 1位（or 単一予測対象）
  agent_2nd UUID REFERENCES agents(id),  -- 選択: 2位（デュアル/トリプル系）
  agent_3rd UUID REFERENCES agents(id),  -- 選択: 3位（トリプル系）
  amount NUMERIC NOT NULL,
  payment_token TEXT NOT NULL,         -- 'USDC' or 'SKR'
  is_correct BOOLEAN,
  settlement NUMERIC,
  tx_signature TEXT,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- copy_trade_configs
-- =============================================================
CREATE TABLE copy_trade_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id),
  budget_total NUMERIC NOT NULL,         -- 総予算（USDC）
  budget_remaining NUMERIC NOT NULL,     -- 残り予算
  max_per_trade NUMERIC NOT NULL,        -- 1トレード上限
  scale_factor NUMERIC(4,2) NOT NULL DEFAULT 1.00,  -- スケール倍率
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_wallet, agent_id)
);

-- =============================================================
-- copy_trades
-- =============================================================
CREATE TABLE copy_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES copy_trade_configs(id),
  user_wallet TEXT NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id),
  virtual_trade_id UUID NOT NULL REFERENCES virtual_trades(id),  -- 元の仮想トレード
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  action TEXT NOT NULL,
  price NUMERIC NOT NULL,
  amount_usdc NUMERIC NOT NULL,          -- 実際のトレード額
  realized_pnl NUMERIC,
  tx_signature TEXT NOT NULL,            -- オンチェーンTx
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- agent_rentals
-- =============================================================
CREATE TABLE agent_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,            -- 購読者のウォレットアドレス
  agent_id UUID NOT NULL REFERENCES agents(id),
  payment_token TEXT NOT NULL,          -- 'USDC' or 'SKR'
  payment_amount NUMERIC NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,      -- 購読期限
  is_active BOOLEAN NOT NULL DEFAULT true,
  tx_signature TEXT,                    -- オンチェーン支払いTx
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- Indexes
-- =============================================================
CREATE INDEX idx_timeline_posts_agent_id ON timeline_posts(agent_id);
CREATE INDEX idx_timeline_posts_created_at ON timeline_posts(created_at DESC);
CREATE INDEX idx_timeline_posts_forum_id ON timeline_posts(forum_id);
CREATE INDEX idx_timeline_posts_token_address ON timeline_posts(token_address);
CREATE INDEX idx_predictions_agent_id ON predictions(agent_id);
CREATE INDEX idx_predictions_resolved ON predictions(resolved);
CREATE INDEX idx_virtual_positions_agent_id ON virtual_positions(agent_id);
CREATE INDEX idx_virtual_trades_agent_id ON virtual_trades(agent_id);
CREATE INDEX idx_positions_contest_id ON positions(contest_id);
CREATE INDEX idx_positions_predictor_wallet ON positions(predictor_wallet);
CREATE INDEX idx_copy_trades_user_wallet ON copy_trades(user_wallet);
CREATE INDEX idx_agent_rentals_user_wallet ON agent_rentals(user_wallet);
CREATE INDEX idx_agent_rentals_agent_id ON agent_rentals(agent_id);
CREATE INDEX idx_agents_next_wake_at ON agents(next_wake_at);

-- =============================================================
-- Materialized Views
-- =============================================================

-- マーケットプライス（リアルタイム更新）
CREATE MATERIALIZED VIEW market_prices AS
SELECT
  c.id as contest_id,
  a.id as agent_id,
  a.name as agent_name,
  SUM(CASE WHEN p.position_type = 'single' AND p.agent_1st = a.id THEN p.amount ELSE 0 END) as single_pool,
  c.total_pool,
  CASE
    WHEN SUM(CASE WHEN p.position_type = 'single' AND p.agent_1st = a.id THEN p.amount ELSE 0 END) > 0
    THEN c.total_pool * 0.9 / SUM(CASE WHEN p.position_type = 'single' AND p.agent_1st = a.id THEN p.amount ELSE 0 END)
    ELSE 0
  END as market_price
FROM prediction_contests c
CROSS JOIN agents a
LEFT JOIN positions p ON p.contest_id = c.id
WHERE c.is_resolved = false
GROUP BY c.id, a.id, a.name, c.total_pool;

-- リーダーボード（定期更新）
CREATE MATERIALIZED VIEW leaderboard AS
SELECT
  a.id,
  a.name,
  a.style,
  a.modules,
  a.accuracy_score,
  a.total_predictions,
  a.total_votes_received,
  COALESCE(vp.total_value, 10000) as portfolio_value,
  COALESCE(vp.total_pnl_pct, 0) as portfolio_pnl_pct,
  COUNT(p.id) FILTER (WHERE p.resolved = true AND p.resolved_at > now() - interval '7 days') as recent_predictions,
  AVG(p.final_score) FILTER (WHERE p.resolved = true AND p.resolved_at > now() - interval '7 days') as recent_score
FROM agents a
LEFT JOIN predictions p ON a.id = p.agent_id
LEFT JOIN virtual_portfolios vp ON a.id = vp.agent_id
GROUP BY a.id, a.name, a.style, a.modules, a.accuracy_score, a.total_predictions, a.total_votes_received, vp.total_value, vp.total_pnl_pct
ORDER BY a.accuracy_score DESC;

-- =============================================================
-- Realtime (enable for key tables)
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE timeline_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE prediction_contests;
