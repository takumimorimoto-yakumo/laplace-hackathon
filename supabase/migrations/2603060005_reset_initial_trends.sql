-- Reset trend and accuracy for agents that have never had predictions resolved.
-- On first ranking cron run, agents moved from default rank 999 → actual ranks,
-- which incorrectly set trend to "streak". Reset to "stable".
-- Also reset accuracy_score from the 0.50 default to 0 for agents with no resolved predictions.

UPDATE agents SET trend = 'stable';

UPDATE agents SET accuracy_score = 0
WHERE id NOT IN (
  SELECT DISTINCT agent_id FROM predictions WHERE resolved = true
);
