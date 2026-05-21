-- ========================================
-- Migration: Add Food Logs Table
-- Run this in Supabase SQL Editor
-- ========================================

-- 1. Create food_logs table
CREATE TABLE IF NOT EXISTS public.food_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    food_type TEXT NOT NULL CHECK (food_type IN ('commercial', 'homemade', 'raw', 'treat', 'supplement')),
    brand_name TEXT DEFAULT '',
    product_name TEXT DEFAULT '',
    portion_size NUMERIC(6,2) NOT NULL,
    portion_unit TEXT NOT NULL CHECK (portion_unit IN ('cups', 'oz', 'g', 'tbsp', 'pieces')),
    ingredients TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    fed_at TIMESTAMPTZ DEFAULT now(),
    calories_per_cup INTEGER,
    protein_percentage INTEGER,
    fat_percentage INTEGER,
    fiber_percentage INTEGER,
    carbs_percentage INTEGER,
    moisture_percentage INTEGER,
    nutritional_analyzed BOOLEAN DEFAULT false,
    analysis_source TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_food_logs_pet_id ON public.food_logs(pet_id);
CREATE INDEX IF NOT EXISTS idx_food_logs_user_id ON public.food_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_food_logs_fed_at ON public.food_logs(fed_at DESC);

-- 3. Enable RLS
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for food_logs
CREATE POLICY "Users can view own food logs"
    ON public.food_logs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own food logs"
    ON public.food_logs FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own food logs"
    ON public.food_logs FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own food logs"
    ON public.food_logs FOR DELETE
    USING (user_id = auth.uid());

-- 5. Update pet_logs CHECK constraint to allow 'food' log type
-- First, drop the existing constraint
ALTER TABLE public.pet_logs DROP CONSTRAINT pet_logs_log_type_check;

-- Then add the updated constraint
ALTER TABLE public.pet_logs ADD CHECK (log_type IN ('custom', 'meal', 'medication', 'bathroom', 'food'));

-- 6. Grant public schema access to anon (for RLS)
-- (This is usually already set, but just in case)
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;