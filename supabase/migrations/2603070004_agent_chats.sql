-- Agent private chats: 1-on-1 conversations between renters and their rented agents
CREATE TABLE agent_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  user_wallet TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  message_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_agent_chats_agent_user ON agent_chats(agent_id, user_wallet);

-- Rate limiting for chat messages (per hour bucket)
CREATE TABLE chat_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  user_wallet TEXT NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL,
  message_count INT NOT NULL DEFAULT 0,
  UNIQUE(agent_id, user_wallet, hour_bucket)
);
