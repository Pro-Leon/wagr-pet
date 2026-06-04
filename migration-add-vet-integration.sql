-- ========================================
-- PupFile — Vet Integration Schema
-- ========================================

-- Vet Upload Links (similar to sitter_links)
CREATE TABLE IF NOT EXISTS public.vet_upload_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vet_name TEXT NOT NULL,
  clinic_name TEXT DEFAULT '',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vet_upload_links_pet ON public.vet_upload_links(pet_id);
CREATE INDEX IF NOT EXISTS idx_vet_upload_links_token ON public.vet_upload_links(token);
CREATE INDEX IF NOT EXISTS idx_vet_upload_links_active ON public.vet_upload_links(pet_id, is_active);

ALTER TABLE public.vet_upload_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vet upload links"
  ON public.vet_upload_links FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Anon can read vet upload links by token"
  ON public.vet_upload_links FOR SELECT
  TO anon
  USING (is_active = true AND expires_at > now());

-- Add columns to vet_records for vet upload tracking
ALTER TABLE public.vet_records ADD COLUMN IF NOT EXISTS uploaded_by_vet BOOLEAN DEFAULT false;
ALTER TABLE public.vet_records ADD COLUMN IF NOT EXISTS vet_name TEXT DEFAULT '';

-- Add columns to vaccinations for vet upload tracking
ALTER TABLE public.vaccinations ADD COLUMN IF NOT EXISTS uploaded_by_vet BOOLEAN DEFAULT false;

-- Update notification_preferences default to include vet_upload
ALTER TABLE public.profiles ALTER COLUMN notification_preferences SET DEFAULT '{
  "email_updates": true,
  "sitter_activity": true,
  "billing_alerts": true,
  "marketing": false,
  "vet_upload": true
}'::jsonb;

-- Add NEW vet uploads notification to existing profiles that don't have it
UPDATE public.profiles
SET notification_preferences = notification_preferences || '{"vet_upload": true}'::jsonb
WHERE notification_preferences IS NOT NULL
  AND NOT (notification_preferences ? 'vet_upload');

-- Auto-trigger for updated_at on vet_upload_links
CREATE OR REPLACE FUNCTION update_vet_upload_links_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_vet_upload_links_updated_at ON public.vet_upload_links;
CREATE TRIGGER trigger_vet_upload_links_updated_at
  BEFORE UPDATE ON public.vet_upload_links
  FOR EACH ROW
  EXECUTE FUNCTION update_vet_upload_links_updated_at();
