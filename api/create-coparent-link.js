const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  const { petId } = req.body;
  if (!petId) {
    return res.status(400).json({ error: 'Missing petId' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Verify the user owns this pet
    const userId = authHeader.split('Bearer ')[1];
    const { data: pet, error: petError } = await supabase
      .from('pets')
      .select('id, name, user_id')
      .eq('id', petId)
      .single();

    if (petError || !pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }

    // Get the authenticated user from the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(userId);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (pet.user_id !== user.id) {
      return res.status(403).json({ error: 'You do not own this pet' });
    }

    // Get user's profile to check tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.tier || 'starter';
    const tierLevels = { starter: 0, basic: 1, family: 2, pro: 3 };
    const maxCoparents = tier === 'pro' ? Infinity : tier === 'family' ? 3 : 0;

    if (maxCoparents === 0) {
      return res.status(403).json({ error: 'Your plan does not support co-parents. Upgrade to Family or Pro.' });
    }

    // Count existing co-parents + invites for this pet
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

    // Generate a cryptographically random token
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    const { data: invite, error: inviteError } = await supabase
      .from('co_parent_invites')
      .insert({
        pet_id: petId,
        token,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      return res.status(500).json({ error: 'Failed to create invite' });
    }

    const origin = req.headers.origin || 'https://wagr-ai.vercel.app';
    const inviteUrl = `${origin}/coparent?token=${token}`;

    return res.status(200).json({
      inviteUrl,
      token,
      petName: pet.name,
      expiresAt: invite.expires_at,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
