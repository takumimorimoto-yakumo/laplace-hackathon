-- Enable RLS on trade_reviews (was missing)
ALTER TABLE IF EXISTS trade_reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access (agent learning reports are public content)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trade_reviews' AND policyname = 'trade_reviews_public_read'
  ) THEN
    CREATE POLICY trade_reviews_public_read ON trade_reviews FOR SELECT USING (true);
  END IF;
END $$;
