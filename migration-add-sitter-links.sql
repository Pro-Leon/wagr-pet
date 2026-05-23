-- Sitter Links with expiration, name, and care plan association

CREATE TABLE IF NOT EXISTS sitter_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sitter_name TEXT NOT NULL,
  label TEXT DEFAULT '',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL,
  care_plan_id UUID REFERENCES public.care_plans(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sitter_links_pet ON sitter_links(pet_id);
CREATE INDEX IF NOT EXISTS idx_sitter_links_token ON sitter_links(token);
CREATE INDEX IF NOT EXISTS idx_sitter_links_active ON sitter_links(pet_id, is_active);

ALTER TABLE sitter_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sitter links"
  ON sitter_links FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Anon can read sitter links by token"
  ON sitter_links FOR SELECT
  TO anon
  USING (is_active = true AND expires_at > now());

-- RLS for anon select on care_plans when accessed via sitter link
CREATE POLICY "Anon can read care plans by sitter link"
  ON public.care_plans FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT care_plan_id FROM sitter_links
      WHERE token = current_setting('request.jwt.claims', true)::json->>'sitter_token'
      AND is_active = true AND expires_at > now()
    )
  );
