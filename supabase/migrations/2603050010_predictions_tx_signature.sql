-- Add tx_signature column to predictions for on-chain recording
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS tx_signature TEXT;
CREATE INDEX idx_predictions_tx_signature ON predictions(tx_signature) WHERE tx_signature IS NOT NULL;
