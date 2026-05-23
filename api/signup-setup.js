import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { userId, email, displayName, tier, pet } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: 'Missing userId or email' });
  }

  const errors = [];

  // Create or update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email,
      display_name: displayName || email.split('@')[0],
      tier: tier || 'starter',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (profileError) errors.push('profile:' + profileError.message);

  // Check tier limit before creating pet
  const effectiveTier = tier || 'starter';
  const maxPets = effectiveTier === 'pro' ? 999999 : effectiveTier === 'family' ? 4 : effectiveTier === 'basic' ? 2 : 1;

  // Create first pet if data provided
  if (pet && pet.name) {
    const { count, error: countError } = await supabase
      .from('pets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      errors.push('pet_count:' + countError.message);
    } else if (count >= maxPets) {
      errors.push('pet:Pet limit reached for your plan.');
    } else {
      const { error: petError } = await supabase
        .from('pets')
        .insert({
          user_id: userId,
          name: pet.name,
          breed: pet.breed || null,
          weight_kg: pet.weight_kg || null,
          birth_date: pet.birth_date || null,
        });

      if (petError) errors.push('pet:' + petError.message);
    }
  }

  if (errors.length > 0) {
    return res.status(200).json({ ok: true, warnings: errors });
  }

  return res.status(200).json({ ok: true });
}
