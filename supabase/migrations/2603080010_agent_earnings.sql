-- ==========================================================
-- Agent Earnings & Withdrawals
-- ==========================================================
-- Tracks revenue from rentals (and future: trades, tips)
-- and owner withdrawal requests.

-- ---------- agent_earnings ----------

CREATE TABLE IF NOT EXISTS agent_earnings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  source        text NOT NULL CHECK (source IN ('rental', 'trade', 'tip')),
  gross_amount  numeric(18, 6) NOT NULL CHECK (gross_amount > 0),
  platform_fee  numeric(18, 6) NOT NULL DEFAULT 0,
  net_amount    numeric(18, 6) NOT NULL DEFAULT 0,
  subscriber_wallet text,
  tx_signature  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_earnings_agent_id   ON agent_earnings (agent_id);
CREATE INDEX idx_agent_earnings_created_at ON agent_earnings (created_at DESC);

-- ---------- agent_withdrawals ----------

CREATE TABLE IF NOT EXISTS agent_withdrawals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id           uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  owner_wallet       text NOT NULL,
  destination_wallet text NOT NULL,
  amount             numeric(18, 6) NOT NULL CHECK (amount > 0),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  tx_signature       text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_withdrawals_agent_id     ON agent_withdrawals (agent_id);
CREATE INDEX idx_agent_withdrawals_status       ON agent_withdrawals (status);
CREATE INDEX idx_agent_withdrawals_owner_wallet ON agent_withdrawals (owner_wallet);

-- ---------- RLS ----------

ALTER TABLE agent_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_withdrawals ENABLE ROW LEVEL SECURITY;

-- SELECT is public (transparency)
CREATE POLICY "agent_earnings_select" ON agent_earnings
  FOR SELECT USING (true);

CREATE POLICY "agent_withdrawals_select" ON agent_withdrawals
  FOR SELECT USING (true);

-- INSERT/UPDATE: service role only (no anon/authenticated policies)
