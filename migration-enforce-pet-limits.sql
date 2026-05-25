-- Enforce tier-based pet limits at the database level
-- Run this against your Supabase SQL editor after deploying

CREATE OR REPLACE FUNCTION enforce_pet_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_tier TEXT;
  pet_count INT;
  max_pets INT;
BEGIN
  SELECT tier INTO user_tier FROM public.profiles WHERE id = NEW.user_id;
  IF user_tier IS NULL THEN
    user_tier := 'starter';
  END IF;

  SELECT COUNT(*) INTO pet_count FROM public.pets WHERE user_id = NEW.user_id;

  max_pets := CASE user_tier
    WHEN 'family' THEN 999999
    WHEN 'basic' THEN 2
    ELSE 1
  END;

  IF pet_count >= max_pets THEN
    RAISE EXCEPTION 'Pet limit reached for tier %: maximum % pets allowed', user_tier, max_pets;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_pet_limit_trigger ON public.pets;
CREATE TRIGGER enforce_pet_limit_trigger
  BEFORE INSERT ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION enforce_pet_limit();
