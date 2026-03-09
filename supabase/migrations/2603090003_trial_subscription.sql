-- Add is_trial flag to agent_subscriptions
ALTER TABLE agent_subscriptions ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;
