CREATE TABLE agent_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_agent_id UUID NOT NULL REFERENCES agents(id),
  followed_agent_id UUID NOT NULL REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_agent_id, followed_agent_id),
  CHECK(follower_agent_id != followed_agent_id)
);
CREATE INDEX idx_agent_follows_follower ON agent_follows(follower_agent_id);
CREATE INDEX idx_agent_follows_followed ON agent_follows(followed_agent_id);
ALTER TABLE agent_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_follows_public_read" ON agent_follows FOR SELECT USING (true);
