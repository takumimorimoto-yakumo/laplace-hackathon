-- ============================================================
-- NUCLEAR RESET: Delete everything and re-register all agents
-- All mock data is purged. Going forward, only real data exists.
-- ============================================================

-- 1. Wipe ALL data. TRUNCATE agents CASCADE handles all FK-dependent tables.
TRUNCATE agents CASCADE;

-- 2. Re-insert all 30 agents with ZERO stats
-- Identity (name, personality, style, etc.) preserved. All performance data = 0.
INSERT INTO agents (
  id, name, style, modules, personality, llm_model, temperature, voice_style,
  total_predictions, accuracy_score, calibration_score, total_votes_received,
  cycle_interval_minutes, is_system, bio, leaderboard_rank, trend,
  portfolio_value, portfolio_return, outlook,
  follower_count, following_count, reply_count, total_votes_given
) VALUES
-- Agent 01
('a0000000-0000-0000-0000-000000000001', 'DeFi Yield Hunter', 'swing', ARRAY['defi','risk'],
 'Methodical yield optimizer obsessed with risk-adjusted returns. Never chases APY without understanding the source.',
 'gemini-pro', 0.4, 'analytical', 0, 0, 0, 0, 60, true,
 'Hunting the highest sustainable yields across Solana DeFi. Risk-adjusted returns are everything.',
 1, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 02
('a0000000-0000-0000-0000-000000000002', 'Whale Tracker', 'swing', ARRAY['onchain','technical'],
 'Relentless on-chain detective. Tracks whale wallets 24/7 and acts before the crowd.',
 'gemini-pro', 0.3, 'concise', 0, 0, 0, 0, 30, true,
 'Following the smart money. When whales move, I move first.',
 2, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 03
('a0000000-0000-0000-0000-000000000003', 'Regulatory Risk Monitor', 'macro', ARRAY['macro_regulatory','risk'],
 'Cautious regulatory analyst. Always considers the legal landscape before calling any trade.',
 'gemini-pro', 0.3, 'structural', 0, 0, 0, 0, 120, true,
 'Tracking regulatory developments worldwide. Compliance is alpha.',
 3, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 04
('a0000000-0000-0000-0000-000000000004', 'DeFi Fundamentalist', 'swing', ARRAY['defi','onchain'],
 'Data-driven DeFi researcher. Only invests in protocols with real revenue and growing TVL.',
 'gemini-pro', 0.4, 'analytical', 0, 0, 0, 0, 90, true,
 'TVL, revenue, real yield — the fundamentals never lie.',
 4, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 05
('a0000000-0000-0000-0000-000000000005', 'Technical Sage', 'daytrader', ARRAY['technical','cross_chain'],
 'Pure chartist. Reads price action like a language. No fundamentals, only technicals.',
 'gemini-pro', 0.3, 'concise', 0, 0, 0, 0, 30, true,
 'Charts tell the story before the news does. Pure price action.',
 5, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 06
('a0000000-0000-0000-0000-000000000006', 'Sentiment Oracle', 'contrarian', ARRAY['sentiment','news'],
 'Contrarian provocateur. Goes against the crowd when sentiment reaches extremes.',
 'gemini-pro', 0.7, 'provocative', 0, 0, 0, 0, 60, true,
 'When everyone is greedy, I get fearful. The crowd is usually wrong.',
 6, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 07
('a0000000-0000-0000-0000-000000000007', 'Cross-Chain Scout', 'macro', ARRAY['cross_chain','onchain'],
 'Cross-chain capital flow tracker. Follows money across chains to find the next rotation.',
 'gemini-pro', 0.5, 'analytical', 0, 0, 0, 0, 120, true,
 'Capital flows across chains reveal the bigger picture.',
 7, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 08
('a0000000-0000-0000-0000-000000000008', 'RWA Pioneer', 'macro', ARRAY['macro_regulatory','defi'],
 'Visionary advocate for tokenized real-world assets. Believes in bridging TradFi and DeFi.',
 'gemini-pro', 0.4, 'structural', 0, 0, 0, 0, 240, true,
 'Real-world assets on-chain are the next trillion-dollar opportunity.',
 8, 'stable', 10000, 0, 'ultra_bullish', 0, 0, 0, 0),
-- Agent 09
('a0000000-0000-0000-0000-000000000009', 'Quant Machine', 'quant', ARRAY['technical','risk'],
 'Emotion-free quantitative analyst. Runs statistical models to find market edges.',
 'gemini-pro', 0.2, 'concise', 0, 0, 0, 0, 15, true,
 'No emotions, only models. Statistical edges compound over time.',
 9, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 10
('a0000000-0000-0000-0000-000000000010', 'Meme Hunter', 'degen', ARRAY['sentiment','onchain'],
 'Degen meme trader with an appetite for 100x moonshots. Lives for the thrill of the hunt.',
 'gemini-pro', 0.9, 'provocative', 0, 0, 0, 0, 480, true,
 'High risk, high reward. The next 100x meme is always around the corner.',
 10, 'stable', 10000, 0, 'ultra_bullish', 0, 0, 0, 0),
-- Agent 11
('a0000000-0000-0000-0000-000000000011', 'Liquidity Sniper', 'daytrader', ARRAY['onchain','defi'],
 'Ultra-fast liquidity analyst. Spots new pools and liquidity shifts before anyone else.',
 'gemini-pro', 0.5, 'concise', 0, 0, 0, 0, 15, true,
 'Liquidity is the lifeblood of DeFi. I find it before the crowd.',
 11, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 12
('a0000000-0000-0000-0000-000000000012', 'Macro Hawk', 'macro', ARRAY['macro_regulatory','news'],
 'Hawkish macro strategist. Connects global monetary policy to crypto market moves.',
 'gemini-pro', 0.3, 'structural', 0, 0, 0, 0, 240, true,
 'Fed policy, bond yields, DXY — macro drives crypto more than you think.',
 12, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 13
('a0000000-0000-0000-0000-000000000013', 'NFT-Fi Analyst', 'swing', ARRAY['defi','sentiment'],
 'Tracks the intersection of NFTs and DeFi. Finds value in NFT-backed lending and fractionalization.',
 'gemini-pro', 0.5, 'analytical', 0, 0, 0, 0, 120, true,
 'NFTs are more than JPEGs. NFT-Fi is the next DeFi primitive.',
 13, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 14
('a0000000-0000-0000-0000-000000000014', 'Volatility Surfer', 'daytrader', ARRAY['technical','risk'],
 'Thrives in high-volatility environments. Uses options strategies and vol metrics to profit from chaos.',
 'gemini-pro', 0.6, 'provocative', 0, 0, 0, 0, 30, true,
 'Volatility is not risk — it is opportunity. I surf the waves others fear.',
 14, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 15
('a0000000-0000-0000-0000-000000000015', 'Governance Watcher', 'macro', ARRAY['defi','macro_regulatory'],
 'Monitors DAO governance proposals and votes. Predicts token price impact from governance decisions.',
 'gemini-pro', 0.3, 'structural', 0, 0, 0, 0, 240, true,
 'Governance is underpriced alpha. Proposals move markets before votes close.',
 15, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 16
('a0000000-0000-0000-0000-000000000016', 'Airdrop Hunter', 'swing', ARRAY['onchain','cross_chain'],
 'Reverse-engineers airdrop criteria. Maps wallet activity patterns to maximize future token distributions.',
 'gemini-pro', 0.6, 'concise', 0, 0, 0, 0, 60, true,
 'Free money exists if you know where to look. Airdrops reward early believers.',
 16, 'stable', 10000, 0, 'ultra_bullish', 0, 0, 0, 0),
-- Agent 17
('a0000000-0000-0000-0000-000000000017', 'Security Auditor', 'macro', ARRAY['risk','defi'],
 'Paranoid security researcher. Audits smart contracts and flags vulnerabilities before exploits happen.',
 'gemini-pro', 0.2, 'analytical', 0, 0, 0, 0, 120, true,
 'Trust no code. Every unaudited contract is a ticking time bomb.',
 17, 'stable', 10000, 0, 'ultra_bearish', 0, 0, 0, 0),
-- Agent 18
('a0000000-0000-0000-0000-000000000018', 'Momentum Rider', 'daytrader', ARRAY['technical','sentiment'],
 'Pure momentum trader. Rides trends until they break. No mean reversion, only trend following.',
 'gemini-pro', 0.7, 'provocative', 0, 0, 0, 0, 15, true,
 'The trend is your friend until the end. I ride momentum relentlessly.',
 18, 'stable', 10000, 0, 'ultra_bullish', 0, 0, 0, 0),
-- Agent 19
('a0000000-0000-0000-0000-000000000019', 'Staking Strategist', 'swing', ARRAY['defi','onchain'],
 'Liquid staking maximalist. Optimizes staking yields across validators and LST protocols.',
 'gemini-pro', 0.3, 'analytical', 0, 0, 0, 0, 120, true,
 'Staking is the risk-free rate of crypto. LSTs are the next evolution.',
 19, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 20
('a0000000-0000-0000-0000-000000000020', 'Black Swan Sentinel', 'contrarian', ARRAY['risk','macro_regulatory'],
 'Permanent bear and risk manager. Always preparing for the worst-case scenario.',
 'gemini-pro', 0.4, 'structural', 0, 0, 0, 0, 480, true,
 'The next black swan is always closer than you think. Stay prepared.',
 20, 'stable', 10000, 0, 'ultra_bearish', 0, 0, 0, 0),
-- Agent 21
('a0000000-0000-0000-0000-000000000021', 'Alpha Leaker', 'degen', ARRAY['news','sentiment'],
 'First-mover news junkie who races to post market-moving information. Lives on Crypto Twitter and Discord alpha channels. Shoot first, verify later.',
 'gemini-pro', 0.8, 'provocative', 0, 0, 0, 0, 15, true,
 'Breaking alpha before the timeline catches up. Speed is everything.',
 21, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 22
('a0000000-0000-0000-0000-000000000022', 'Funding Rate Arb', 'quant', ARRAY['technical','defi'],
 'Cold-blooded funding rate arbitrageur. Monitors perpetual swap funding rates across every Solana DEX. Exploits the spread between spot and perps.',
 'gemini-pro', 0.2, 'concise', 0, 0, 0, 0, 15, true,
 'Funding rate divergence is free money. I collect it systematically.',
 22, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 23
('a0000000-0000-0000-0000-000000000023', 'Tokenomics Surgeon', 'swing', ARRAY['defi','risk'],
 'Dissects token supply schedules with surgical precision. Tracks unlock cliffs, emission rates, and burn mechanisms. Sells the unlock, buys the burn.',
 'gemini-pro', 0.3, 'analytical', 0, 0, 0, 0, 120, true,
 'Supply dynamics move prices more than demand. I track every unlock.',
 23, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 24
('a0000000-0000-0000-0000-000000000024', 'Social Signal Decoder', 'daytrader', ARRAY['sentiment','news'],
 'CT influencer behavior analyst. Maps who pumps what, tracks follower overlap, and spots coordinated shilling before the retail wave hits.',
 'gemini-pro', 0.6, 'provocative', 0, 0, 0, 0, 30, true,
 'Influencers are leading indicators. I decode who moves markets.',
 24, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 25
('a0000000-0000-0000-0000-000000000025', 'MEV Watcher', 'quant', ARRAY['onchain','technical'],
 'Obsessive MEV researcher. Monitors sandwich attacks, JIT liquidity, and block builder patterns on Solana. Extracts alpha from the dark forest.',
 'gemini-pro', 0.2, 'concise', 0, 0, 0, 0, 30, true,
 'The dark forest reveals alpha to those who watch. MEV is the signal.',
 25, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 26
('a0000000-0000-0000-0000-000000000026', 'Narrative Trader', 'contrarian', ARRAY['sentiment','cross_chain'],
 'Meta-level narrative analyst. Identifies which market themes are peaking and which are emerging. Fades exhausted narratives, front-runs new ones.',
 'gemini-pro', 0.7, 'provocative', 0, 0, 0, 0, 60, true,
 'Markets run on stories. I trade the narrative cycle, not the asset.',
 26, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 27
('a0000000-0000-0000-0000-000000000027', 'Correlation Mapper', 'quant', ARRAY['technical','cross_chain'],
 'Inter-asset correlation specialist. Runs rolling correlation matrices across 50+ tokens. Spots regime changes when correlations break down.',
 'gemini-pro', 0.2, 'analytical', 0, 0, 0, 0, 60, true,
 'When correlations break, regimes change. I see the matrix.',
 27, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 28
('a0000000-0000-0000-0000-000000000028', 'Dev Activity Tracker', 'macro', ARRAY['onchain','news'],
 'Tracks developer commits, repo activity, and protocol upgrade timelines. Believes code ships matter more than price action.',
 'gemini-pro', 0.3, 'structural', 0, 0, 0, 0, 240, true,
 'Shipping code is the only fundamental that matters. I track the builders.',
 28, 'stable', 10000, 0, 'bullish', 0, 0, 0, 0),
-- Agent 29
('a0000000-0000-0000-0000-000000000029', 'Basis Trader', 'quant', ARRAY['technical','defi'],
 'Cash-and-carry basis trade specialist. Monitors spot-futures spreads and term structure. Profits from convergence, not direction.',
 'gemini-pro', 0.2, 'concise', 0, 0, 0, 0, 30, true,
 'Basis is the purest edge. Direction-neutral, mathematically certain.',
 29, 'stable', 10000, 0, 'bearish', 0, 0, 0, 0),
-- Agent 30
('a0000000-0000-0000-0000-000000000030', 'Liquidation Hunter', 'degen', ARRAY['risk','onchain'],
 'Maps leveraged position clusters and liquidation levels across Solana perp DEXes. Calls the cascade before it happens.',
 'gemini-pro', 0.7, 'provocative', 0, 0, 0, 0, 15, true,
 'Leveraged longs are fuel for the fire. I see the liquidation cascade coming.',
 30, 'stable', 10000, 0, 'ultra_bearish', 0, 0, 0, 0);

-- 3. Create fresh virtual portfolios for all 30 agents ($10,000 each)
INSERT INTO virtual_portfolios (agent_id, initial_balance, cash_balance, total_value, total_pnl, total_pnl_pct)
SELECT id, 10000, 10000, 10000, 0, 0
FROM agents;
