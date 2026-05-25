import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function cors(res, req) {
  const origin = req?.headers?.origin;
  const allowedOrigins = ['https://pupfile.com', 'http://localhost:3000', 'http://localhost:5173'];
  if (origin && !allowedOrigins.includes(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' }); return res.status(200).end(); }
  if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' });

  const action = req.method === 'GET' ? req.query.action : (req.body?.action || 'log');

  /* --- Create a sitter link --- */
  if (req.method === 'POST' && action === 'create') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization' });
    }
    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { petId, sitterName, label, duration, durationUnit, carePlanId } = req.body;
    if (!petId || !sitterName || !duration || !durationUnit) {
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
    if (!['basic', 'family'].includes(tier)) {
      return res.status(403).json({ error: 'Sitter links require the Starter plan or higher.' });
    }

    const multipliers = { hours: 1, days: 24, weeks: 168, months: 720 };
    const hours = multipliers[durationUnit] || 24;
    const expiresAt = new Date(Date.now() + duration * hours * 60 * 60 * 1000).toISOString();

    const { data: link, error } = await supabase
      .from('sitter_links')
      .insert({
        pet_id: petId,
        user_id: user.id,
        sitter_name: sitterName,
        label: label || '',
        expires_at: expiresAt,
        care_plan_id: carePlanId || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ link });
  }

  /* --- List active sitter links for a pet --- */
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
      .from('sitter_links')
      .select('*, care_plans(id, sitter_name, start_date, end_date)')
      .eq('pet_id', petId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ links: links || [] });
  }

  /* --- Revoke a sitter link --- */
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
      .from('sitter_links')
      .update({ is_active: false })
      .eq('id', linkId)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  /* --- Verify sitter token (supports both old and new style) --- */
  if (req.method === 'GET' && action === 'verify') {
    const { token: sitterToken } = req.query;
    if (!sitterToken) return res.status(400).json({ error: 'Missing token parameter' });

    // Check new-style sitter_links table first
    let link = null;
    try {
      const { data, error: linkError } = await supabase
        .from('sitter_links')
        .select('*')
        .eq('token', sitterToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();
      if (!linkError && data) link = data;
    } catch (e) { /* sitter_links table may not exist yet */ }

    if (link) {
      const { data: pet } = await supabase
        .from('pets')
        .select('id, name, breed, medical_flags, user_id')
        .eq('id', link.pet_id)
        .single();

      if (pet) {
        return res.status(200).json({
          pet: {
            ...pet,
            sitter_name: link.sitter_name,
            care_plan_id: link.care_plan_id,
          }
        });
      }
    }

    // Fallback: old-style pets.sitter_token
    const { data: pet, error } = await supabase
      .from('pets')
      .select('id, name, breed, medical_flags, user_id')
      .eq('sitter_token', sitterToken)
      .single();

    if (error || !pet) return res.status(404).json({ error: 'Invalid or expired sitter link' });
    return res.status(200).json({ pet });
  }

  /* --- Helper: validate sitter token (new + old style) --- */
  async function validateSitterToken(sitterToken, petId) {
    // New-style: check sitter_links table
    try {
      const { data: link } = await supabase
        .from('sitter_links')
        .select('*')
        .eq('token', sitterToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();
      if (link && (!petId || link.pet_id === petId)) {
        const { data: pet } = await supabase
          .from('pets')
          .select('id, user_id')
          .eq('id', link.pet_id)
          .single();
        if (pet) return pet;
      }
    } catch (e) {}

    // Old-style: check pets.sitter_token
    if (petId) {
      const { data: pet } = await supabase
        .from('pets')
        .select('id, user_id')
        .eq('id', petId)
        .eq('sitter_token', sitterToken)
        .single();
      if (pet) return pet;
    } else {
      const { data: pet } = await supabase
        .from('pets')
        .select('id, user_id')
        .eq('sitter_token', sitterToken)
        .single();
      if (pet) return pet;
    }

    return null;
  }

  /* --- Get logs (for sitter view) --- */
  if (req.method === 'GET' && action === 'logs') {
    const { petId, token: sitterToken } = req.query;
    if (!petId || !sitterToken) return res.status(400).json({ error: 'Missing petId or token' });

    const pet = await validateSitterToken(sitterToken, petId);
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

  /* --- Get tasks (for sitter view) --- */
  if (req.method === 'GET' && action === 'tasks') {
    const { petId, token: sitterToken } = req.query;
    if (!petId || !sitterToken) return res.status(400).json({ error: 'Missing petId or token' });

    const pet = await validateSitterToken(sitterToken, petId);
    if (!pet) return res.status(403).json({ error: 'Invalid sitter token' });

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('pet_id', petId)
      .order('date', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ tasks: data || [] });
  }

  /* --- Sitter complete task --- */
  if (req.method === 'POST' && action === 'complete_task') {
    const { taskId, token: sitterToken, sitter_name } = req.body || {};
    if (!taskId || !sitterToken) return res.status(400).json({ error: 'Missing taskId or token' });

    const pet = await validateSitterToken(sitterToken, null);
    if (!pet) return res.status(403).json({ error: 'Invalid sitter token' });

    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'done', sitter_name: sitter_name || 'Sitter' })
      .eq('id', taskId)
      .eq('pet_id', pet.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ task: data });
  }

  /* --- Sitter log entry --- */
  if (req.method === 'POST' && action === 'log') {
    const { petId, token: sitterToken, log_type, title, notes, sitter_name } = req.body || {};
    if (!petId || !sitterToken) return res.status(400).json({ error: 'Missing petId or token' });

    const pet = await validateSitterToken(sitterToken, petId);
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
