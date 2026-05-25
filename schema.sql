-- ========================================
-- Pup File Database Schema
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USERS (handled by Supabase Auth)
-- ========================================
-- Supabase handles auth.users table automatically

-- ========================================
-- PROFILES
-- ========================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    tier TEXT DEFAULT 'starter' CHECK (tier IN ('starter', 'basic', 'family')),
    is_admin BOOLEAN DEFAULT false,
    subscription_code TEXT,
    subscription_status TEXT DEFAULT 'none',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile (but NOT tier — that's set via webhook only)
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND (
            (SELECT p.tier FROM profiles p WHERE p.id = auth.uid()) = profiles.tier
            OR (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()) = true
        )
    );

-- Policy: Enable insert for authenticated users
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ========================================
-- PETS
-- ========================================
CREATE TABLE IF NOT EXISTS pets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed TEXT,
    weight_kg NUMERIC(5,2),
    birth_date DATE,
    medical_flags TEXT,
    sitter_token TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can CRUD their own pets
CREATE POLICY "Users can manage own pets" ON pets
    FOR ALL USING (auth.uid() = user_id);

-- Policy: Sitters can view pets via token (read-only)
CREATE POLICY "Sitters can view pet via token" ON pets
    FOR SELECT USING (sitter_token IS NOT NULL);

-- ========================================
-- PET LOGS (Notes - Free tier)
-- ========================================
CREATE TABLE IF NOT EXISTS pet_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL CHECK (log_type IN ('custom', 'meal', 'medication', 'bathroom')),
    title TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pet_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage logs for their own pets
CREATE POLICY "Users can manage own pet logs" ON pet_logs
    FOR ALL USING (
        user_id = auth.uid() OR
        pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())
    );

-- Index for faster timeline queries
CREATE INDEX idx_pet_logs_pet_id_created ON pet_logs(pet_id, created_at DESC);

-- ========================================
-- FOOD LOGS (NEW)
-- ========================================
CREATE TABLE IF NOT EXISTS food_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    food_type TEXT NOT NULL CHECK (food_type IN ('commercial', 'homemade', 'raw', 'treat', 'supplement')),
    brand_name TEXT,
    product_name TEXT,
    portion_size NUMERIC(6,2) NOT NULL,
    portion_unit TEXT NOT NULL CHECK (portion_unit IN ('cups', 'oz', 'g', 'tbsp', 'pieces')),
    ingredients TEXT,
    notes TEXT,
    fed_at TIMESTAMPTZ DEFAULT NOW(),
    -- Nutritional analysis fields (filled when user upgrades to Essential/Pro)
    calories_per_cup INTEGER,
    protein_percentage INTEGER,
    fat_percentage INTEGER,
    fiber_percentage INTEGER,
    carbs_percentage INTEGER,
    moisture_percentage INTEGER,
    nutritional_analyzed BOOLEAN DEFAULT false,
    analysis_source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage food logs for their own pets
CREATE POLICY "Users can manage own food logs" ON food_logs
    FOR ALL USING (
        user_id = auth.uid() OR
        pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())
    );

-- Index for faster food log queries
CREATE INDEX idx_food_logs_pet_id_fed_at ON food_logs(pet_id, fed_at DESC);

-- ========================================
-- PUBLIC PET PROFILES (for QR codes)
-- ========================================
CREATE TABLE IF NOT EXISTS public_pet_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    breed TEXT,
    medical_flags TEXT,
    owner_name TEXT,
    owner_contact TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public_pet_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Publicly readable
CREATE POLICY "Public pet profiles are viewable by everyone" ON public_pet_profiles
    FOR SELECT USING (true);

-- Policy: Only owners can manage
CREATE POLICY "Owners can manage own public profiles" ON public_pet_profiles
    FOR ALL USING (
        pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())
    );

-- ========================================
-- VIEWS
-- ========================================

-- View for public pet profile access via QR code
CREATE OR REPLACE VIEW vw_public_pet_profiles AS
SELECT
    p.id,
    p.name,
    p.breed,
    p.medical_flags,
    'Contact owner via PupFile'::text AS owner_contact
FROM pets p;

-- ========================================
-- FUNCTIONS
-- ========================================

-- Function to get public pet profile (bypasses RLS, works for anonymous QR scanners)
CREATE OR REPLACE FUNCTION get_public_pet_profile(pet_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    breed TEXT,
    medical_flags TEXT,
    owner_contact TEXT
)
LANGUAGE SQL SECURITY DEFINER
STABLE
AS $$
    SELECT p.id, p.name, p.breed, p.medical_flags, 'Contact owner via PupFile'::text
    FROM pets p
    WHERE p.id = pet_id;
$$;

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update timestamps
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pets_updated_at
    BEFORE UPDATE ON pets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pet_logs_updated_at
    BEFORE UPDATE ON pet_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_food_logs_updated_at
    BEFORE UPDATE ON food_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- SEED DATA (Optional - for testing)
-- ========================================

-- Insert a test user (replace with your actual user ID after registration)
-- INSERT INTO profiles (id, email, tier)
-- VALUES ('your-user-uuid-here', 'test@example.com', 'free');

-- Insert a test pet
-- INSERT INTO pets (id, user_id, name, breed, weight_kg)
-- VALUES ('uuid-here', 'your-user-uuid-here', 'Buddy', 'Golden Retriever', 25.5);

-- Insert sample food logs
-- INSERT INTO food_logs (pet_id, user_id, food_type, brand_name, product_name, portion_size, portion_unit)
-- VALUES
--     ('pet-uuid', 'user-uuid', 'commercial', 'Royal Canin', 'Adult Chicken', 1.5, 'cups'),
--     ('pet-uuid', 'user-uuid', 'homemade', '', 'Chicken & Rice', 2, 'cups');


