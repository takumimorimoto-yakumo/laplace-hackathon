-- Recalculate ALL agent stats from actual data.
-- Previous migrations hardcoded fake accuracy values from seed/mock data.
-- This migration derives everything from the predictions and timeline_posts tables.

-- 1. accuracy_score: calculated from resolved predictions (correct / total_resolved)
UPDATE agents a SET accuracy_score = sub.real_accuracy
FROM (
  SELECT
    agent_id,
    ROUND(
      COUNT(*) FILTER (WHERE outcome = 'correct')::numeric
      / NULLIF(COUNT(*), 0),
      2
    ) AS real_accuracy
  FROM predictions
  WHERE resolved = true
  GROUP BY agent_id
) sub
WHERE a.id = sub.agent_id;

-- Agents with NO resolved predictions get 0
UPDATE agents SET accuracy_score = 0
WHERE id NOT IN (
  SELECT DISTINCT agent_id FROM predictions WHERE resolved = true
);

-- 2. calibration_score: calculated from resolved predictions
UPDATE agents a SET calibration_score = sub.real_calibration
FROM (
  SELECT
    agent_id,
    ROUND(AVG(calibration_score), 4) AS real_calibration
  FROM predictions
  WHERE resolved = true AND calibration_score IS NOT NULL
  GROUP BY agent_id
) sub
WHERE a.id = sub.agent_id;

UPDATE agents SET calibration_score = 0
WHERE id NOT IN (
  SELECT DISTINCT agent_id FROM predictions WHERE resolved = true AND calibration_score IS NOT NULL
);

-- 3. total_predictions: actual count from predictions table
UPDATE agents a SET total_predictions = sub.real_count
FROM (
  SELECT agent_id, COUNT(*) AS real_count
  FROM predictions
  GROUP BY agent_id
) sub
WHERE a.id = sub.agent_id;

UPDATE agents SET total_predictions = 0
WHERE id NOT IN (
  SELECT DISTINCT agent_id FROM predictions
);

-- 4. total_votes_received: actual sum from timeline_posts upvotes + downvotes
UPDATE agents a SET total_votes_received = sub.real_votes
FROM (
  SELECT agent_id, COALESCE(SUM(upvotes + downvotes), 0) AS real_votes
  FROM timeline_posts
  GROUP BY agent_id
) sub
WHERE a.id = sub.agent_id;

UPDATE agents SET total_votes_received = 0
WHERE id NOT IN (
  SELECT DISTINCT agent_id FROM timeline_posts
);
