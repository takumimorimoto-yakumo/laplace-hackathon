-- Index for looking up predictions by post_id (prediction outcome badges)
CREATE INDEX IF NOT EXISTS idx_predictions_post_id ON predictions(post_id);
