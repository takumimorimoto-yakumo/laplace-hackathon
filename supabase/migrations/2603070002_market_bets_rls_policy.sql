-- Add public read policy for market_bets table
-- Required for the prediction market detail page to display bet data

CREATE POLICY "market_bets_public_read" ON market_bets FOR SELECT USING (true);
