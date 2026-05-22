// Vercel API route for Paystack Webhook
// Automatically upgrades profiles.tier on successful subscription payments
// Receives POST from Paystack Dashboard -> Settings -> Webhooks -> Add URL
// Webhook URL: https://wagr-ai.vercel.app/api/paystack-webhook
// Events to subscribe to: charge.success, subscription.create, invoice.create,
//                         subscription.disable, subscription.expiring

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  // Collect raw body for signature verification
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');

  // Verify HMAC-SHA256 signature
  const signature = req.headers['x-paystack-signature'];
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    console.error('PAYSTACK_SECRET_KEY not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse body
  const event = JSON.parse(rawBody);

  try {
    const result = await handlePaystackEvent(event);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(200).json({ status: 'error', message: err.message });
  }
}

async function handlePaystackEvent(event) {
  const data = event.data;

  // Handle subscription cancellation / expiry → downgrade to free
  if (event.event === 'subscription.disable' || event.event === 'subscription.expiring') {
    const email = data.customer?.email;
    if (!email) return { status: 'missing_email', event: event.event };

    const supabaseUrl = process.env.SUPABASE_URL || 'https://rbhqvginjduyjzyfzxbq.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');

    const user = await findUserByEmail(email, supabaseUrl, serviceRoleKey);
    if (!user) return { status: 'user_not_found', email };

    await updateProfileTier(user.id, 'starter', supabaseUrl, serviceRoleKey);
    await clearSubscriptionCode(user.id, supabaseUrl, serviceRoleKey);
    return { status: 'downgraded', tier: 'starter', email };
  }

  // Handle invoice failed → potential downgrade
  if (event.event === 'invoice.failed') {
    const email = data.customer?.email;
    if (!email) return { status: 'missing_email', event: event.event };

    const supabaseUrl = process.env.SUPABASE_URL || 'https://rbhqvginjduyjzyfzxbq.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');

    const user = await findUserByEmail(email, supabaseUrl, serviceRoleKey);
    if (!user) return { status: 'user_not_found', email };

    await updateProfileTier(user.id, 'starter', supabaseUrl, serviceRoleKey);
    await clearSubscriptionCode(user.id, supabaseUrl, serviceRoleKey);
    return { status: 'downgraded_due_to_failed_payment', tier: 'starter', email };
  }

  // Handle successful payment events → upgrade tier
  const relevantEvents = ['charge.success', 'subscription.create', 'invoice.create'];

  if (!relevantEvents.includes(event.event)) {
    return { status: 'ignored', event: event.event };
  }

  // Extract info from event data
  const email = data.customer?.email;
  const planCode = data.plan?.plan_code;
  const userId = data.metadata?.user_id;
  let planType = data.metadata?.plan_type;
  const subscriptionCode = data.subscription?.subscription_code || data.metadata?.subscription_code;

  if (!planType && planCode) {
    const codeToPlan = {
      'PLN_x7yn9h54irimq96': 'basic_monthly',
      'PLN_omjluu4cllyzgyd': 'basic_yearly',
      'PLN_38n01fa6kxbk9vn': 'family_monthly',
      'PLN_3r0edwfqim3uixw': 'family_yearly',
      'PLN_wlpu3bvnyl5x7di': 'pro_monthly',
      'PLN_bdr7x2i4rkb4cod': 'pro_yearly',
    };
    planType = codeToPlan[planCode];
  }

  if (!email || !planType) {
    return { status: 'missing_data', event: event.event };
  }

  const tierMap = {
    'basic_monthly': 'basic',
    'basic_yearly': 'basic',
    'family_monthly': 'family',
    'family_yearly': 'family',
    'pro_monthly': 'pro',
    'pro_yearly': 'pro',
  };

  const tier = tierMap[planType];
  if (!tier) {
    return { status: 'unknown_plan', plan: planType };
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://rbhqvginjduyjzyfzxbq.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  // Find the user
  let userIdToUpdate = userId;

  if (!userIdToUpdate) {
    const user = await findUserByEmail(email, supabaseUrl, serviceRoleKey);
    if (!user) return { status: 'user_not_found', email };
    userIdToUpdate = user.id;
  }

  // Update profile tier + subscription code
  await updateProfileTier(userIdToUpdate, tier, supabaseUrl, serviceRoleKey, subscriptionCode);

  return { status: 'success', tier, email };
}

async function findUserByEmail(email, supabaseUrl, serviceRoleKey) {
  // Try to find user via GoTrue Admin API
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });

    if (res.ok) {
      const body = await res.json();
      const users = body.users || body;
      if (Array.isArray(users)) {
        return users.find(u => u.email === email) || null;
      }
    }
  } catch (e) {
    console.warn('GoTrue admin API failed, trying profiles table:', e.message);
  }

  // Fallback: query profiles table by email
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`,
      {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (res.ok) {
      const profiles = await res.json();
      if (profiles && profiles.length > 0) {
        return { id: profiles[0].id };
      }
    }
  } catch (e) {
    console.warn('Profiles fallback failed:', e.message);
  }

  return null;
}

async function updateProfileTier(userId, tier, supabaseUrl, serviceRoleKey, subscriptionCode) {
  const body = {
    tier: tier,
    updated_at: new Date().toISOString(),
  };
  if (subscriptionCode) {
    body.subscription_code = subscriptionCode;
    body.subscription_status = 'active';
  }
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update profile: ${res.status} ${errText}`);
  }
}

async function clearSubscriptionCode(userId, supabaseUrl, serviceRoleKey) {
  await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscription_code: null,
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    }),
  });
}
