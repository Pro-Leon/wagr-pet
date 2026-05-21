-- ========================================
-- RUN THIS TO FIX SIGNUP
-- This disables email confirmation so new
-- accounts work immediately without checking email.
--
-- Go to Supabase Dashboard → SQL Editor → Run this
-- ========================================

-- Option A: Update auth config via SQL
-- (This is the most reliable way)

UPDATE auth.config
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{enable_signup}',
  'true'
)
WHERE id = 'auth';

-- Note: The proper way to disable email confirmation is through the Dashboard:
-- Authentication → Providers → Email → Edit → Turn OFF "Confirm email"
--
-- If you can't find it in the Dashboard UI, here's the path:
-- 1. Go to your Supabase project
-- 2. Click "Authentication" in the left sidebar
-- 3. Click "Providers" tab at the top
-- 4. Click "Email" in the list
-- 5. Click the pencil/edit icon
-- 6. Toggle OFF "Confirm email"
-- 7. Click "Save"


-- ========================================
-- ALSO: Verify your admin account is set up
-- ========================================
-- Check your profile
SELECT id, email, tier, is_admin, created_at FROM public.profiles
WHERE email = 'leewaysoftwares@gmail.com';

-- If that returns 0 rows, your profile is missing.
-- Find your user ID first:
SELECT id, email, created_at FROM auth.users
WHERE email = 'leewaysoftwares@gmail.com';

-- Then create the profile (replace THE_USER_ID with the id from above):
-- INSERT INTO public.profiles (id, email, tier, is_admin)
-- VALUES ('THE_USER_ID', 'leewaysoftwares@gmail.com', 'pro', true)
-- ON CONFLICT (id) DO UPDATE SET is_admin = true, tier = 'pro';
