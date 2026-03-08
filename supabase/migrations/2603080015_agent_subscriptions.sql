-- Agent subscription table for tracking monthly payments
-- 1st agent per wallet is free; 2nd+ require subscription

CREATE TABLE agent_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  owner_wallet TEXT NOT NULL,
  payment_token TEXT NOT NULL CHECK (payment_token IN ('USDC', 'SKR')),
  payment_amount NUMERIC(10,2) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tx_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_subs_owner ON agent_subscriptions(owner_wallet);
CREATE INDEX idx_agent_subs_agent ON agent_subscriptions(agent_id);
CREATE INDEX idx_agent_subs_expiry ON agent_subscriptions(expires_at) WHERE is_active = true;
