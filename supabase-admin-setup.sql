-- ========================================
-- Pup File — Admin Setup
-- Run this in Supabase SQL Editor AFTER the main schema
-- ========================================

-- 1. Add is_admin flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Set YOUR email as admin (change to your actual email)
UPDATE public.profiles
SET is_admin = true
WHERE email = 'YOUR_EMAIL@example.com';

-- If you haven't been added to profiles yet, run this too:
-- (Replace with your actual email and get your user ID from Auth > Users)
-- INSERT INTO public.profiles (id, email, tier, is_admin)
-- VALUES ('YOUR_USER_UUID', 'YOUR_EMAIL@example.com', 'pro', true)
-- ON CONFLICT (id) DO UPDATE SET is_admin = true;


-- ========================================
-- 3. Admin RLS Policies (bypass ownership checks)
-- ========================================

-- Profiles: admins can see/edit all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Pets: admins can see/edit/delete all pets
CREATE POLICY "Admins can view all pets"
  ON public.pets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update all pets"
  ON public.pets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete all pets"
  ON public.pets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Pet_logs: admins can see/edit/delete all logs
CREATE POLICY "Admins can view all logs"
  ON public.pet_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update all logs"
  ON public.pet_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete all logs"
  ON public.pet_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );


-- ========================================
-- 4. RPC functions for admin dashboard
-- ========================================

-- Get dashboard stats
CREATE OR REPLACE FUNCTION admin_get_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'total_pets', (SELECT count(*) FROM public.pets),
    'total_logs', (SELECT count(*) FROM public.pet_logs),
    'starter_users', (SELECT count(*) FROM public.profiles WHERE tier = 'starter'),
    'basic_users', (SELECT count(*) FROM public.profiles WHERE tier = 'basic'),
    'family_users', (SELECT count(*) FROM public.profiles WHERE tier = 'family'),
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

-- Admin: get all users with pet counts
CREATE OR REPLACE FUNCTION admin_list_users(
  search_term TEXT DEFAULT '',
  page_offset INT DEFAULT 0,
  page_limit INT DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  email TEXT,
  tier TEXT,
  is_admin BOOLEAN,
  paystack_customer_code TEXT,
  created_at TIMESTAMPTZ,
  pet_count BIGINT,
  log_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.tier,
    p.is_admin,
    p.paystack_customer_code,
    p.created_at,
    COALESCE((SELECT count(*) FROM public.pets WHERE user_id = p.id), 0) as pet_count,
    COALESCE((SELECT count(*) FROM public.pet_logs WHERE user_id = p.id), 0) as log_count
  FROM public.profiles p
  WHERE
    (search_term = '' OR p.email ILIKE '%' || search_term || '%')
  ORDER BY p.created_at DESC
  OFFSET page_offset
  LIMIT page_limit;
END;
$$;

-- Admin: get all pets with owner info
CREATE OR REPLACE FUNCTION admin_list_pets(
  search_term TEXT DEFAULT '',
  page_offset INT DEFAULT 0,
  page_limit INT DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  breed TEXT,
  weight_kg NUMERIC,
  birth_date DATE,
  medical_flags TEXT,
  sitter_token TEXT,
  created_at TIMESTAMPTZ,
  owner_id UUID,
  owner_email TEXT,
  log_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.id,
    pe.name,
    pe.breed,
    pe.weight_kg,
    pe.birth_date,
    pe.medical_flags,
    pe.sitter_token,
    pe.created_at,
    pe.user_id as owner_id,
    pr.email as owner_email,
    COALESCE((SELECT count(*) FROM public.pet_logs WHERE pet_id = pe.id), 0) as log_count
  FROM public.pets pe
  JOIN public.profiles pr ON pr.id = pe.user_id
  WHERE
    (search_term = '' OR pe.name ILIKE '%' || search_term || '%' OR pr.email ILIKE '%' || search_term || '%')
  ORDER BY pe.created_at DESC
  OFFSET page_offset
  LIMIT page_limit;
END;
$$;

-- Admin: get all logs with details
CREATE OR REPLACE FUNCTION admin_list_logs(
  filter_type TEXT DEFAULT '',
  page_offset INT DEFAULT 0,
  page_limit INT DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  pet_id UUID,
  user_id UUID,
  log_type TEXT,
  title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  pet_name TEXT,
  owner_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.pet_id,
    l.user_id,
    l.log_type,
    l.title,
    l.notes,
    l.created_at,
    pe.name as pet_name,
    pr.email as owner_email
  FROM public.pet_logs l
  JOIN public.pets pe ON pe.id = l.pet_id
  JOIN public.profiles pr ON pr.id = l.user_id
  WHERE
    (filter_type = '' OR l.log_type = filter_type)
  ORDER BY l.created_at DESC
  OFFSET page_offset
  LIMIT page_limit;
END;
$$;

-- Admin: update user tier
CREATE OR REPLACE FUNCTION admin_set_user_tier(
  target_user_id UUID,
  new_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.profiles
  SET tier = new_tier
  WHERE id = target_user_id;

  RETURN FOUND;
END;
$$;

-- Admin: delete user and all their data
CREATE OR REPLACE FUNCTION admin_delete_user(
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  DELETE FROM public.pet_logs WHERE user_id = target_user_id;
  DELETE FROM public.pets WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;

  RETURN FOUND;
END;
$$;

-- Admin: get logs for a specific user
CREATE OR REPLACE FUNCTION admin_get_user_logs(
  target_user_id UUID,
  page_limit INT DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  pet_id UUID,
  log_type TEXT,
  title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  pet_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.pet_id,
    l.log_type,
    l.title,
    l.notes,
    l.created_at,
    pe.name as pet_name
  FROM public.pet_logs l
  JOIN public.pets pe ON pe.id = l.pet_id
  WHERE l.user_id = target_user_id
  ORDER BY l.created_at DESC
  LIMIT page_limit;
END;
$$;

-- Admin: get pets for a specific user
CREATE OR REPLACE FUNCTION admin_get_user_pets(
  target_user_id UUID
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  breed TEXT,
  weight_kg NUMERIC,
  birth_date DATE,
  medical_flags TEXT,
  sitter_token TEXT,
  created_at TIMESTAMPTZ,
  log_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.id,
    pe.name,
    pe.breed,
    pe.weight_kg,
    pe.birth_date,
    pe.medical_flags,
    pe.sitter_token,
    pe.created_at,
    COALESCE((SELECT count(*) FROM public.pet_logs WHERE pet_id = pe.id), 0) as log_count
  FROM public.pets pe
  WHERE pe.user_id = target_user_id
  ORDER BY pe.created_at ASC;
END;
$$;


-- ========================================
-- DONE! Now access /admin.html
-- ========================================
