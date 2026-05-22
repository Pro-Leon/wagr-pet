import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {

    // Get the authenticated user
    const userToken = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Call the SECURITY DEFINER function to accept the invite
    const { data, error } = await supabase.rpc('accept_co_parent_invite', {
      invite_token: token,
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
