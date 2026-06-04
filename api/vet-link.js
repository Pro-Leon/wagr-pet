import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function cors(res, req) {
  const origin = req?.headers?.origin;
  if (origin && origin !== 'https://pupfile.com' && !origin.startsWith('http://localhost:')) return false;
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' }); return res.status(200).end(); }
  if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' });

  const action = req.method === 'GET' ? req.query.action : (req.body?.action || '');

  /* --- Create a vet upload link --- */
  if (req.method === 'POST' && action === 'create') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization' });
    }
    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { petId, vetName, clinicName, duration, durationUnit } = req.body;
    if (!petId || !vetName || !duration || !durationUnit) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: pet } = await supabase
      .from('pets')
      .select('id, user_id')
      .eq('id', petId)
      .single();
    if (!pet || pet.user_id !== user.id) return res.status(403).json({ error: 'Pet not found' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.tier || 'starter';
    if (tier === 'starter') {
      return res.status(403).json({ error: 'Vet upload links require the Starter plan or higher.' });
    }

    const multipliers = { hours: 1, days: 24, weeks: 168, months: 720 };
    const hours = multipliers[durationUnit] || 24;
    const expiresAt = new Date(Date.now() + duration * hours * 60 * 60 * 1000).toISOString();

    const { data: link, error } = await supabase
      .from('vet_upload_links')
      .insert({
        pet_id: petId,
        user_id: user.id,
        vet_name: vetName,
        clinic_name: clinicName || '',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ link });
  }

  /* --- List active vet upload links for a pet --- */
  if (req.method === 'GET' && action === 'list') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization' });
    }
    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { petId } = req.query;
    if (!petId) return res.status(400).json({ error: 'Missing petId' });

    const { data: links, error } = await supabase
      .from('vet_upload_links')
      .select('*')
      .eq('pet_id', petId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ links: links || [] });
  }

  /* --- Revoke a vet upload link --- */
  if (req.method === 'POST' && action === 'revoke') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization' });
    }
    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { linkId } = req.body;
    if (!linkId) return res.status(400).json({ error: 'Missing linkId' });

    const { error } = await supabase
      .from('vet_upload_links')
      .update({ is_active: false })
      .eq('id', linkId)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  /* --- Verify vet token --- */
  if (req.method === 'GET' && action === 'verify') {
    const { token: vetToken } = req.query;
    if (!vetToken) return res.status(400).json({ error: 'Missing token parameter' });

    const { data: link, error: linkError } = await supabase
      .from('vet_upload_links')
      .select('*')
      .eq('token', vetToken)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (linkError || !link) return res.status(404).json({ error: 'Invalid or expired vet link' });

    const { data: pet } = await supabase
      .from('pets')
      .select('id, name, breed, birth_date, medical_flags, user_id')
      .eq('id', link.pet_id)
      .single();

    if (!pet) return res.status(404).json({ error: 'Pet not found' });

    return res.status(200).json({
      pet: {
        ...pet,
        vet_name: link.vet_name,
        clinic_name: link.clinic_name,
        link_id: link.id,
      }
    });
  }

  return res.status(405).json({ error: 'Method or action not allowed' });
}
