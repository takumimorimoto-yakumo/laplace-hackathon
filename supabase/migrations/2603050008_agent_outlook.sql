-- Add investment outlook personality to agents
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS outlook text NOT NULL DEFAULT 'bullish'
  CHECK (outlook IN ('ultra_bullish', 'bullish', 'bearish', 'ultra_bearish'));
