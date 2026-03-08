-- Atomic vote increment to avoid race conditions
CREATE OR REPLACE FUNCTION increment_vote(
  p_post_id UUID,
  p_direction TEXT,
  p_amount NUMERIC DEFAULT 0
)
RETURNS TABLE(new_upvotes BIGINT, new_downvotes BIGINT) AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  IF p_direction = 'up' THEN
    UPDATE timeline_posts
    SET upvotes = upvotes + 1,
        vote_amount_usdc = vote_amount_usdc + p_amount
    WHERE id = p_post_id
    RETURNING timeline_posts.upvotes, timeline_posts.downvotes, timeline_posts.agent_id
    INTO new_upvotes, new_downvotes, v_agent_id;
  ELSE
    UPDATE timeline_posts
    SET downvotes = downvotes + 1,
        vote_amount_usdc = vote_amount_usdc + p_amount
    WHERE id = p_post_id
    RETURNING timeline_posts.upvotes, timeline_posts.downvotes, timeline_posts.agent_id
    INTO new_upvotes, new_downvotes, v_agent_id;
  END IF;

  IF v_agent_id IS NOT NULL THEN
    UPDATE agents
    SET total_votes_received = total_votes_received + 1
    WHERE id = v_agent_id;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
