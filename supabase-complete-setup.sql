-- ========================================
-- RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR
-- Email: leewaysoftwares@gmail.com
-- It is SAFE to re-run this multiple times.
-- ========================================

-- STEP 1: Ensure the is_admin column exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- STEP 2: Ensure all tables exist (safe re-run)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'essential', 'pro')),
  paystack_customer_code TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  breed TEXT DEFAULT '',
  weight_kg NUMERIC,
  birth_date DATE,
  medical_flags TEXT DEFAULT '',
  sitter_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pet_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL CHECK (log_type IN ('meal', 'medication', 'bathroom', 'custom')),
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- STEP 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_pets_user_id ON public.pets(user_id);
CREATE INDEX IF NOT EXISTS idx_pets_sitter_token ON public.pets(sitter_token);
CREATE INDEX IF NOT EXISTS idx_pet_logs_pet_id ON public.pet_logs(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_logs_user_id ON public.pet_logs(user_id);

-- STEP 4: Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tier, is_admin)
  VALUES (NEW.id, NEW.email, 'free', false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STEP 5: Public view for QR scans
CREATE OR REPLACE VIEW public.vw_public_pet_profiles AS
SELECT id, name, breed, medical_flags FROM public.pets;

-- STEP 6: Backfill profiles for ALL existing users
INSERT INTO public.profiles (id, email, tier, is_admin)
SELECT u.id, u.email, 'free', false
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- STEP 7: SET YOUR ACCOUNT AS ADMIN
UPDATE public.profiles
SET is_admin = true, tier = 'pro'
WHERE email = 'leewaysoftwares@gmail.com';

-- STEP 8: Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_logs ENABLE ROW LEVEL SECURITY;

-- STEP 9: Drop old policies to avoid duplicates (safe)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can create own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can update own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can delete own pets" ON public.pets;
DROP POLICY IF EXISTS "Users can view own logs" ON public.pet_logs;
DROP POLICY IF EXISTS "Users can create own logs" ON public.pet_logs;
DROP POLICY IF EXISTS "Users can update own logs" ON public.pet_logs;
DROP POLICY IF EXISTS "Users can delete own logs" ON public.pet_logs;
DROP POLICY IF EXISTS "Anon sitter token lookup" ON public.pets;
DROP POLICY IF EXISTS "Sitter can read logs" ON public.pet_logs;
DROP POLICY IF EXISTS "Sitter can insert logs" ON public.pet_logs;

-- STEP 10: Recreate RLS policies (user-level)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view own pets"
  ON public.pets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pets"
  ON public.pets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pets"
  ON public.pets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pets"
  ON public.pets FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own logs"
  ON public.pet_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own logs"
  ON public.pet_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs"
  ON public.pet_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs"
  ON public.pet_logs FOR DELETE
  USING (auth.uid() = user_id);

-- STEP 11: Admin RLS policies (admin sees everything)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "Admins can insert all profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "Admins can view all pets"
  ON public.pets FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "Admins can update all pets"
  ON public.pets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "Admins can delete all pets"
  ON public.pets FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "Admins can view all logs"
  ON public.pet_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "Admins can update all logs"
  ON public.pet_logs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "Admins can delete all logs"
  ON public.pet_logs FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- STEP 12: Anon access for sitter tokens and public QR
CREATE POLICY "Anon sitter lookup"
  ON public.pets FOR SELECT
  TO anon, authenticated
  USING (sitter_token IS NOT NULL);

CREATE POLICY "Anon read logs"
  ON public.pet_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon insert logs"
  ON public.pet_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- STEP 13: Grant anon access to the public view
GRANT SELECT ON public.vw_public_pet_profiles TO anon;
GRANT SELECT ON public.vw_public_pet_profiles TO authenticated;
GRANT SELECT (id, name, breed, medical_flags) ON public.pets TO anon;

-- STEP 14: RPC Functions for admin dashboard
CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'total_pets', (SELECT count(*) FROM public.pets),
    'total_logs', (SELECT count(*) FROM public.pet_logs),
    'free_users', (SELECT count(*) FROM public.profiles WHERE tier = 'free'),
    'essential_users', (SELECT count(*) FROM public.profiles WHERE tier = 'essential'),
    'pro_users', (SELECT count(*) FROM public.profiles WHERE tier = 'pro'),
    'logs_today', (SELECT count(*) FROM public.pet_logs WHERE created_at >= CURRENT_DATE),
    'logs_7d', (SELECT count(*) FROM public.pet_logs WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'logs_30d', (SELECT count(*) FROM public.pet_logs WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'pets_with_sitter_token', (SELECT count(*) FROM public.pets WHERE sitter_token IS NOT NULL)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_users(search_term TEXT DEFAULT '', page_offset INT DEFAULT 0, page_limit INT DEFAULT 50)
RETURNS TABLE(id UUID, email TEXT, tier TEXT, is_admin BOOLEAN, paystack_customer_code TEXT, created_at TIMESTAMPTZ, pet_count BIGINT, log_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.tier, p.is_admin, p.paystack_customer_code, p.created_at,
    COALESCE((SELECT count(*) FROM public.pets WHERE user_id = p.id), 0),
    COALESCE((SELECT count(*) FROM public.pet_logs WHERE user_id = p.id), 0)
  FROM public.profiles p
  WHERE (search_term = '' OR p.email ILIKE '%' || search_term || '%')
  ORDER BY p.created_at DESC OFFSET page_offset LIMIT page_limit;
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_pets(search_term TEXT DEFAULT '', page_offset INT DEFAULT 0, page_limit INT DEFAULT 50)
RETURNS TABLE(id UUID, name TEXT, breed TEXT, weight_kg NUMERIC, birth_date DATE, medical_flags TEXT, sitter_token TEXT, created_at TIMESTAMPTZ, owner_id UUID, owner_email TEXT, log_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT pe.id, pe.name, pe.breed, pe.weight_kg, pe.birth_date, pe.medical_flags, pe.sitter_token, pe.created_at,
    pe.user_id, pr.email,
    COALESCE((SELECT count(*) FROM public.pet_logs WHERE pet_id = pe.id), 0)
  FROM public.pets pe JOIN public.profiles pr ON pr.id = pe.user_id
  WHERE (search_term = '' OR pe.name ILIKE '%' || search_term || '%' OR pr.email ILIKE '%' || search_term || '%')
  ORDER BY pe.created_at DESC OFFSET page_offset LIMIT page_limit;
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_logs(filter_type TEXT DEFAULT '', page_offset INT DEFAULT 0, page_limit INT DEFAULT 100)
RETURNS TABLE(id UUID, pet_id UUID, user_id UUID, log_type TEXT, title TEXT, notes TEXT, created_at TIMESTAMPTZ, pet_name TEXT, owner_email TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.pet_id, l.user_id, l.log_type, l.title, l.notes, l.created_at,
    pe.name, pr.email
  FROM public.pet_logs l
  JOIN public.pets pe ON pe.id = l.pet_id
  JOIN public.profiles pr ON pr.id = l.user_id
  WHERE (filter_type = '' OR l.log_type = filter_type)
  ORDER BY l.created_at DESC OFFSET page_offset LIMIT page_limit;
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_user_tier(target_user_id UUID, new_tier TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.profiles SET tier = new_tier WHERE id = target_user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM public.pet_logs WHERE user_id = target_user_id;
  DELETE FROM public.pets WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_user_pets(target_user_id UUID)
RETURNS TABLE(id UUID, name TEXT, breed TEXT, weight_kg NUMERIC, birth_date DATE, medical_flags TEXT, sitter_token TEXT, created_at TIMESTAMPTZ, log_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT pe.id, pe.name, pe.breed, pe.weight_kg, pe.birth_date, pe.medical_flags, pe.sitter_token, pe.created_at,
    COALESCE((SELECT count(*) FROM public.pet_logs WHERE pet_id = pe.id), 0)
  FROM public.pets pe WHERE pe.user_id = target_user_id ORDER BY pe.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_user_logs(target_user_id UUID, page_limit INT DEFAULT 50)
RETURNS TABLE(id UUID, pet_id UUID, log_type TEXT, title TEXT, notes TEXT, created_at TIMESTAMPTZ, pet_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.pet_id, l.log_type, l.title, l.notes, l.created_at, pe.name
  FROM public.pet_logs l JOIN public.pets pe ON pe.id = l.pet_id
  WHERE l.user_id = target_user_id ORDER BY l.created_at DESC LIMIT page_limit;
END;
$$;

-- STEP 15: VERIFY — this should show your account as admin
SELECT email, tier, is_admin FROM public.profiles WHERE email = 'leewaysoftwares@gmail.com';

-- If the above returns 0 rows, your auth user might not exist yet.
-- Sign up at /auth.html first, then re-run STEP 7.
