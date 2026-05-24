-- ========================================
-- Pup File — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ========================================

-- 1. PROFILES TABLE (extends auth.users)
-- ========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'essential', 'pro')),
  paystack_customer_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tier)
  VALUES (
    NEW.id,
    NEW.email,
    'free'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. PETS TABLE
-- ========================================
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

CREATE INDEX IF NOT EXISTS idx_pets_user_id ON public.pets(user_id);
CREATE INDEX IF NOT EXISTS idx_pets_sitter_token ON public.pets(sitter_token);


-- 3. PET_LOGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.pet_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL CHECK (log_type IN ('meal', 'medication', 'bathroom', 'custom')),
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_logs_pet_id ON public.pet_logs(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_logs_user_id ON public.pet_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pet_logs_created_at ON public.pet_logs(created_at DESC);


-- 4. PUBLIC VIEW (for QR scan page — no auth required)
-- ========================================
CREATE OR REPLACE VIEW public.vw_public_pet_profiles AS
SELECT
  id,
  name,
  breed,
  medical_flags
FROM public.pets;


-- ========================================
-- 5. ROW-LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES: users can read/insert/update own row
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- PETS: full CRUD for owner
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

-- PET_LOGS: full CRUD for owner
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


-- ========================================
-- 6. PUBLIC VIEW ACCESS (anonymous)
-- ========================================

-- Allow unauthenticated reads on the public pet profile view
-- This is needed so the QR scan page works without login

-- First, ensure the anon key role can read the view
-- Supabase creates a role called "anon" for unauthenticated access
GRANT SELECT ON public.vw_public_pet_profiles TO anon;
GRANT SELECT ON public.vw_public_pet_profiles TO authenticated;

-- Also grant anon select on pets table directly as fallback for the view
-- (The view should handle this, but some Supabase setups need this)
GRANT SELECT (id, name, breed, medical_flags) ON public.pets TO anon;


-- ========================================
-- 7. SITTER TOKEN ACCESS
-- ========================================

-- Allow anon to read pet info by sitter_token (for sitter magic links)
-- This lets sitters look up the pet without being logged in
CREATE POLICY "Sitter can find pet by token"
  ON public.pets FOR SELECT
  USING (sitter_token IS NOT NULL AND sitter_token = current_setting('request.jwt.claims', true)::json->>'sitter_token');

-- Allow anon to read pet by sitter token (alternative approach)
-- We also grant limited anon access to pets for sitter lookups
CREATE POLICY "Anon sitter token lookup"
  ON public.pets FOR SELECT
  TO anon
  USING (sitter_token IS NOT NULL);

-- Allow anon to insert logs for sitter pets
CREATE POLICY "Sitter can insert logs"
  ON public.pet_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to read logs for sitter pets
CREATE POLICY "Sitter can read logs"
  ON public.pet_logs FOR SELECT
  TO anon
  USING (true);


-- ========================================
-- 8. BACKFILL: Create profiles for users
--     who signed up BEFORE this schema was run
-- ========================================
INSERT INTO public.profiles (id, email, tier)
SELECT
  u.id,
  u.email,
  'free'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- Also add sitter_token column if it was missed
-- (safe to re-run)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'pets'
    AND column_name = 'sitter_token'
  ) THEN
    ALTER TABLE public.pets ADD COLUMN sitter_token TEXT;
  END IF;
END $$;


-- ========================================
-- DONE! Verify with:
-- SELECT * FROM public.profiles;
-- SELECT * FROM public.pets;
-- ========================================
