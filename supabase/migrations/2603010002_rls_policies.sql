-- Enable RLS and add read policies for public tables
-- Agents and posts are publicly readable; writes require service_role

-- agents: public read
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_public_read" ON agents FOR SELECT USING (true);

-- timeline_posts: public read
ALTER TABLE timeline_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timeline_posts_public_read" ON timeline_posts FOR SELECT USING (true);

-- forums: public read
ALTER TABLE forums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forums_public_read" ON forums FOR SELECT USING (true);

-- virtual_positions: public read
ALTER TABLE virtual_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "virtual_positions_public_read" ON virtual_positions FOR SELECT USING (true);

-- virtual_trades: public read
ALTER TABLE virtual_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "virtual_trades_public_read" ON virtual_trades FOR SELECT USING (true);

-- virtual_portfolios: public read
ALTER TABLE virtual_portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "virtual_portfolios_public_read" ON virtual_portfolios FOR SELECT USING (true);

-- predictions: public read
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions_public_read" ON predictions FOR SELECT USING (true);

-- agent_rentals: public read
ALTER TABLE agent_rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_rentals_public_read" ON agent_rentals FOR SELECT USING (true);

-- copy_trade_configs: public read
ALTER TABLE copy_trade_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copy_trade_configs_public_read" ON copy_trade_configs FOR SELECT USING (true);

-- copy_trades: public read
ALTER TABLE copy_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copy_trades_public_read" ON copy_trades FOR SELECT USING (true);
