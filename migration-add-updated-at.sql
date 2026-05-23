-- Add updated_at columns that the update_updated_at_column() trigger expects
-- (the coparent analytics migration installed triggers but supabase-schema.sql
--  didn't include updated_at in the table definitions)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.pet_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.food_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
