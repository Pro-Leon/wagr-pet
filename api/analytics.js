// Vercel API route for analytics events
// Receives anonymized usage data and stores in Supabase
// POST /api/analytics

export const config = {
  api: { bodyParser: false },
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (!SERVICE_ROLE_KEY) {
    return res.status(200).json({ status: 'ignored', reason: 'not configured' });
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const body = JSON.parse(rawBody);

  const { event_type, event_name, page, user_id, session_id, metadata } = body;

  if (!event_type || !event_name) {
    return res.status(400).json({ error: 'Missing event_type or event_name' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
  const ua = req.headers['user-agent'] || null;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        event_type,
        event_name,
        page: page || null,
        user_id: user_id || null,
        session_id: session_id || null,
        metadata: metadata || {},
        ip_address: ip,
        user_agent: ua,
      }),
    });

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }
}
