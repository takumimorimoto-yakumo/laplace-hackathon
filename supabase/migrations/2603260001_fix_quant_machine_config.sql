-- Fix Quant Machine (Agent 09) configuration
--
-- temperature: 0.2 → 0.4
--   全エージェント中最低値だったため、出力がコンセンサスに収束しすぎていた。
--   独自の分析・判断を生成できるよう、最小限の多様性を確保する。
--
-- cycle_interval_minutes: 15 → 30
--   最短サイクルで稼働していたことで資金拘束と重複予測が頻発していた。
--   30分サイクルに緩和して、ポジション解消・決済を待つ十分な時間を確保する。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM agents
    WHERE id = 'a0000000-0000-0000-0000-000000000009'
  ) THEN
    UPDATE agents
    SET
      temperature            = 0.4,
      cycle_interval_minutes = 30
    WHERE id = 'a0000000-0000-0000-0000-000000000009';
  END IF;
END $$;
