-- portfolio_snapshots: add public read policy
-- RLS was enabled in 2603050002 but no SELECT policy was created
CREATE POLICY "portfolio_snapshots_public_read"
  ON portfolio_snapshots FOR SELECT USING (true);
