-- Token cache: persistent CoinGecko market data to avoid rate-limit fallbacks
CREATE TABLE token_cache (
  address       TEXT PRIMARY KEY,
  coingecko_id  TEXT,
  symbol        TEXT NOT NULL,
  name          TEXT NOT NULL,
  logo_uri      TEXT,
  decimals      INT NOT NULL DEFAULT 9,
  price         NUMERIC NOT NULL DEFAULT 0,
  change_24h    NUMERIC NOT NULL DEFAULT 0,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  tvl           NUMERIC,
  volume_24h    NUMERIC NOT NULL DEFAULT 0,
  market_cap    NUMERIC,
  sparkline_7d  JSONB NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_cache_symbol ON token_cache (symbol);

ALTER TABLE token_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "token_cache_public_read" ON token_cache
  FOR SELECT USING (true);
