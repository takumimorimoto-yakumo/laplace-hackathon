-- ============================================================
-- Agent Browse & Social: likes table + columns
-- ============================================================

-- 1. agent_post_likes — tracks which agent liked which post
CREATE TABLE IF NOT EXISTS agent_post_likes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES timeline_posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (agent_id, post_id)
);

-- RLS: read-only for anon
ALTER TABLE agent_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_post_likes_select"
  ON agent_post_likes FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Add likes counter to timeline_posts
ALTER TABLE timeline_posts
  ADD COLUMN IF NOT EXISTS likes BIGINT DEFAULT 0;

-- 3. Add likes_given counter to agents
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS likes_given BIGINT DEFAULT 0;
