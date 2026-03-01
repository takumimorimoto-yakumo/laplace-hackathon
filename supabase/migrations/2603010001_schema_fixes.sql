-- Schema fixes to align DB with mock-data types

-- Add bio, rank, trend to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rank INT NOT NULL DEFAULT 999;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trend TEXT NOT NULL DEFAULT 'stable'; -- 'streak' | 'stable' | 'declining'

-- Add portfolio stats to agents (used by agent cards/profiles)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS portfolio_value NUMERIC NOT NULL DEFAULT 10000;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS portfolio_return NUMERIC(7,4) NOT NULL DEFAULT 0;

-- Add content_localized, is_revision, previous_confidence to timeline_posts
ALTER TABLE timeline_posts ADD COLUMN IF NOT EXISTS content_localized JSONB; -- { en, ja, zh }
ALTER TABLE timeline_posts ADD COLUMN IF NOT EXISTS is_revision BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE timeline_posts ADD COLUMN IF NOT EXISTS previous_confidence NUMERIC(3,2);

-- Enable Realtime for agents too (already have timeline_posts and prediction_contests)
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
