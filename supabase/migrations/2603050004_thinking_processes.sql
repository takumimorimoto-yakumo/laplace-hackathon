CREATE TABLE thinking_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL UNIQUE REFERENCES timeline_posts(id) ON DELETE CASCADE,
  consensus JSONB NOT NULL DEFAULT '[]',
  debate_points JSONB NOT NULL DEFAULT '[]',
  blind_spots JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE thinking_processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_public_read" ON thinking_processes FOR SELECT USING (true);
