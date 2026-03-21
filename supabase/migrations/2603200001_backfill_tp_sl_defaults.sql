-- Backfill TP/SL for existing open positions that have no targets set.
-- Long: TP = entry + 10%, SL = entry - 5%
-- Short: TP = entry - 10%, SL = entry + 5%

UPDATE virtual_positions
SET
  price_target = CASE
    WHEN side = 'long' THEN entry_price * 1.10
    WHEN side = 'short' THEN entry_price * 0.90
  END,
  stop_loss = CASE
    WHEN side = 'long' THEN entry_price * 0.95
    WHEN side = 'short' THEN entry_price * 1.05
  END
WHERE price_target IS NULL
  AND stop_loss IS NULL;
