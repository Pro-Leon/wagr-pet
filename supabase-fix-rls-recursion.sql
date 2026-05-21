-- ========================================
-- FIX: Infinite Recursion in RLS Policies
-- Run this ENTIRE script in Supabase SQL Editor
--
-- The problem: Admin policies on "profiles" query "profiles"
-- inside the policy check, creating an infinite loop.
--
-- Solution: Use a SECURITY DEFINER function that checks
-- admin status without going through RLS.
-- ========================================

-- STEP 1: Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  );
$$;


-- STEP 2: Drop ALL existing policies on all tables to start clean
DO $$
DECLARE
  r RECORD;
BEGIN
  -- profiles
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
  -- pets
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'pets' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pets', r.policyname);
  END LOOP;
  -- pet_logs
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'pet_logs' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pet_logs', r.policyname);
  END LOOP;
END;
$$;


-- STEP 3: Recreate policies — NO self-referencing subqueries

-- === PROFILES ===

-- Users can see their own row
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins see all profiles (uses the helper function, no recursion)
CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT
  USING (is_admin());

-- Users can insert their own profile
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can insert any profile
CREATE POLICY "Admins insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (is_admin());

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins update profiles"
  ON public.profiles FOR UPDATE
  USING (is_admin());

-- Users can delete their own profile
CREATE POLICY "Users delete own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- Admins can delete any profile
CREATE POLICY "Admins delete profiles"
  ON public.profiles FOR DELETE
  USING (is_admin());


-- === PETS ===

-- Users see their own pets
CREATE POLICY "Users read own pets"
  ON public.pets FOR SELECT
  USING (auth.uid() = user_id);

-- Admins see all pets
CREATE POLICY "Admins read pets"
  ON public.pets FOR SELECT
  USING (is_admin());

-- Anon can find pets by sitter token
CREATE POLICY "Anon sitter lookup"
  ON public.pets FOR SELECT
  TO anon, authenticated
  USING (sitter_token IS NOT NULL);

-- Users create own pets
CREATE POLICY "Users create pets"
  ON public.pets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins create any pet
CREATE POLICY "Admins create pets"
  ON public.pets FOR INSERT
  WITH CHECK (is_admin());

-- Users update own pets
CREATE POLICY "Users update own pets"
  ON public.pets FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins update any pet
CREATE POLICY "Admins update pets"
  ON public.pets FOR UPDATE
  USING (is_admin());

-- Users delete own pets
CREATE POLICY "Users delete own pets"
  ON public.pets FOR DELETE
  USING (auth.uid() = user_id);

-- Admins delete any pet
CREATE POLICY "Admins delete pets"
  ON public.pets FOR DELETE
  USING (is_admin());


-- === PET_LOGS ===

-- Users see their own logs
CREATE POLICY "Users read own logs"
  ON public.pet_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Admins see all logs
CREATE POLICY "Admins read logs"
  ON public.pet_logs FOR SELECT
  USING (is_admin());

-- Anon can read logs (for sitter view)
CREATE POLICY "Anon read logs"
  ON public.pet_logs FOR SELECT
  TO anon, authenticated
  USING (true);

-- Users create own logs
CREATE POLICY "Users create logs"
  ON public.pet_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Anon can insert logs (for sitter)
CREATE POLICY "Anon insert logs"
  ON public.pet_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admins create any log
CREATE POLICY "Admins create logs"
  ON public.pet_logs FOR INSERT
  WITH CHECK (is_admin());

-- Users update own logs
CREATE POLICY "Users update own logs"
  ON public.pet_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins update any log
CREATE POLICY "Admins update logs"
  ON public.pet_logs FOR UPDATE
  USING (is_admin());

-- Users delete own logs
CREATE POLICY "Users delete own logs"
  ON public.pet_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Admins delete any log
CREATE POLICY "Admins delete logs"
  ON public.pet_logs FOR DELETE
  USING (is_admin());


-- STEP 4: Verify policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- STEP 5: Verify your account
SELECT email, tier, is_admin FROM public.profiles 
WHERE email = 'leewaysoftwares@gmail.com';
