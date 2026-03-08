-- Security: Explicit deny policies for write operations on public-facing tables
-- and additional protection for wallet_encrypted_key column.

-- ============================================================
-- Explicit INSERT/UPDATE/DELETE denial for anon and authenticated roles
-- on tables that should only be written to via service_role (API routes).
-- ============================================================

-- agents: public can read, only service_role can write
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'agents_deny_insert_anon' AND tablename = 'agents'
  ) THEN
    CREATE POLICY "agents_deny_insert_anon" ON agents FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'agents_deny_update_anon' AND tablename = 'agents'
  ) THEN
    CREATE POLICY "agents_deny_update_anon" ON agents FOR UPDATE TO anon, authenticated USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'agents_deny_delete_anon' AND tablename = 'agents'
  ) THEN
    CREATE POLICY "agents_deny_delete_anon" ON agents FOR DELETE TO anon, authenticated USING (false);
  END IF;
END $$;

-- timeline_posts: public can read, only service_role can write
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'posts_deny_insert_anon' AND tablename = 'timeline_posts'
  ) THEN
    CREATE POLICY "posts_deny_insert_anon" ON timeline_posts FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'posts_deny_update_anon' AND tablename = 'timeline_posts'
  ) THEN
    CREATE POLICY "posts_deny_update_anon" ON timeline_posts FOR UPDATE TO anon, authenticated USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'posts_deny_delete_anon' AND tablename = 'timeline_posts'
  ) THEN
    CREATE POLICY "posts_deny_delete_anon" ON timeline_posts FOR DELETE TO anon, authenticated USING (false);
  END IF;
END $$;

-- virtual_portfolios: only service_role
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'portfolios_deny_insert_anon' AND tablename = 'virtual_portfolios'
  ) THEN
    CREATE POLICY "portfolios_deny_insert_anon" ON virtual_portfolios FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'portfolios_deny_update_anon' AND tablename = 'virtual_portfolios'
  ) THEN
    CREATE POLICY "portfolios_deny_update_anon" ON virtual_portfolios FOR UPDATE TO anon, authenticated USING (false);
  END IF;
END $$;

-- predictions: only service_role
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'predictions_deny_insert_anon' AND tablename = 'predictions'
  ) THEN
    CREATE POLICY "predictions_deny_insert_anon" ON predictions FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'predictions_deny_update_anon' AND tablename = 'predictions'
  ) THEN
    CREATE POLICY "predictions_deny_update_anon" ON predictions FOR UPDATE TO anon, authenticated USING (false);
  END IF;
END $$;

-- virtual_positions: only service_role
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'positions_deny_insert_anon' AND tablename = 'virtual_positions'
  ) THEN
    CREATE POLICY "positions_deny_insert_anon" ON virtual_positions FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'positions_deny_update_anon' AND tablename = 'virtual_positions'
  ) THEN
    CREATE POLICY "positions_deny_update_anon" ON virtual_positions FOR UPDATE TO anon, authenticated USING (false);
  END IF;
END $$;

-- virtual_trades: only service_role
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'trades_deny_insert_anon' AND tablename = 'virtual_trades'
  ) THEN
    CREATE POLICY "trades_deny_insert_anon" ON virtual_trades FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;
END $$;
