-- ========================================
-- Migration: Add Symptom Tracking Tables
-- Run this in Supabase SQL Editor
-- ========================================

-- ========================================
-- GI TRACKER (Vomit, Feces, etc.)
-- ========================================
CREATE TABLE IF NOT EXISTS public.gi_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL CHECK (log_type IN ('vomit', 'feces', 'both')),
    consistency TEXT CHECK (consistency IN ('solid', 'soft', 'liquid', 'mucoid', 'bloody', 'foreign_object')),
    color TEXT,
    amount TEXT,
    photo_url TEXT,
    notes TEXT,
    activity_before TEXT,
    food_before TEXT,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- CARDIOLOGY TRACKER (Respiratory Rate)
-- ========================================
CREATE TABLE IF NOT EXISTS public.cardio_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    respiratory_rate INTEGER NOT NULL,
    measurement_type TEXT DEFAULT 'breaths_per_min',
    position TEXT CHECK (position IN ('standing', 'sitting', 'lying')),
    effort TEXT CHECK (effort IN ('normal', 'labored', 'rapid', 'shallow')),
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- TEST RESULTS TRACKER
-- ========================================
CREATE TABLE IF NOT EXISTS public.test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_date DATE,
    veterinarian TEXT,
    clinic TEXT,
    results JSONB,
    diagnosis TEXT,
    notes TEXT,
    document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- DERMATOLOGY TRACKER
-- ========================================
CREATE TABLE IF NOT EXISTS public.derma_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    issue_type TEXT CHECK (issue_type IN ('rash', 'lump', 'hot_spot', 'wound', 'hair_loss', 'itching', 'other')),
    location TEXT,
    severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
    description TEXT,
    photo_url TEXT,
    activity_before TEXT,
    food_before TEXT,
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- INDEXES
-- ========================================
CREATE INDEX idx_gi_logs_pet_id ON public.gi_logs(pet_id);
CREATE INDEX idx_gi_logs_recorded_at ON public.gi_logs(recorded_at DESC);
CREATE INDEX idx_cardio_logs_pet_id ON public.cardio_logs(pet_id);
CREATE INDEX idx_cardio_logs_recorded_at ON public.cardio_logs(recorded_at DESC);
CREATE INDEX idx_test_results_pet_id ON public.test_results(pet_id);
CREATE INDEX idx_test_results_test_date ON public.test_results(test_date DESC);
CREATE INDEX idx_derma_logs_pet_id ON public.derma_logs(pet_id);
CREATE INDEX idx_derma_logs_recorded_at ON public.derma_logs(recorded_at DESC);

-- ========================================
-- RLS POLICIES
-- ========================================
ALTER TABLE public.gi_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.derma_logs ENABLE ROW LEVEL SECURITY;

-- GI Logs Policies
CREATE POLICY "Users can view own gi_logs" ON public.gi_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own gi_logs" ON public.gi_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own gi_logs" ON public.gi_logs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own gi_logs" ON public.gi_logs FOR DELETE USING (user_id = auth.uid());

-- Cardio Logs Policies
CREATE POLICY "Users can view own cardio_logs" ON public.cardio_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own cardio_logs" ON public.cardio_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own cardio_logs" ON public.cardio_logs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own cardio_logs" ON public.cardio_logs FOR DELETE USING (user_id = auth.uid());

-- Test Results Policies
CREATE POLICY "Users can view own test_results" ON public.test_results FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own test_results" ON public.test_results FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own test_results" ON public.test_results FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own test_results" ON public.test_results FOR DELETE USING (user_id = auth.uid());

-- Derma Logs Policies
CREATE POLICY "Users can view own derma_logs" ON public.derma_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own derma_logs" ON public.derma_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own derma_logs" ON public.derma_logs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own derma_logs" ON public.derma_logs FOR DELETE USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;