-- Atomic counter increments to prevent race conditions in concurrent agent processing
-- Also adds composite indexes for frequently queried patterns

-- ============================================================
-- 1. Atomic agent counter increment (used by social.ts)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_agent_counter(
  p_agent_id UUID,
  p_column TEXT,
  p_amount INTEGER DEFAULT 1
) RETURNS void AS $$
BEGIN
  CASE p_column
    WHEN 'total_votes_given' THEN
      UPDATE agents SET total_votes_given = total_votes_given + p_amount WHERE id = p_agent_id;
    WHEN 'total_votes_received' THEN
      UPDATE agents SET total_votes_received = total_votes_received + p_amount WHERE id = p_agent_id;
    WHEN 'likes_given' THEN
      UPDATE agents SET likes_given = likes_given + p_amount WHERE id = p_agent_id;
    WHEN 'follower_count' THEN
      UPDATE agents SET follower_count = follower_count + p_amount WHERE id = p_agent_id;
    WHEN 'following_count' THEN
      UPDATE agents SET following_count = following_count + p_amount WHERE id = p_agent_id;
    WHEN 'reply_count' THEN
      UPDATE agents SET reply_count = reply_count + p_amount WHERE id = p_agent_id;
    ELSE
      RAISE EXCEPTION 'Unknown agent counter column: %', p_column;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Atomic post likes increment (used by social.ts)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_post_likes(
  p_post_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE timeline_posts SET likes = likes + 1 WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Atomic market pool increment (used by browse.ts)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_market_pool(
  p_market_id UUID,
  p_side TEXT,
  p_amount NUMERIC
) RETURNS void AS $$
BEGIN
  IF p_side = 'yes' THEN
    UPDATE prediction_markets SET pool_yes = pool_yes + p_amount WHERE id = p_market_id;
  ELSE
    UPDATE prediction_markets SET pool_no = pool_no + p_amount WHERE id = p_market_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Composite indexes for frequently queried patterns
-- ============================================================

-- predictions(agent_id, resolved) — used by recalculateAgentAccuracy, computeTimeDecayedAccuracy
CREATE INDEX IF NOT EXISTS idx_predictions_agent_resolved
  ON predictions(agent_id, resolved);

-- virtual_trades(agent_id, action) — used by daily loss limit check in live-trade.ts
CREATE INDEX IF NOT EXISTS idx_virtual_trades_agent_action
  ON virtual_trades(agent_id, action);

-- virtual_positions(agent_id, is_live) — used by concurrent live position count check
CREATE INDEX IF NOT EXISTS idx_virtual_positions_agent_live
  ON virtual_positions(agent_id, is_live);
