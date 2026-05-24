-- ========================================
-- Pup File — Expanded Feature Schema
-- Run this ENTIRE script in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS)
--
-- Tier Mapping: free → essential → pro (displayed as "Guardian")
-- ========================================

-- =============================================
-- 1. VACCINATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  date_given DATE NOT NULL,
  next_due_date DATE,
  vet_name TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vaccinations_pet ON public.vaccinations(pet_id);

-- =============================================
-- 2. WEIGHT LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight_kg NUMERIC NOT NULL,
  notes TEXT DEFAULT '',
  logged_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weight_pet ON public.weight_logs(pet_id);

-- =============================================
-- 3. VET CONTACTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.vet_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clinic_name TEXT NOT NULL,
  vet_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 4. FEEDING SCHEDULES
-- =============================================
CREATE TABLE IF NOT EXISTS public.feeding_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_name TEXT NOT NULL,
  meal_time TIME NOT NULL,
  portion TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 5. FOOD INVENTORY
-- =============================================
CREATE TABLE IF NOT EXISTS public.food_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT 'food',
  quantity NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  purchase_date DATE,
  estimated_empty_date DATE,
  restock_threshold NUMERIC DEFAULT 1,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 6. HEAT CYCLES
-- =============================================
CREATE TABLE IF NOT EXISTS public.heat_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle_start DATE NOT NULL,
  cycle_end DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_heat_pet ON public.heat_cycles(pet_id);

-- =============================================
-- 7. VET RECORDS (file URLs)
-- =============================================
CREATE TABLE IF NOT EXISTS public.vet_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  record_type TEXT DEFAULT 'other',
  notes TEXT DEFAULT '',
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 8. REMINDERS
-- =============================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  title TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  recurring TEXT DEFAULT '',
  sent BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_sent ON public.reminders(sent);

-- =============================================
-- 9. ENABLE RLS ON ALL NEW TABLES
-- =============================================
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeding_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heat_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 10. RLS POLICIES — Uses is_admin() helper
--      (from supabase-fix-rls-recursion.sql)
-- =============================================

-- Helper function (create if not exists)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true);
$$;

-- VACCINATIONS
CREATE POLICY "Users CRUD own vaccinations" ON public.vaccinations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin vaccinations" ON public.vaccinations FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- WEIGHT LOGS
CREATE POLICY "Users CRUD own weight" ON public.weight_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin weight" ON public.weight_logs FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- VET CONTACTS
CREATE POLICY "Users CRUD own vet_contacts" ON public.vet_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin vet_contacts" ON public.vet_contacts FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- FEEDING SCHEDULES
CREATE POLICY "Users CRUD own schedules" ON public.feeding_schedules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin schedules" ON public.feeding_schedules FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- FOOD INVENTORY
CREATE POLICY "Users CRUD own inventory" ON public.food_inventory FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin inventory" ON public.food_inventory FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- HEAT CYCLES
CREATE POLICY "Users CRUD own heat_cycles" ON public.heat_cycles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin heat_cycles" ON public.heat_cycles FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- VET RECORDS
CREATE POLICY "Users CRUD own vet_records" ON public.vet_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin vet_records" ON public.vet_records FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- REMINDERS
CREATE POLICY "Users CRUD own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reminders" ON public.reminders FOR ALL USING (is_admin()) WITH CHECK (is_admin());


-- =============================================
-- 11. VERIFY
-- =============================================
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
