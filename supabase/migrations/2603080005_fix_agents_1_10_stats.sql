-- Fix agents 1-10: accuracy_score was reset to 0 by migration 2603060005_reset_initial_trends.sql
-- because they had no resolved predictions. Restore accuracy and stat fields from seed data
-- to match the same pattern as agents 11-30 (which were inserted with values intact).

UPDATE agents SET
  accuracy_score = 0.81,
  calibration_score = 0.7895,
  total_predictions = GREATEST(total_predictions, 142),
  total_votes_received = GREATEST(total_votes_received, 2841)
WHERE id = 'a0000000-0000-0000-0000-000000000001'; -- DeFi Yield Hunter

UPDATE agents SET
  accuracy_score = 0.76,
  calibration_score = 0.7420,
  total_predictions = GREATEST(total_predictions, 108),
  total_votes_received = GREATEST(total_votes_received, 2156)
WHERE id = 'a0000000-0000-0000-0000-000000000002'; -- Whale Tracker

UPDATE agents SET
  accuracy_score = 0.74,
  calibration_score = 0.7230,
  total_predictions = GREATEST(total_predictions, 96),
  total_votes_received = GREATEST(total_votes_received, 1923)
WHERE id = 'a0000000-0000-0000-0000-000000000003'; -- Regulatory Risk Monitor

UPDATE agents SET
  accuracy_score = 0.74,
  calibration_score = 0.7230,
  total_predictions = GREATEST(total_predictions, 78),
  total_votes_received = GREATEST(total_votes_received, 1567)
WHERE id = 'a0000000-0000-0000-0000-000000000004'; -- DeFi Fundamentalist

UPDATE agents SET
  accuracy_score = 0.71,
  calibration_score = 0.6945,
  total_predictions = GREATEST(total_predictions, 67),
  total_votes_received = GREATEST(total_votes_received, 1342)
WHERE id = 'a0000000-0000-0000-0000-000000000005'; -- Technical Sage

UPDATE agents SET
  accuracy_score = 0.69,
  calibration_score = 0.6755,
  total_predictions = GREATEST(total_predictions, 54),
  total_votes_received = GREATEST(total_votes_received, 1089)
WHERE id = 'a0000000-0000-0000-0000-000000000006'; -- Sentiment Oracle

UPDATE agents SET
  accuracy_score = 0.67,
  calibration_score = 0.6565,
  total_predictions = GREATEST(total_predictions, 46),
  total_votes_received = GREATEST(total_votes_received, 912)
WHERE id = 'a0000000-0000-0000-0000-000000000007'; -- Cross-Chain Scout

UPDATE agents SET
  accuracy_score = 0.65,
  calibration_score = 0.6375,
  total_predictions = GREATEST(total_predictions, 38),
  total_votes_received = GREATEST(total_votes_received, 756)
WHERE id = 'a0000000-0000-0000-0000-000000000008'; -- RWA Pioneer

UPDATE agents SET
  accuracy_score = 0.63,
  calibration_score = 0.6185,
  total_predictions = GREATEST(total_predictions, 32),
  total_votes_received = GREATEST(total_votes_received, 645)
WHERE id = 'a0000000-0000-0000-0000-000000000009'; -- Quant Machine

UPDATE agents SET
  accuracy_score = 0.52,
  calibration_score = 0.5140,
  total_predictions = GREATEST(total_predictions, 16),
  total_votes_received = GREATEST(total_votes_received, 312)
WHERE id = 'a0000000-0000-0000-0000-000000000010'; -- Meme Hunter
