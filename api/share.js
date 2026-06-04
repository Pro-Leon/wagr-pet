import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function cors(res, req) {
  const origin = req?.headers?.origin;
  if (origin && origin !== 'https://pupfile.com' && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:') && !origin.endsWith('.vercel.app')) return false;
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

async function validateSitterToken(token) {
  const { data: link } = await supabase
    .from('sitter_links')
    .select('*, pets!sitter_links_pet_id_fkey(id, name, breed, medical_flags, user_id, birth_date, microchip, international_passport)')
    .eq('token', token)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return link || null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' }); return res.status(200).end(); }
  if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' });

  const action = req.method === 'GET' ? req.query.action : (req.body?.action || '');

  /* ========== CO-PARENT ACTIONS ========== */

  if (action === 'coparent_create') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const userToken = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { petId } = req.body || {};
    if (!petId) return res.status(400).json({ error: 'Missing petId' });

    const { data: pet } = await supabase.from('pets').select('id, name, user_id').eq('id', petId).single();
    if (!pet || pet.user_id !== user.id) return res.status(403).json({ error: 'Pet not found or not owned by you' });

    const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single();
    const tier = profile?.tier || 'starter';
    const maxCoparents = (tier === 'family' || tier === 'pro') ? Infinity : tier === 'basic' ? 2 : 0;
    if (maxCoparents === 0) return res.status(403).json({ error: 'Your plan does not support co-parents. Upgrade to Starter or Pro.' });

    const { count: existingCount } = await supabase.from('co_parents').select('id', { count: 'exact', head: true }).eq('pet_id', petId);
    const { count: pendingCount } = await supabase.from('co_parent_invites').select('id', { count: 'exact', head: true }).eq('pet_id', petId).eq('used', false);
    if ((existingCount || 0) + (pendingCount || 0) >= maxCoparents) {
      return res.status(403).json({ error: `Co-parent limit reached (${maxCoparents}). Upgrade to Pro for unlimited.` });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const { data: invite, error: inviteError } = await supabase.from('co_parent_invites').insert({ pet_id: petId, token, invited_by: user.id }).select().single();
    if (inviteError) return res.status(500).json({ error: 'Failed to create invite' });

    const origin = req.headers.origin || 'https://pupfile.com';
    return res.status(200).json({ inviteUrl: `${origin}/coparent?token=${token}`, token, petName: pet.name, expiresAt: invite.expires_at });
  }

  if (action === 'coparent_accept') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const userToken = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { token: inviteToken } = req.body || {};
    if (!inviteToken) return res.status(400).json({ error: 'Missing token' });

    const { data, error } = await supabase.rpc('accept_co_parent_invite', { invite_token: inviteToken, accepting_user_id: user.id });
    if (error) return res.status(500).json({ error: error.message.includes('Invite not found') ? 'Invite not found, already used, or expired.' : error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Invite not valid.' });
    return res.status(200).json({ success: true, petId: data[0].pet_id, petName: data[0].pet_name, ownerEmail: data[0].owner_email });
  }

  /* ========== SITTER LINK ACTIONS ========== */

  if (action === 'create') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const userToken = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { petId, sitterName, label, duration, durationUnit, carePlanId } = req.body;
    if (!petId || !sitterName || !duration || !durationUnit) return res.status(400).json({ error: 'Missing required fields' });

    const { data: pet } = await supabase.from('pets').select('id, user_id').eq('id', petId).single();
    if (!pet || pet.user_id !== user.id) return res.status(403).json({ error: 'Pet not found' });

    const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single();
    if (!profile || profile.tier === 'starter') return res.status(403).json({ error: 'Sitter links require the Starter plan or higher.' });

    const multipliers = { hours: 1, days: 24, weeks: 168, months: 720 };
    const hours = multipliers[durationUnit] || 24;
    const expiresAt = new Date(Date.now() + duration * hours * 60 * 60 * 1000).toISOString();
    const token = crypto.randomBytes(32).toString('hex');

    const { data: link, error } = await supabase.from('sitter_links').insert({
      pet_id: petId, user_id: user.id, sitter_name: sitterName, label: label || '', token,
      expires_at: expiresAt, care_plan_id: carePlanId || null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ link });
  }

  if (req.method === 'GET' && action === 'list') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const userToken = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { petId } = req.query;
    if (!petId) return res.status(400).json({ error: 'Missing petId' });

    const { data: links, error } = await supabase.from('sitter_links').select('*').eq('pet_id', petId).eq('is_active', true).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ links: links || [] });
  }

  if (req.method === 'POST' && action === 'revoke') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const userToken = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { linkId } = req.body;
    if (!linkId) return res.status(400).json({ error: 'Missing linkId' });

    const { error } = await supabase.from('sitter_links').update({ is_active: false }).eq('id', linkId).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET' && action === 'verify') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const link = await validateSitterToken(token);
    if (!link) return res.status(404).json({ error: 'Invalid or expired sitter link' });
    return res.status(200).json({
      pet: link.pets, sitterName: link.sitter_name, label: link.label, link_id: link.id,
      carePlanId: link.care_plan_id,
    });
  }

  if (req.method === 'GET' && action === 'logs') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const link = await validateSitterToken(token);
    if (!link) return res.status(404).json({ error: 'Invalid or expired sitter link' });
    const { data: logs } = await supabase.from('pet_logs').select('*').eq('pet_id', link.pet_id).order('created_at', { ascending: false }).limit(30);
    return res.status(200).json({ logs: logs || [] });
  }

  if (req.method === 'GET' && action === 'tasks') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const link = await validateSitterToken(token);
    if (!link) return res.status(404).json({ error: 'Invalid or expired sitter link' });
    const { data: tasks } = await supabase.from('tasks').select('*').eq('pet_id', link.pet_id).order('date', { ascending: false });
    return res.status(200).json({ tasks: tasks || [] });
  }

  if (action === 'log') {
    const { token, petId, sitter_name, log_type, title, notes } = req.body || {};
    const link = token ? await validateSitterToken(token) : null;
    const isSitter = !!link;
    if (!isSitter) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
      const userToken = authHeader.split('Bearer ')[1];
      const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
      if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });
      const { data: pet } = await supabase.from('pets').select('user_id').eq('id', petId).single();
      if (!pet || pet.user_id !== user.id) return res.status(403).json({ error: 'Pet not found' });
    }
    const targetPetId = isSitter ? link.pet_id : petId;
    const sitterName = isSitter ? link.sitter_name : (sitter_name || 'Owner');
    const { data: logEntry, error } = await supabase.from('pet_logs').insert({
      pet_id: targetPetId, log_type, title, notes: notes || '', source: isSitter ? 'sitter' : 'owner',
      sitter_name: sitterName, created_at: new Date().toISOString(),
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ log: logEntry });
  }

  if (action === 'complete_task') {
    const { token, taskId } = req.body || {};
    const link = token ? await validateSitterToken(token) : null;
    if (!link) return res.status(401).json({ error: 'Invalid or expired sitter link' });
    const { data: task } = await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString(), completed_by: link.sitter_name }).eq('id', taskId).eq('pet_id', link.pet_id).select().single();
    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.status(200).json({ task });
  }

  return res.status(405).json({ error: 'Method or action not allowed' });
}
