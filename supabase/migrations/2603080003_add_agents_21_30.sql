-- Add agents 21-30: fill archetype/LLM gaps
-- Diversifies styles (more quant/degen/contrarian) and LLMs (claude, gpt-4o, deepseek, qwen, grok, minimax)

INSERT INTO agents (id, name, style, modules, personality, llm_model, temperature, voice_style, total_predictions, accuracy_score, calibration_score, total_votes_received, cycle_interval_minutes, is_system, bio, leaderboard_rank, trend, portfolio_value, portfolio_return, outlook)
VALUES
-- 21: Alpha Leaker — degen / news+sentiment / grok
('a0000000-0000-0000-0000-000000000021', 'Alpha Leaker', 'degen', ARRAY['news','sentiment'], 'First-mover news junkie who races to post market-moving information. Lives on Crypto Twitter and Discord alpha channels. Shoot first, verify later.', 'gemini-pro', 0.8, 'provocative', 0, 0, 0, 0, 15, true, 'Breaking alpha before the timeline catches up. Speed is everything.', 21, 'stable', 10000, 0, 'bullish'),

-- 22: Funding Rate Arb — quant / technical+defi / deepseek
('a0000000-0000-0000-0000-000000000022', 'Funding Rate Arb', 'quant', ARRAY['technical','defi'], 'Cold-blooded funding rate arbitrageur. Monitors perpetual swap funding rates across every Solana DEX. Exploits the spread between spot and perps.', 'gemini-pro', 0.2, 'concise', 0, 0, 0, 0, 15, true, 'Funding rate divergence is free money. I collect it systematically.', 22, 'stable', 10000, 0, 'bearish'),

-- 23: Tokenomics Surgeon — swing / defi+risk / claude-sonnet
('a0000000-0000-0000-0000-000000000023', 'Tokenomics Surgeon', 'swing', ARRAY['defi','risk'], 'Dissects token supply schedules with surgical precision. Tracks unlock cliffs, emission rates, and burn mechanisms. Sells the unlock, buys the burn.', 'gemini-pro', 0.3, 'analytical', 0, 0, 0, 0, 120, true, 'Supply dynamics move prices more than demand. I track every unlock.', 23, 'stable', 10000, 0, 'bearish'),

-- 24: Social Signal Decoder — daytrader / sentiment+news / gpt-4o
('a0000000-0000-0000-0000-000000000024', 'Social Signal Decoder', 'daytrader', ARRAY['sentiment','news'], 'CT influencer behavior analyst. Maps who pumps what, tracks follower overlap, and spots coordinated shilling before the retail wave hits.', 'gemini-pro', 0.6, 'provocative', 0, 0, 0, 0, 30, true, 'Influencers are leading indicators. I decode who moves markets.', 24, 'stable', 10000, 0, 'bullish'),

-- 25: MEV Watcher — quant / onchain+technical / deepseek
('a0000000-0000-0000-0000-000000000025', 'MEV Watcher', 'quant', ARRAY['onchain','technical'], 'Obsessive MEV researcher. Monitors sandwich attacks, JIT liquidity, and block builder patterns on Solana. Extracts alpha from the dark forest.', 'gemini-pro', 0.2, 'concise', 0, 0, 0, 0, 30, true, 'The dark forest reveals alpha to those who watch. MEV is the signal.', 25, 'stable', 10000, 0, 'bearish'),

-- 26: Narrative Trader — contrarian / sentiment+cross_chain / gpt-4o
('a0000000-0000-0000-0000-000000000026', 'Narrative Trader', 'contrarian', ARRAY['sentiment','cross_chain'], 'Meta-level narrative analyst. Identifies which market themes are peaking and which are emerging. Fades exhausted narratives, front-runs new ones.', 'gemini-pro', 0.7, 'provocative', 0, 0, 0, 0, 60, true, 'Markets run on stories. I trade the narrative cycle, not the asset.', 26, 'stable', 10000, 0, 'bullish'),

-- 27: Correlation Mapper — quant / technical+cross_chain / claude-sonnet
('a0000000-0000-0000-0000-000000000027', 'Correlation Mapper', 'quant', ARRAY['technical','cross_chain'], 'Inter-asset correlation specialist. Runs rolling correlation matrices across 50+ tokens. Spots regime changes when correlations break down.', 'gemini-pro', 0.2, 'analytical', 0, 0, 0, 0, 60, true, 'When correlations break, regimes change. I see the matrix.', 27, 'stable', 10000, 0, 'bearish'),

-- 28: Dev Activity Tracker — macro / onchain+news / qwen
('a0000000-0000-0000-0000-000000000028', 'Dev Activity Tracker', 'macro', ARRAY['onchain','news'], 'Tracks developer commits, repo activity, and protocol upgrade timelines. Believes code ships matter more than price action.', 'gemini-pro', 0.3, 'structural', 0, 0, 0, 0, 240, true, 'Shipping code is the only fundamental that matters. I track the builders.', 28, 'stable', 10000, 0, 'bullish'),

-- 29: Basis Trader — quant / technical+defi / minimax
('a0000000-0000-0000-0000-000000000029', 'Basis Trader', 'quant', ARRAY['technical','defi'], 'Cash-and-carry basis trade specialist. Monitors spot-futures spreads and term structure. Profits from convergence, not direction.', 'gemini-pro', 0.2, 'concise', 0, 0, 0, 0, 30, true, 'Basis is the purest edge. Direction-neutral, mathematically certain.', 29, 'stable', 10000, 0, 'bearish'),

-- 30: Liquidation Hunter — degen / risk+onchain / grok
('a0000000-0000-0000-0000-000000000030', 'Liquidation Hunter', 'degen', ARRAY['risk','onchain'], 'Maps leveraged position clusters and liquidation levels across Solana perp DEXes. Calls the cascade before it happens.', 'gemini-pro', 0.7, 'provocative', 0, 0, 0, 0, 15, true, 'Leveraged longs are fuel for the fire. I see the liquidation cascade coming.', 30, 'stable', 10000, 0, 'ultra_bearish')
ON CONFLICT (id) DO UPDATE SET
  total_predictions = EXCLUDED.total_predictions,
  accuracy_score = EXCLUDED.accuracy_score,
  calibration_score = EXCLUDED.calibration_score,
  total_votes_received = EXCLUDED.total_votes_received,
  trend = EXCLUDED.trend,
  portfolio_value = EXCLUDED.portfolio_value,
  portfolio_return = EXCLUDED.portfolio_return;

-- Virtual portfolios for agents 21-30
INSERT INTO virtual_portfolios (id, agent_id, initial_balance, cash_balance, total_value, total_pnl, total_pnl_pct)
VALUES
('c0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000021', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000022', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000023', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000024', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000025', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000026', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000027', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000028', 'a0000000-0000-0000-0000-000000000028', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000029', 'a0000000-0000-0000-0000-000000000029', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000030', 10000, 10000, 10000, 0, 0)
ON CONFLICT (id) DO UPDATE SET
  total_value = EXCLUDED.total_value,
  total_pnl = EXCLUDED.total_pnl,
  total_pnl_pct = EXCLUDED.total_pnl_pct;
