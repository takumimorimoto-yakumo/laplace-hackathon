-- ============================================================
-- 7-Axis Agent Configuration
-- Add time_horizon, reasoning_style, risk_tolerance, asset_focus
-- ============================================================

-- Add new columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS time_horizon text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS reasoning_style text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS risk_tolerance text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS asset_focus text;

-- Add CHECK constraints
ALTER TABLE agents DROP CONSTRAINT IF EXISTS chk_time_horizon;
ALTER TABLE agents ADD CONSTRAINT chk_time_horizon
  CHECK (time_horizon IS NULL OR time_horizon IN ('scalp','intraday','swing','position','long_term'));

ALTER TABLE agents DROP CONSTRAINT IF EXISTS chk_reasoning_style;
ALTER TABLE agents ADD CONSTRAINT chk_reasoning_style
  CHECK (reasoning_style IS NULL OR reasoning_style IN ('momentum','contrarian','fundamental','quantitative','narrative'));

ALTER TABLE agents DROP CONSTRAINT IF EXISTS chk_risk_tolerance;
ALTER TABLE agents ADD CONSTRAINT chk_risk_tolerance
  CHECK (risk_tolerance IS NULL OR risk_tolerance IN ('conservative','moderate','aggressive','degen'));

ALTER TABLE agents DROP CONSTRAINT IF EXISTS chk_asset_focus;
ALTER TABLE agents ADD CONSTRAINT chk_asset_focus
  CHECK (asset_focus IS NULL OR asset_focus IN ('blue_chip','defi_tokens','meme','infrastructure','broad'));

-- Update all 30 system agents with 7-axis configuration
UPDATE agents SET time_horizon = 'swing', reasoning_style = 'fundamental', risk_tolerance = 'moderate', asset_focus = 'defi_tokens'
WHERE name = 'DeFi Yield Hunter' AND tier = 'system';

UPDATE agents SET time_horizon = 'swing', reasoning_style = 'momentum', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Whale Tracker' AND tier = 'system';

UPDATE agents SET time_horizon = 'long_term', reasoning_style = 'fundamental', risk_tolerance = 'conservative', asset_focus = 'broad'
WHERE name = 'Regulatory Risk Monitor' AND tier = 'system';

UPDATE agents SET time_horizon = 'swing', reasoning_style = 'fundamental', risk_tolerance = 'moderate', asset_focus = 'defi_tokens'
WHERE name = 'DeFi Fundamentalist' AND tier = 'system';

UPDATE agents SET time_horizon = 'intraday', reasoning_style = 'quantitative', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Technical Sage' AND tier = 'system';

UPDATE agents SET time_horizon = 'swing', reasoning_style = 'contrarian', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Sentiment Oracle' AND tier = 'system';

UPDATE agents SET time_horizon = 'position', reasoning_style = 'fundamental', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Cross-Chain Scout' AND tier = 'system';

UPDATE agents SET time_horizon = 'long_term', reasoning_style = 'narrative', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'RWA Pioneer' AND tier = 'system';

UPDATE agents SET time_horizon = 'intraday', reasoning_style = 'quantitative', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Quant Machine' AND tier = 'system';

UPDATE agents SET time_horizon = 'scalp', reasoning_style = 'narrative', risk_tolerance = 'degen', asset_focus = 'meme'
WHERE name = 'Meme Hunter' AND tier = 'system';

UPDATE agents SET time_horizon = 'intraday', reasoning_style = 'momentum', risk_tolerance = 'aggressive', asset_focus = 'defi_tokens'
WHERE name = 'Liquidity Sniper' AND tier = 'system';

UPDATE agents SET time_horizon = 'long_term', reasoning_style = 'fundamental', risk_tolerance = 'conservative', asset_focus = 'broad'
WHERE name = 'Macro Hawk' AND tier = 'system';

UPDATE agents SET time_horizon = 'swing', reasoning_style = 'fundamental', risk_tolerance = 'moderate', asset_focus = 'defi_tokens'
WHERE name = 'NFT-Fi Analyst' AND tier = 'system';

UPDATE agents SET time_horizon = 'intraday', reasoning_style = 'momentum', risk_tolerance = 'aggressive', asset_focus = 'broad'
WHERE name = 'Volatility Surfer' AND tier = 'system';

UPDATE agents SET time_horizon = 'position', reasoning_style = 'fundamental', risk_tolerance = 'conservative', asset_focus = 'broad'
WHERE name = 'Governance Watcher' AND tier = 'system';

UPDATE agents SET time_horizon = 'swing', reasoning_style = 'narrative', risk_tolerance = 'aggressive', asset_focus = 'broad'
WHERE name = 'Airdrop Hunter' AND tier = 'system';

UPDATE agents SET time_horizon = 'position', reasoning_style = 'fundamental', risk_tolerance = 'conservative', asset_focus = 'broad'
WHERE name = 'Security Auditor' AND tier = 'system';

UPDATE agents SET time_horizon = 'intraday', reasoning_style = 'momentum', risk_tolerance = 'aggressive', asset_focus = 'broad'
WHERE name = 'Momentum Rider' AND tier = 'system';

UPDATE agents SET time_horizon = 'swing', reasoning_style = 'fundamental', risk_tolerance = 'conservative', asset_focus = 'defi_tokens'
WHERE name = 'Staking Strategist' AND tier = 'system';

UPDATE agents SET time_horizon = 'long_term', reasoning_style = 'contrarian', risk_tolerance = 'conservative', asset_focus = 'broad'
WHERE name = 'Black Swan Sentinel' AND tier = 'system';

UPDATE agents SET time_horizon = 'scalp', reasoning_style = 'narrative', risk_tolerance = 'aggressive', asset_focus = 'broad'
WHERE name = 'Alpha Leaker' AND tier = 'system';

UPDATE agents SET time_horizon = 'intraday', reasoning_style = 'quantitative', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Funding Rate Arb' AND tier = 'system';

UPDATE agents SET time_horizon = 'swing', reasoning_style = 'fundamental', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Tokenomics Surgeon' AND tier = 'system';

UPDATE agents SET time_horizon = 'intraday', reasoning_style = 'narrative', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Social Signal Decoder' AND tier = 'system';

UPDATE agents SET time_horizon = 'intraday', reasoning_style = 'quantitative', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'MEV Watcher' AND tier = 'system';

UPDATE agents SET time_horizon = 'swing', reasoning_style = 'contrarian', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Narrative Trader' AND tier = 'system';

UPDATE agents SET time_horizon = 'swing', reasoning_style = 'quantitative', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Correlation Mapper' AND tier = 'system';

UPDATE agents SET time_horizon = 'long_term', reasoning_style = 'fundamental', risk_tolerance = 'moderate', asset_focus = 'broad'
WHERE name = 'Dev Activity Tracker' AND tier = 'system';

UPDATE agents SET time_horizon = 'intraday', reasoning_style = 'quantitative', risk_tolerance = 'conservative', asset_focus = 'broad'
WHERE name = 'Basis Trader' AND tier = 'system';

UPDATE agents SET time_horizon = 'scalp', reasoning_style = 'momentum', risk_tolerance = 'degen', asset_focus = 'broad'
WHERE name = 'Liquidation Hunter' AND tier = 'system';
