import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' }); return res.status(200).end(); }
  if (req.method !== 'POST') { cors(res, req); return res.status(405).json({ error: 'Method not allowed' }); }

  if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  const userToken = authHeader.split('Bearer ')[1];
  const action = req.body?.action || 'create';
  const { token: inviteToken, petId } = req.body || {};

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    // POST /api/coparent with { action: 'create', petId }
    if (action === 'create') {
      if (!petId) return res.status(400).json({ error: 'Missing petId' });

      const { data: pet, error: petError } = await supabase
        .from('pets')
        .select('id, name, user_id')
        .eq('id', petId)
        .single();

      if (petError || !pet) return res.status(404).json({ error: 'Pet not found' });
      if (pet.user_id !== user.id) return res.status(403).json({ error: 'You do not own this pet' });

      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();

      const tier = profile?.tier || 'starter';
      const maxCoparents = tier === 'family' ? Infinity : tier === 'basic' ? 2 : 0;

      if (maxCoparents === 0) {
        return res.status(403).json({ error: 'Your plan does not support co-parents. Upgrade to Starter or Pro.' });
      }

      const { count: existingCount } = await supabase
        .from('co_parents')
        .select('id', { count: 'exact', head: true })
        .eq('pet_id', petId);

      const { count: pendingCount } = await supabase
        .from('co_parent_invites')
        .select('id', { count: 'exact', head: true })
        .eq('pet_id', petId)
        .eq('used', false);

      const total = (existingCount || 0) + (pendingCount || 0);
      if (total >= maxCoparents) {
        return res.status(403).json({
          error: `Co-parent limit reached (${maxCoparents}). Upgrade to Pro for unlimited co-parents.`
        });
      }

      const token = crypto.randomBytes(32).toString('hex');

      const { data: invite, error: inviteError } = await supabase
        .from('co_parent_invites')
        .insert({ pet_id: petId, token, invited_by: user.id })
        .select()
        .single();

      if (inviteError) return res.status(500).json({ error: 'Failed to create invite' });

      const origin = req.headers.origin || 'https://pupfile.com';
      const inviteUrl = `${origin}/coparent?token=${token}`;

      return res.status(200).json({
        inviteUrl, token, petName: pet.name, expiresAt: invite.expires_at,
      });
    }

    // POST /api/coparent with { action: 'accept', token }
    if (action === 'accept') {
      if (!inviteToken) return res.status(400).json({ error: 'Missing token' });

      const { data, error } = await supabase.rpc('accept_co_parent_invite', {
        invite_token: inviteToken,
        accepting_user_id: user.id,
      });

      if (error) {
        if (error.message.includes('Invite not found')) {
          return res.status(404).json({ error: 'Invite not found, already used, or expired.' });
        }
        return res.status(500).json({ error: error.message });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Invite not valid.' });
      }

      const result = data[0];
      return res.status(200).json({
        success: true,
        petId: result.pet_id,
        petName: result.pet_name,
        ownerEmail: result.owner_email,
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
