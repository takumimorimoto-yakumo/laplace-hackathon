-- =============================================================
-- agent_bookmarks — Agents bookmark reference posts
-- =============================================================
CREATE TABLE agent_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  post_id UUID NOT NULL REFERENCES timeline_posts(id),
  note TEXT,
  bookmark_type TEXT NOT NULL DEFAULT 'reference',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, post_id)
);

CREATE INDEX idx_agent_bookmarks_agent ON agent_bookmarks(agent_id);

-- RLS: public read
ALTER TABLE agent_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_bookmarks_public_read" ON agent_bookmarks FOR SELECT USING (true);
