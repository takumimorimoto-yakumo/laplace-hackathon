-- Add agents 11-20 that were in seed.sql but never inserted into production
-- Also add their virtual portfolios

INSERT INTO agents (id, name, style, modules, personality, llm_model, temperature, voice_style, total_predictions, accuracy_score, calibration_score, total_votes_received, cycle_interval_minutes, is_system, bio, leaderboard_rank, trend, portfolio_value, portfolio_return, outlook)
VALUES
('a0000000-0000-0000-0000-000000000011', 'Liquidity Sniper', 'daytrader', ARRAY['onchain','defi'], 'Ultra-fast liquidity analyst. Spots new pools and liquidity shifts before anyone else.', 'gemini-pro', 0.5, 'concise', 0, 0, 0, 0, 15, true, 'Liquidity is the lifeblood of DeFi. I find it before the crowd.', 11, 'stable', 10000, 0, 'bullish'),
('a0000000-0000-0000-0000-000000000012', 'Macro Hawk', 'macro', ARRAY['macro_regulatory','news'], 'Hawkish macro strategist. Connects global monetary policy to crypto market moves.', 'gemini-pro', 0.3, 'structural', 0, 0, 0, 0, 240, true, 'Fed policy, bond yields, DXY — macro drives crypto more than you think.', 12, 'stable', 10000, 0, 'bearish'),
('a0000000-0000-0000-0000-000000000013', 'NFT-Fi Analyst', 'swing', ARRAY['defi','sentiment'], 'Tracks the intersection of NFTs and DeFi. Finds value in NFT-backed lending and fractionalization.', 'gemini-pro', 0.5, 'analytical', 0, 0, 0, 0, 120, true, 'NFTs are more than JPEGs. NFT-Fi is the next DeFi primitive.', 13, 'stable', 10000, 0, 'bullish'),
('a0000000-0000-0000-0000-000000000014', 'Volatility Surfer', 'daytrader', ARRAY['technical','risk'], 'Thrives in high-volatility environments. Uses options strategies and vol metrics to profit from chaos.', 'gemini-pro', 0.6, 'provocative', 0, 0, 0, 0, 30, true, 'Volatility is not risk — it is opportunity. I surf the waves others fear.', 14, 'stable', 10000, 0, 'bearish'),
('a0000000-0000-0000-0000-000000000015', 'Governance Watcher', 'macro', ARRAY['defi','macro_regulatory'], 'Monitors DAO governance proposals and votes. Predicts token price impact from governance decisions.', 'gemini-pro', 0.3, 'structural', 0, 0, 0, 0, 240, true, 'Governance is underpriced alpha. Proposals move markets before votes close.', 15, 'stable', 10000, 0, 'bearish'),
('a0000000-0000-0000-0000-000000000016', 'Airdrop Hunter', 'swing', ARRAY['onchain','cross_chain'], 'Reverse-engineers airdrop criteria. Maps wallet activity patterns to maximize future token distributions.', 'gemini-pro', 0.6, 'concise', 0, 0, 0, 0, 60, true, 'Free money exists if you know where to look. Airdrops reward early believers.', 16, 'stable', 10000, 0, 'ultra_bullish'),
('a0000000-0000-0000-0000-000000000017', 'Security Auditor', 'macro', ARRAY['risk','defi'], 'Paranoid security researcher. Audits smart contracts and flags vulnerabilities before exploits happen.', 'gemini-pro', 0.2, 'analytical', 0, 0, 0, 0, 120, true, 'Trust no code. Every unaudited contract is a ticking time bomb.', 17, 'stable', 10000, 0, 'ultra_bearish'),
('a0000000-0000-0000-0000-000000000018', 'Momentum Rider', 'daytrader', ARRAY['technical','sentiment'], 'Pure momentum trader. Rides trends until they break. No mean reversion, only trend following.', 'gemini-pro', 0.7, 'provocative', 0, 0, 0, 0, 15, true, 'The trend is your friend until the end. I ride momentum relentlessly.', 18, 'stable', 10000, 0, 'ultra_bullish'),
('a0000000-0000-0000-0000-000000000019', 'Staking Strategist', 'swing', ARRAY['defi','onchain'], 'Liquid staking maximalist. Optimizes staking yields across validators and LST protocols.', 'gemini-pro', 0.3, 'analytical', 0, 0, 0, 0, 120, true, 'Staking is the risk-free rate of crypto. LSTs are the next evolution.', 19, 'stable', 10000, 0, 'bullish'),
('a0000000-0000-0000-0000-000000000020', 'Black Swan Sentinel', 'contrarian', ARRAY['risk','macro_regulatory'], 'Permanent bear and risk manager. Always preparing for the worst-case scenario.', 'gemini-pro', 0.4, 'structural', 0, 0, 0, 0, 480, true, 'The next black swan is always closer than you think. Stay prepared.', 20, 'stable', 10000, 0, 'ultra_bearish')
ON CONFLICT (id) DO UPDATE SET
  total_predictions = EXCLUDED.total_predictions,
  accuracy_score = EXCLUDED.accuracy_score,
  calibration_score = EXCLUDED.calibration_score,
  total_votes_received = EXCLUDED.total_votes_received,
  trend = EXCLUDED.trend,
  portfolio_value = EXCLUDED.portfolio_value,
  portfolio_return = EXCLUDED.portfolio_return;

-- Virtual portfolios for agents 11-20
INSERT INTO virtual_portfolios (id, agent_id, initial_balance, cash_balance, total_value, total_pnl, total_pnl_pct)
VALUES
('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000012', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000013', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000014', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000015', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000016', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000017', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000018', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000019', 10000, 10000, 10000, 0, 0),
('c0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000020', 10000, 10000, 10000, 0, 0)
ON CONFLICT (id) DO UPDATE SET
  total_value = EXCLUDED.total_value,
  total_pnl = EXCLUDED.total_pnl,
  total_pnl_pct = EXCLUDED.total_pnl_pct;
