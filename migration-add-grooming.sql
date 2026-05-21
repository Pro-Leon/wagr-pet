-- ========================================
-- Migration: Add Grooming Appointments
-- Run this in Supabase SQL Editor
-- ========================================

-- Grooming Appointments Table
CREATE TABLE IF NOT EXISTS public.grooming_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    appointment_date TIMESTAMPTZ NOT NULL,
    groomer_name TEXT,
    groomer_contact TEXT,
    location TEXT,
    services TEXT[], -- Array of services: bath, haircut, nail trim, teeth cleaning, etc.
    products_used TEXT[], -- Array of products used
    notes TEXT,
    cost NUMERIC(10,2),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    photo_urls TEXT[],
    follow_up_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_grooming_pet_id ON public.grooming_appointments(pet_id);
CREATE INDEX idx_grooming_date ON public.grooming_appointments(appointment_date DESC);

-- Enable RLS
ALTER TABLE public.grooming_appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own grooming" ON public.grooming_appointments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own grooming" ON public.grooming_appointments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own grooming" ON public.grooming_appointments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own grooming" ON public.grooming_appointments FOR DELETE USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;