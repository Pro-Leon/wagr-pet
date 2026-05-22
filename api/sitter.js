import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(200).end(); }

  cors(res);

  const action = req.method === 'GET' ? req.query.action : (req.body?.action || 'log');

  // GET /api/sitter?action=verify&token=...
  if (req.method === 'GET' && action === 'verify') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token parameter' });

    const { data, error } = await supabase
      .from('pets')
      .select('id, name, breed, medical_flags, user_id')
      .eq('sitter_token', token)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Invalid or expired sitter link' });
    return res.status(200).json({ pet: data });
  }

  // GET /api/sitter?action=logs&petId=...&token=...
  if (req.method === 'GET' && action === 'logs') {
    const { petId, token } = req.query;
    if (!petId || !token) return res.status(400).json({ error: 'Missing petId or token' });

    const { data: pet } = await supabase
      .from('pets')
      .select('id')
      .eq('id', petId)
      .eq('sitter_token', token)
      .single();

    if (!pet) return res.status(403).json({ error: 'Invalid sitter token' });

    const { data, error } = await supabase
      .from('pet_logs')
      .select('*')
      .eq('pet_id', petId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ logs: data || [] });
  }

  // POST /api/sitter with { action: 'log', petId, token, ... }
  if (req.method === 'POST' && action === 'log') {
    const { petId, token, log_type, title, notes, sitter_name } = req.body || {};
    if (!petId || !token) return res.status(400).json({ error: 'Missing petId or token' });

    const { data: pet } = await supabase
      .from('pets')
      .select('id, user_id')
      .eq('id', petId)
      .eq('sitter_token', token)
      .single();

    if (!pet) return res.status(403).json({ error: 'Invalid sitter token' });

    const { data, error } = await supabase
      .from('pet_logs')
      .insert({
        pet_id: petId,
        user_id: pet.user_id,
        log_type: log_type || 'custom',
        title: title || '',
        notes: notes || '',
        sitter_name: sitter_name || 'Sitter',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ log: data });
  }

  return res.status(405).json({ error: 'Method or action not allowed' });
}
