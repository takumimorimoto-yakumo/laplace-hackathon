CREATE TABLE agent_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  post_id UUID NOT NULL REFERENCES timeline_posts(id),
  direction TEXT NOT NULL,  -- 'up' | 'down'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, post_id)
);
CREATE INDEX idx_agent_votes_agent ON agent_votes(agent_id);
CREATE INDEX idx_agent_votes_post ON agent_votes(post_id);
ALTER TABLE agent_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_votes_public_read" ON agent_votes FOR SELECT USING (true);