-- ========================================
-- MIGRATION: Add to existing database
-- (Run this section if you already have tables created)
-- ========================================

-- 1. Add food_logs table to existing database
-- CREATE TABLE IF NOT EXISTS food_logs (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
--     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--     food_type TEXT NOT NULL CHECK (food_type IN ('commercial', 'homemade', 'raw', 'treat', 'supplement')),
--     brand_name TEXT,
--     product_name TEXT,
--     portion_size NUMERIC(6,2) NOT NULL,
--     portion_unit TEXT NOT NULL CHECK (portion_unit IN ('cups', 'oz', 'g', 'tbsp', 'pieces')),
--     ingredients TEXT,
--     notes TEXT,
--     fed_at TIMESTAMPTZ DEFAULT NOW(),
--     calories_per_cup INTEGER,
--     protein_percentage INTEGER,
--     fat_percentage INTEGER,
--     fiber_percentage INTEGER,
--     carbs_percentage INTEGER,
--     moisture_percentage INTEGER,
--     nutritional_analyzed BOOLEAN DEFAULT false,
--     analysis_source TEXT,
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- 2. Enable RLS on food_logs
-- ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policy for food_logs
-- CREATE POLICY "Users can manage own food logs" ON food_logs
--     FOR ALL USING (
--         user_id = auth.uid() OR
--         pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())
--     );

-- 4. Create index for faster queries
-- CREATE INDEX IF NOT EXISTS idx_food_logs_pet_id_fed_at ON food_logs(pet_id, fed_at DESC);

-- 5. Add timestamp trigger (if not exists)
-- CREATE TRIGGER IF NOT EXISTS update_food_logs_updated_at
--     BEFORE UPDATE ON food_logs
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- CO-PARENTS
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

-- Policy: Pet owner and co-parent can view the relationship
-- Uses invited_by for owner check to avoid circular RLS with pets table
CREATE POLICY "Co-parents viewable by owner and co-parent" ON co_parents
    FOR SELECT USING (
        user_id = auth.uid() OR
        invited_by = auth.uid()
    );

-- Policy: Only pet owner can add co-parents (invited_by is set to auth.uid() by server)
CREATE POLICY "Owner can add co-parents" ON co_parents
    FOR INSERT WITH CHECK (
        invited_by = auth.uid()
    );

-- Policy: Only pet owner can remove co-parents
CREATE POLICY "Owner can delete co-parents" ON co_parents
    FOR DELETE USING (
        invited_by = auth.uid()
    );

-- ========================================
-- CO-PARENT INVITES
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

-- Policy: Pet owner can view invites for their pets
CREATE POLICY "Owner can view invites" ON co_parent_invites
    FOR SELECT USING (
        invited_by = auth.uid()
    );

-- Policy: Pet owner can create invites
CREATE POLICY "Owner can create invites" ON co_parent_invites
    FOR INSERT WITH CHECK (
        invited_by = auth.uid()
    );

-- Policy: Pet owner can delete invites
CREATE POLICY "Owner can delete invites" ON co_parent_invites
    FOR DELETE USING (
        invited_by = auth.uid()
    );

-- SECURITY DEFINER function to accept an invite (used by the serverless API)
CREATE OR REPLACE FUNCTION accept_co_parent_invite(invite_token TEXT, accepting_user_id UUID)
RETURNS TABLE (pet_id UUID, pet_name TEXT, owner_email TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    inv RECORD;
BEGIN
    -- Find and validate the invite
    SELECT * INTO inv FROM co_parent_invites
    WHERE token = invite_token AND used = false AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found, already used, or expired';
    END IF;

    -- Mark as used
    UPDATE co_parent_invites SET used = true WHERE id = inv.id;

    -- Insert the co-parent relationship (skip if already exists)
    INSERT INTO co_parents (pet_id, user_id, invited_by)
    VALUES (inv.pet_id, accepting_user_id, inv.invited_by)
    ON CONFLICT (pet_id, user_id) DO NOTHING;

    -- Return pet info
    RETURN QUERY
    SELECT p.id, p.name::TEXT, u.email::TEXT
    FROM pets p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.id = inv.pet_id;
END;
$$;

-- Function to count co-parents for a pet
CREATE OR REPLACE FUNCTION count_co_parents(pet_id UUID)
RETURNS INTEGER
LANGUAGE SQL SECURITY DEFINER
STABLE
AS $$
    SELECT COUNT(*)::INTEGER FROM co_parents WHERE co_parents.pet_id = $1;
$$;

-- Pet owners can view profiles of their co-parents
CREATE POLICY "Pet owners can view co-parent profiles" ON profiles
    FOR SELECT USING (
        id IN (SELECT user_id FROM co_parents WHERE invited_by = auth.uid()) OR
        auth.uid() = id
    );

-- Co-parents can view shared pets
CREATE POLICY "Co-parents can view shared pets" ON pets
    FOR SELECT USING (
        id IN (SELECT pet_id FROM co_parents WHERE user_id = auth.uid())
    );

-- Co-parents can view and manage logs for shared pets
CREATE POLICY "Co-parents can manage logs for shared pets" ON pet_logs
    FOR ALL USING (
        pet_id IN (SELECT pet_id FROM co_parents WHERE user_id = auth.uid())
    );

-- Co-parents can view and manage food logs for shared pets
CREATE POLICY "Co-parents can manage food logs for shared pets" ON food_logs
    FOR ALL USING (
        pet_id IN (SELECT pet_id FROM co_parents WHERE user_id = auth.uid())
    );

-- ========================================
-- ANALYTICS EVENTS
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