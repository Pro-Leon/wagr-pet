-- ========================================
-- PupFile — Travel Documentation Schema
-- ========================================

-- Add microchip to pets
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS microchip TEXT DEFAULT '';
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS rabies_titer_date DATE;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS international_passport TEXT DEFAULT '';

-- Travel documents table
CREATE TABLE IF NOT EXISTS public.travel_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_travel_docs_pet ON public.travel_documents(pet_id);
CREATE INDEX IF NOT EXISTS idx_travel_docs_user ON public.travel_documents(user_id);

ALTER TABLE public.travel_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own travel_documents"
  ON public.travel_documents FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin travel_documents"
  ON public.travel_documents FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
