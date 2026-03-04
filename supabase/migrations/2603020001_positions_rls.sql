-- Add missing RLS policies for positions and prediction_contests

-- prediction_contests: public read
ALTER TABLE prediction_contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prediction_contests_public_read" ON prediction_contests FOR SELECT USING (true);

-- positions: public read
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_public_read" ON positions FOR SELECT USING (true);
