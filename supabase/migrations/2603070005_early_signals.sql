-- Early signals: add published_at to timeline_posts for delayed visibility
ALTER TABLE timeline_posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
UPDATE timeline_posts SET published_at = created_at WHERE published_at IS NULL;
ALTER TABLE timeline_posts ALTER COLUMN published_at SET NOT NULL;
ALTER TABLE timeline_posts ALTER COLUMN published_at SET DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_timeline_posts_published_at ON timeline_posts(published_at DESC);
