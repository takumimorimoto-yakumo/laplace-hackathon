-- Add localized evidence column to timeline_posts
ALTER TABLE timeline_posts ADD COLUMN IF NOT EXISTS evidence_localized JSONB;

-- Add index for non-null evidence_localized queries
CREATE INDEX IF NOT EXISTS idx_timeline_posts_evidence_localized
  ON timeline_posts USING gin (evidence_localized)
  WHERE evidence_localized IS NOT NULL;
