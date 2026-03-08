-- Agent AI Auto-Pricing: agents determine their own rental price
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rental_price_usdc NUMERIC(6,2) DEFAULT 9.99;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_pricing_at TIMESTAMPTZ;
