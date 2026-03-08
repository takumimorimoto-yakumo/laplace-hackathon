-- ============================================================
-- Migration: Agent Hard Delete FK Constraints
-- Change FK constraints so DELETE FROM agents CASCADE-deletes
-- related data, enabling true hard delete of user agents.
-- ============================================================

-- ============================================================
-- Part A: FK constraints referencing agents(id)
-- Change from NO ACTION (default) to CASCADE or SET NULL
-- ============================================================

-- timeline_posts.agent_id → CASCADE
ALTER TABLE timeline_posts DROP CONSTRAINT IF EXISTS timeline_posts_agent_id_fkey;
ALTER TABLE timeline_posts ADD CONSTRAINT timeline_posts_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- predictions.agent_id → CASCADE
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_agent_id_fkey;
ALTER TABLE predictions ADD CONSTRAINT predictions_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- virtual_portfolios.agent_id → CASCADE
ALTER TABLE virtual_portfolios DROP CONSTRAINT IF EXISTS virtual_portfolios_agent_id_fkey;
ALTER TABLE virtual_portfolios ADD CONSTRAINT virtual_portfolios_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- virtual_positions.agent_id → CASCADE
ALTER TABLE virtual_positions DROP CONSTRAINT IF EXISTS virtual_positions_agent_id_fkey;
ALTER TABLE virtual_positions ADD CONSTRAINT virtual_positions_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- virtual_trades.agent_id → CASCADE
ALTER TABLE virtual_trades DROP CONSTRAINT IF EXISTS virtual_trades_agent_id_fkey;
ALTER TABLE virtual_trades ADD CONSTRAINT virtual_trades_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- copy_trade_configs.agent_id → CASCADE
ALTER TABLE copy_trade_configs DROP CONSTRAINT IF EXISTS copy_trade_configs_agent_id_fkey;
ALTER TABLE copy_trade_configs ADD CONSTRAINT copy_trade_configs_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- copy_trades.agent_id → CASCADE
ALTER TABLE copy_trades DROP CONSTRAINT IF EXISTS copy_trades_agent_id_fkey;
ALTER TABLE copy_trades ADD CONSTRAINT copy_trades_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- agent_rentals.agent_id → CASCADE
ALTER TABLE agent_rentals DROP CONSTRAINT IF EXISTS agent_rentals_agent_id_fkey;
ALTER TABLE agent_rentals ADD CONSTRAINT agent_rentals_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- agent_bookmarks.agent_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_bookmarks') THEN
    ALTER TABLE agent_bookmarks DROP CONSTRAINT IF EXISTS agent_bookmarks_agent_id_fkey;
    ALTER TABLE agent_bookmarks ADD CONSTRAINT agent_bookmarks_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
  END IF;
END $$;

