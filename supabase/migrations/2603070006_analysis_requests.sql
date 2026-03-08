-- Custom analysis requests from renters
CREATE TABLE analysis_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  user_wallet TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result_post_id UUID REFERENCES timeline_posts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_analysis_requests_pending ON analysis_requests(agent_id, status) WHERE status = 'pending';
