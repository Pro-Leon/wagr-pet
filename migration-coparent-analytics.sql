-- ========================================
-- Pup File Migration: Co-parents + Analytics
-- Safe to run on an existing database.
-- Uses IF NOT EXISTS / OR REPLACE / DO blocks
-- to avoid errors on re-run.
-- ========================================

-- ========================================
-- CO-PARENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS co_parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pet_id, user_id)
);

ALTER TABLE co_parents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'co_parents' AND policyname = 'Co-parents viewable by owner and co-parent') THEN
    CREATE POLICY "Co-parents viewable by owner and co-parent" ON co_parents
      FOR SELECT USING (
        user_id = auth.uid() OR
        invited_by = auth.uid()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'co_parents' AND policyname = 'Owner can add co-parents') THEN
    CREATE POLICY "Owner can add co-parents" ON co_parents
      FOR INSERT WITH CHECK (
        invited_by = auth.uid()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'co_parents' AND policyname = 'Owner can delete co-parents') THEN
    CREATE POLICY "Owner can delete co-parents" ON co_parents
      FOR DELETE USING (
        invited_by = auth.uid()
      );
  END IF;
END $$;

-- ========================================
-- CO-PARENT INVITES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS co_parent_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE co_parent_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'co_parent_invites' AND policyname = 'Owner can view invites') THEN
    CREATE POLICY "Owner can view invites" ON co_parent_invites
      FOR SELECT USING (
        invited_by = auth.uid()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'co_parent_invites' AND policyname = 'Owner can create invites') THEN
    CREATE POLICY "Owner can create invites" ON co_parent_invites
      FOR INSERT WITH CHECK (
        invited_by = auth.uid()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'co_parent_invites' AND policyname = 'Owner can delete invites') THEN
    CREATE POLICY "Owner can delete invites" ON co_parent_invites
      FOR DELETE USING (
        invited_by = auth.uid()
      );
  END IF;
END $$;

-- ========================================
-- CO-PARENT FUNCTIONS
-- ========================================
CREATE OR REPLACE FUNCTION accept_co_parent_invite(invite_token TEXT, accepting_user_id UUID)
RETURNS TABLE (pet_id UUID, pet_name TEXT, owner_email TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    inv RECORD;
BEGIN
    SELECT * INTO inv FROM co_parent_invites
    WHERE token = invite_token AND used = false AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found, already used, or expired';
    END IF;

    UPDATE co_parent_invites SET used = true WHERE id = inv.id;

    INSERT INTO co_parents (pet_id, user_id, invited_by)
    VALUES (inv.pet_id, accepting_user_id, inv.invited_by)
    ON CONFLICT (pet_id, user_id) DO NOTHING;

    RETURN QUERY
    SELECT p.id, p.name::TEXT, u.email::TEXT
    FROM pets p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.id = inv.pet_id;
END;
$$;

CREATE OR REPLACE FUNCTION count_co_parents(pet_id UUID)
RETURNS INTEGER
LANGUAGE SQL SECURITY DEFINER
STABLE
AS $$
    SELECT COUNT(*)::INTEGER FROM co_parents WHERE co_parents.pet_id = $1;
$$;

-- ========================================
-- PET OWNER CAN VIEW CO-PARENT PROFILES
-- ========================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Pet owners can view co-parent profiles') THEN
    CREATE POLICY "Pet owners can view co-parent profiles" ON profiles
      FOR SELECT USING (
        id IN (SELECT user_id FROM co_parents WHERE invited_by = auth.uid()) OR
        auth.uid() = id
      );
  END IF;
END $$;

-- ========================================
-- CO-PARENT RLS ON EXISTING TABLES
-- ========================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pets' AND policyname = 'Co-parents can view shared pets') THEN
    CREATE POLICY "Co-parents can view shared pets" ON pets
      FOR SELECT USING (
        id IN (SELECT pet_id FROM co_parents WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pet_logs' AND policyname = 'Co-parents can manage logs for shared pets') THEN
    CREATE POLICY "Co-parents can manage logs for shared pets" ON pet_logs
      FOR ALL USING (
        pet_id IN (SELECT pet_id FROM co_parents WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'food_logs' AND policyname = 'Co-parents can manage food logs for shared pets') THEN
    CREATE POLICY "Co-parents can manage food logs for shared pets" ON food_logs
      FOR ALL USING (
        pet_id IN (SELECT pet_id FROM co_parents WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ========================================
-- ANALYTICS EVENTS (if not already present)
-- ========================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    page TEXT,
    user_id UUID,
    session_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);

-- ========================================
-- UPDATE UPDATED_AT TRIGGERS (if missing)
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pets_updated_at') THEN
    CREATE TRIGGER update_pets_updated_at
      BEFORE UPDATE ON pets
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pet_logs_updated_at') THEN
    CREATE TRIGGER update_pet_logs_updated_at
      BEFORE UPDATE ON pet_logs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_food_logs_updated_at') THEN
    CREATE TRIGGER update_food_logs_updated_at
      BEFORE UPDATE ON food_logs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
