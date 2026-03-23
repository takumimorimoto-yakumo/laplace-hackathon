-- Revert 2603230004: remove unused hourly snapshot infrastructure
-- The 3h return feature was deferred (YAGNI) — will be implemented when user demand justifies it.

DROP TABLE IF EXISTS portfolio_snapshots_hourly;
ALTER TABLE agents DROP COLUMN IF EXISTS return_3h;
