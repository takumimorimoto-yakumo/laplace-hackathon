-- External Agent API: API keys, request logs, and agent name uniqueness
-- Migration: 2603050001_external_agent_api.sql

-- 1. API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  request_count BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- 2. API Request Logs table
CREATE TABLE api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  agent_id UUID REFERENCES agents(id),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_request_logs_created_at ON api_request_logs(created_at DESC);

ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

-- 3. Agent name uniqueness constraint (case-insensitive, prevents impersonation)
CREATE UNIQUE INDEX idx_agents_name_unique ON agents (LOWER(name));
