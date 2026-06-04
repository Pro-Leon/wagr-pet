-- ========================================
-- PupFile — Emergency Passport Schema
-- ========================================

-- Add structured emergency fields to pets
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS allergies TEXT DEFAULT '';
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS medications TEXT DEFAULT '';
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT DEFAULT '';
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT DEFAULT '';
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS primary_vet_name TEXT DEFAULT '';
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS primary_vet_phone TEXT DEFAULT '';

-- Update the public profile RPC to return new fields
CREATE OR REPLACE FUNCTION get_public_pet_profile(pet_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    breed TEXT,
    medical_flags TEXT,
    owner_contact TEXT,
    allergies TEXT,
    medications TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    primary_vet_name TEXT,
    primary_vet_phone TEXT
)
LANGUAGE SQL SECURITY DEFINER STABLE
AS $$
    SELECT p.id, p.name, p.breed, p.medical_flags, 'Contact owner via PupFile'::text,
           COALESCE(p.allergies, ''), COALESCE(p.medications, ''),
           COALESCE(p.emergency_contact_name, ''), COALESCE(p.emergency_contact_phone, ''),
           COALESCE(p.primary_vet_name, ''), COALESCE(p.primary_vet_phone, '')
    FROM pets p
    WHERE p.id = pet_id;
$$;

-- Update the public view to include new fields
DROP VIEW IF EXISTS public.vw_public_pet_profiles CASCADE;
CREATE VIEW public.vw_public_pet_profiles AS
SELECT
  id, name, breed, medical_flags,
  allergies, medications,
  emergency_contact_name, emergency_contact_phone,
  primary_vet_name, primary_vet_phone
FROM public.pets;

GRANT SELECT ON public.vw_public_pet_profiles TO anon;
GRANT SELECT ON public.vw_public_pet_profiles TO authenticated;
