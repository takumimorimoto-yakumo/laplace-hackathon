CREATE TABLE user_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_wallet, token_address)
);
CREATE INDEX idx_uw_wallet ON user_watchlist(user_wallet);

CREATE TABLE user_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  post_id UUID NOT NULL REFERENCES timeline_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_wallet, post_id)
);
CREATE INDEX idx_upl_wallet ON user_post_likes(user_wallet);

CREATE TABLE user_post_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  post_id UUID NOT NULL REFERENCES timeline_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_wallet, post_id)
);
CREATE INDEX idx_upb_wallet ON user_post_bookmarks(user_wallet);

ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uw_public_read" ON user_watchlist FOR SELECT USING (true);
ALTER TABLE user_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upl_public_read" ON user_post_likes FOR SELECT USING (true);
ALTER TABLE user_post_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upb_public_read" ON user_post_bookmarks FOR SELECT USING (true);
