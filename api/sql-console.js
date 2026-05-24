import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ALLOWED_COMMANDS = ['SELECT', 'EXPLAIN', 'WITH'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://pupfile.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  const token = authHeader.split('Bearer ')[1];
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SQL console not configured' });
  }

  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const trimmed = query.trim().toUpperCase();
  const allowed = ALLOWED_COMMANDS.some(cmd => trimmed.startsWith(cmd));
  if (!allowed) {
    return res.status(400).json({ error: 'Only SELECT, EXPLAIN, and WITH queries are allowed' });
  }

  try {
    const { data, error } = await supabase.rpc('pg_query', { query_text: query.trim() });

    if (error) {
      return res.status(500).json({ error: error.message, hint: 'Run pupfile-sql-console-setup.sql in Supabase SQL Editor first' });
    }

    return res.status(200).json({ data, rows: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