-- prediction_markets.proposer_agent_id → CASCADE
ALTER TABLE prediction_markets DROP CONSTRAINT IF EXISTS prediction_markets_proposer_agent_id_fkey;
ALTER TABLE prediction_markets ADD CONSTRAINT prediction_markets_proposer_agent_id_fkey
  FOREIGN KEY (proposer_agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- agent_votes.agent_id → CASCADE
ALTER TABLE agent_votes DROP CONSTRAINT IF EXISTS agent_votes_agent_id_fkey;
ALTER TABLE agent_votes ADD CONSTRAINT agent_votes_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- agent_follows.follower_agent_id → CASCADE
ALTER TABLE agent_follows DROP CONSTRAINT IF EXISTS agent_follows_follower_agent_id_fkey;
ALTER TABLE agent_follows ADD CONSTRAINT agent_follows_follower_agent_id_fkey
  FOREIGN KEY (follower_agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- agent_follows.followed_agent_id → CASCADE
ALTER TABLE agent_follows DROP CONSTRAINT IF EXISTS agent_follows_followed_agent_id_fkey;
ALTER TABLE agent_follows ADD CONSTRAINT agent_follows_followed_agent_id_fkey
  FOREIGN KEY (followed_agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- agent_chats.agent_id → CASCADE
ALTER TABLE agent_chats DROP CONSTRAINT IF EXISTS agent_chats_agent_id_fkey;
ALTER TABLE agent_chats ADD CONSTRAINT agent_chats_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- chat_rate_limits.agent_id → CASCADE
ALTER TABLE chat_rate_limits DROP CONSTRAINT IF EXISTS chat_rate_limits_agent_id_fkey;
ALTER TABLE chat_rate_limits ADD CONSTRAINT chat_rate_limits_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- analysis_requests.agent_id → CASCADE
ALTER TABLE analysis_requests DROP CONSTRAINT IF EXISTS analysis_requests_agent_id_fkey;
ALTER TABLE analysis_requests ADD CONSTRAINT analysis_requests_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- api_request_logs.agent_id → SET NULL (nullable, preserve logs)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_request_logs') THEN
    ALTER TABLE api_request_logs DROP CONSTRAINT IF EXISTS api_request_logs_agent_id_fkey;
    ALTER TABLE api_request_logs ADD CONSTRAINT api_request_logs_agent_id_fkey
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- prediction_contests.winner_1st/2nd/3rd → SET NULL (nullable, preserve contest records)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prediction_contests') THEN
    ALTER TABLE prediction_contests DROP CONSTRAINT IF EXISTS prediction_contests_winner_1st_fkey;
    ALTER TABLE prediction_contests ADD CONSTRAINT prediction_contests_winner_1st_fkey
      FOREIGN KEY (winner_1st) REFERENCES agents(id) ON DELETE SET NULL;

    ALTER TABLE prediction_contests DROP CONSTRAINT IF EXISTS prediction_contests_winner_2nd_fkey;
    ALTER TABLE prediction_contests ADD CONSTRAINT prediction_contests_winner_2nd_fkey
      FOREIGN KEY (winner_2nd) REFERENCES agents(id) ON DELETE SET NULL;

    ALTER TABLE prediction_contests DROP CONSTRAINT IF EXISTS prediction_contests_winner_3rd_fkey;
    ALTER TABLE prediction_contests ADD CONSTRAINT prediction_contests_winner_3rd_fkey
      FOREIGN KEY (winner_3rd) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- positions.agent_1st/2nd/3rd → SET NULL (nullable, preserve position records)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'positions') THEN
    ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_agent_1st_fkey;
    ALTER TABLE positions ADD CONSTRAINT positions_agent_1st_fkey
      FOREIGN KEY (agent_1st) REFERENCES agents(id) ON DELETE SET NULL;

    ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_agent_2nd_fkey;
    ALTER TABLE positions ADD CONSTRAINT positions_agent_2nd_fkey
      FOREIGN KEY (agent_2nd) REFERENCES agents(id) ON DELETE SET NULL;

    ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_agent_3rd_fkey;
    ALTER TABLE positions ADD CONSTRAINT positions_agent_3rd_fkey
      FOREIGN KEY (agent_3rd) REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- Part B: FK constraints referencing timeline_posts(id)
-- Fix cross-agent deletion issues: when agent A's posts are
-- CASCADE-deleted, references from other agents' data must
-- not block the deletion.
-- ============================================================

-- timeline_posts self-references → SET NULL
ALTER TABLE timeline_posts DROP CONSTRAINT IF EXISTS timeline_posts_parent_post_id_fkey;
ALTER TABLE timeline_posts ADD CONSTRAINT timeline_posts_parent_post_id_fkey
  FOREIGN KEY (parent_post_id) REFERENCES timeline_posts(id) ON DELETE SET NULL;

ALTER TABLE timeline_posts DROP CONSTRAINT IF EXISTS timeline_posts_quoted_post_id_fkey;
ALTER TABLE timeline_posts ADD CONSTRAINT timeline_posts_quoted_post_id_fkey
  FOREIGN KEY (quoted_post_id) REFERENCES timeline_posts(id) ON DELETE SET NULL;

ALTER TABLE timeline_posts DROP CONSTRAINT IF EXISTS timeline_posts_supersedes_post_id_fkey;
ALTER TABLE timeline_posts ADD CONSTRAINT timeline_posts_supersedes_post_id_fkey
  FOREIGN KEY (supersedes_post_id) REFERENCES timeline_posts(id) ON DELETE SET NULL;

-- agent_bookmarks.post_id → CASCADE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_bookmarks') THEN
    ALTER TABLE agent_bookmarks DROP CONSTRAINT IF EXISTS agent_bookmarks_post_id_fkey;
    ALTER TABLE agent_bookmarks ADD CONSTRAINT agent_bookmarks_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES timeline_posts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- agent_votes.post_id → CASCADE
ALTER TABLE agent_votes DROP CONSTRAINT IF EXISTS agent_votes_post_id_fkey;
ALTER TABLE agent_votes ADD CONSTRAINT agent_votes_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES timeline_posts(id) ON DELETE CASCADE;

-- prediction_markets.source_post_id → SET NULL
ALTER TABLE prediction_markets DROP CONSTRAINT IF EXISTS prediction_markets_source_post_id_fkey;
ALTER TABLE prediction_markets ADD CONSTRAINT prediction_markets_source_post_id_fkey
  FOREIGN KEY (source_post_id) REFERENCES timeline_posts(id) ON DELETE SET NULL;

-- analysis_requests.result_post_id → SET NULL
ALTER TABLE analysis_requests DROP CONSTRAINT IF EXISTS analysis_requests_result_post_id_fkey;
ALTER TABLE analysis_requests ADD CONSTRAINT analysis_requests_result_post_id_fkey
  FOREIGN KEY (result_post_id) REFERENCES timeline_posts(id) ON DELETE SET NULL;
