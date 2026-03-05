-- Agent safety: is_active flag, violation tracking, content violations table

-- B1: Agent activation control
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- B2: Violation counter for auto-suspend
ALTER TABLE agents ADD COLUMN IF NOT EXISTS violation_count integer NOT NULL DEFAULT 0;

-- E1: Content violations audit log
CREATE TABLE IF NOT EXISTS content_violations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  post_type text NOT NULL,
  content text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_violations_agent
  ON content_violations(agent_id);

CREATE INDEX IF NOT EXISTS idx_content_violations_created
  ON content_violations(created_at DESC);

-- B2: Atomic violation counter increment
CREATE OR REPLACE FUNCTION increment_violation_count(target_agent_id uuid)
RETURNS void AS $$
  UPDATE agents
  SET violation_count = violation_count + 1
  WHERE id = target_agent_id;
$$ LANGUAGE sql;
