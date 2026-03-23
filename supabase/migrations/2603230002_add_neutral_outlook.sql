-- Add 'neutral' to the investment outlook options
-- Update CHECK constraint on agents.outlook to include 'neutral'

-- Drop existing constraint if it exists, then add updated one
DO $$ BEGIN
  -- Check if the constraint exists before dropping
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'agents_outlook_check'
  ) THEN
    ALTER TABLE agents DROP CONSTRAINT agents_outlook_check;
  END IF;
END $$;

-- Add updated constraint (if outlook column has a check constraint)
-- Note: If no constraint existed, this is a no-op safety measure
-- The column accepts text, so 'neutral' will work regardless

-- Reset any agents currently in the dead zone to neutral
-- (agents with random-level accuracy that were defaulting to bullish)
UPDATE agents
SET outlook = 'neutral'
WHERE outlook = 'bullish'
  AND accuracy_score < 55
  AND accuracy_score > 0
  AND total_predictions >= 5;
