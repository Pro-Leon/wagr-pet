// Vercel API route for subscription management
// Returns a Paystack subscription management link the user can visit
// to cancel, pause, or update their payment method.
// POST /api/manage-subscription

export const config = {
  api: {
    bodyParser: false,
  },
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const { userId, action, newPlan } = JSON.parse(rawBody);

  if (!userId || !action) {
    return res.status(400).json({ error: 'Missing userId or action' });
  }

  if (!PAYSTACK_SECRET || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured for payment management' });
  }

  try {
    // Fetch user profile to get subscription_code
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=subscription_code,subscription_status,tier`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!profileRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
    const profiles = await profileRes.json();
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    const profile = profiles[0];

    if (action === 'manage') {
      if (!profile.subscription_code) {
        return res.json({ action: 'redirect', url: null, message: 'No active subscription found. Please subscribe first.' });
      }

      // Generate Paystack subscription management link
      const paystackRes = await fetch(
        `https://api.paystack.co/subscription/${profile.subscription_code}/manage/link`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!paystackRes.ok) {
        const errText = await paystackRes.text();
        return res.status(500).json({ error: `Paystack API error: ${paystackRes.status} ${errText}` });
      }

      const paystackData = await paystackRes.json();
      if (!paystackData.status || !paystackData.data?.link) {
        return res.status(500).json({ error: 'Failed to generate management link' });
      }

      return res.json({ action: 'redirect', url: paystackData.data.link });
    }

    if (action === 'status') {
      return res.json({
        subscription_code: profile.subscription_code,
        subscription_status: profile.subscription_status,
        tier: profile.tier,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('Manage subscription error:', err);
    return res.status(500).json({ error: err.message });
  }
}
