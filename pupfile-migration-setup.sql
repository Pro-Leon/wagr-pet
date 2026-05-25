-- ========================================
-- Pup File — Migration & Setup SQL
-- Run this in Supabase SQL Editor
-- ========================================

-- 1. Add display_name column to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. Add notification_preferences column to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;

-- 3. Create payment_history table (if not exists)
CREATE TABLE IF NOT EXISTS payment_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL,
    plan_type TEXT,
    reference TEXT,
    paid_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment history" ON payment_history;
CREATE POLICY "Users can view own payment history" ON payment_history
    FOR SELECT USING (auth.uid() = user_id);

-- 4. Admin SQL Console execution function (read-only)
CREATE OR REPLACE FUNCTION pg_query(query_text TEXT)
RETURNS SETOF JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF UPPER(TRIM(query_text)) NOT LIKE 'SELECT%' AND
       UPPER(TRIM(query_text)) NOT LIKE 'EXPLAIN%' AND
       UPPER(TRIM(query_text)) NOT LIKE 'WITH%' THEN
        RAISE EXCEPTION 'Only SELECT, EXPLAIN, and WITH queries are allowed';
    END IF;

    RETURN QUERY EXECUTE query_text;
END;
$$;

-- 5. Fix admin_get_stats to use correct tier names
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
    'legacy_pro_users', (SELECT count(*) FROM public.profiles WHERE tier = 'pro'),
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
