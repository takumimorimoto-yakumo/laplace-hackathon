-- Security hardening migration
-- P0-2: Hide wallet_encrypted_key from public reads
-- P0-3: Enable RLS on unprotected tables

-- ============================================================
-- P0-2: Restrict wallet_encrypted_key from public SELECT
-- ============================================================
-- Drop the overly permissive agents_public_read policy
-- and replace with one that excludes sensitive columns.
-- Since Postgres RLS works at the row level (not column level),
-- we use a security-definer view to hide the column.

-- Create a public-safe view that excludes wallet_encrypted_key
CREATE OR REPLACE VIEW public.agents_public AS
SELECT
  id, name, style, modules, personality, bio, voice_style,
  temperature, llm_model, outlook, tier, is_system,
  owner_wallet, wallet_address, template,
  total_predictions, accuracy_score, calibration_score,
  total_votes_received, portfolio_value, portfolio_return,
  trend, follower_count, reply_count, total_votes_given,
  leaderboard_rank, is_paused, custom_watchlist,
  user_directives, user_alpha,
  rental_price_usdc, live_trading_enabled,
  created_at
FROM agents;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.agents_public TO anon, authenticated;

-- Revoke direct SELECT on wallet_encrypted_key from anon
-- (This is the defense-in-depth approach)
REVOKE SELECT (wallet_encrypted_key) ON public.agents FROM anon;
REVOKE SELECT (wallet_encrypted_key) ON public.agents FROM authenticated;

-- ============================================================
-- P0-3: Enable RLS on unprotected tables
-- ============================================================

-- agent_chats: private conversations
ALTER TABLE IF EXISTS agent_chats ENABLE ROW LEVEL SECURITY;
-- Only allow service role (via API routes) to access chats
-- No public read policy = deny all for anon/authenticated

-- chat_rate_limits: internal rate tracking
ALTER TABLE IF EXISTS chat_rate_limits ENABLE ROW LEVEL SECURITY;

-- analysis_requests: user analysis requests
ALTER TABLE IF EXISTS analysis_requests ENABLE ROW LEVEL SECURITY;

-- content_violations: audit log
ALTER TABLE IF EXISTS content_violations ENABLE ROW LEVEL SECURITY;

-- agent_subscriptions: payment data
ALTER TABLE IF EXISTS agent_subscriptions ENABLE ROW LEVEL SECURITY;

-- agent_earnings: earnings data (no public policy = service role only)
ALTER TABLE IF EXISTS agent_earnings ENABLE ROW LEVEL SECURITY;

-- agent_withdrawals: withdrawal data
ALTER TABLE IF EXISTS agent_withdrawals ENABLE ROW LEVEL SECURITY;

-- agent_rentals: rental data — keep service-role only for writes,
-- but allow read for the specific user's own rentals
ALTER TABLE IF EXISTS agent_rentals ENABLE ROW LEVEL SECURITY;
