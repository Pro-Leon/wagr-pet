import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PLAN_CODES = {
  basic_monthly: 'PLN_x7yn9h54irimq96', basic_yearly: 'PLN_omjluu4cllyzgyd',
  family_monthly: 'PLN_38n01fa6kxbk9vn', family_yearly: 'PLN_3r0edwfqim3uixw',
};

const TIER_MAP = { basic_monthly: 'basic', basic_yearly: 'basic', family_monthly: 'family', family_yearly: 'family' };

export const config = { api: { bodyParser: false } };

function setCors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function findUserByEmail(email) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (res.ok) {
      const body = await res.json();
      const users = body.users || body;
      if (Array.isArray(users)) return users.find(u => u.email === email) || null;
    }
  } catch (e) { console.warn('GoTrue admin API failed, trying profiles table:', e.message); }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`, {
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (res.ok) {
      const profiles = await res.json();
      if (profiles && profiles.length > 0) return { id: profiles[0].id };
    }
  } catch (e) { console.warn('Profiles fallback failed:', e.message); }
  return null;
}

async function updateProfileTier(userId, tier, subscriptionCode) {
  const body = { tier, updated_at: new Date().toISOString() };
  if (subscriptionCode) { body.subscription_code = subscriptionCode; body.subscription_status = 'active'; }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to update profile: ${res.status} ${await res.text()}`);
}

async function clearSubscriptionCode(userId) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription_code: null, subscription_status: 'cancelled', updated_at: new Date().toISOString() }),
  });
}

/* --- Webhook event handler --- */
async function handlePaystackEvent(event) {
  const data = event.data;
  if (event.event === 'subscription.disable' || event.event === 'subscription.expiring') {
    const email = data.customer?.email;
    if (!email) return { status: 'missing_email', event: event.event };
    const user = await findUserByEmail(email);
    if (!user) return { status: 'user_not_found', email };
    await updateProfileTier(user.id, 'starter');
    await clearSubscriptionCode(user.id);
    return { status: 'downgraded', tier: 'starter', email };
  }
  if (event.event === 'invoice.failed') {
    const email = data.customer?.email;
    if (!email) return { status: 'missing_email', event: event.event };
    const user = await findUserByEmail(email);
    if (!user) return { status: 'user_not_found', email };
    await updateProfileTier(user.id, 'starter');
    await clearSubscriptionCode(user.id);
    return { status: 'downgraded_due_to_failed_payment', tier: 'starter', email };
  }
  const relevantEvents = ['charge.success', 'subscription.create', 'invoice.create'];
  if (!relevantEvents.includes(event.event)) return { status: 'ignored', event: event.event };
  const email = data.customer?.email;
  let userId = data.metadata?.user_id;
  let planCode = data.plan?.plan_code || data.plan_object?.plan_code;
  let planType = data.metadata?.plan_type;
  const subscriptionCode = data.subscription?.subscription_code || data.subscription_code || data.metadata?.subscription_code;
  if (!planType && planCode) planType = Object.entries(PLAN_CODES).find(([, v]) => v === planCode)?.[0];
  if (!email || !planType) return { status: 'missing_data', event: event.event };
  const tier = TIER_MAP[planType];
  if (!tier) return { status: 'unknown_plan', plan: planType };
  if (!userId) { const user = await findUserByEmail(email); if (!user) return { status: 'user_not_found', email }; userId = user.id; }
  await updateProfileTier(userId, tier, subscriptionCode);
  return { status: 'success', tier, email };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res, req.headers.origin); return res.status(200).end(); }
  setCors(res, req.headers.origin);

  const origin = req.headers.origin;
  if (origin && origin !== 'https://pupfile.com' && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:') && !origin.endsWith('.vercel.app')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await parseBody(req);

  /* --- Webhook: detect by x-paystack-signature header --- */
  const signature = req.headers['x-paystack-signature'];
  if (signature) {
    if (!PAYSTACK_SECRET) return res.status(500).json({ error: 'Webhook secret not configured' });
    const expected = crypto.createHmac('sha256', PAYSTACK_SECRET).update(rawBody).digest('hex');
    if (signature !== expected) return res.status(401).json({ error: 'Invalid signature' });
    const event = JSON.parse(rawBody);
    try { return res.status(200).json(await handlePaystackEvent(event)); }
    catch (err) { console.error('Webhook handler error:', err); return res.status(200).json({ status: 'error', message: err.message }); }
  }

  /* --- Regular API actions --- */
  const body = JSON.parse(rawBody);
  const { action, email, plan, userId } = body;

  if (!action) return res.status(400).json({ error: 'Missing action' });

  /* --- create_subscription --- */
  if (action === 'create_subscription') {
    if (!email || !plan) return res.status(400).json({ error: 'Email and plan are required' });
    if (!PAYSTACK_SECRET) return res.status(500).json({ error: 'Payment service not configured', hint: 'Set PAYSTACK_SECRET_KEY in Vercel project settings' });
    const planCode = PLAN_CODES[plan];
    if (!planCode) return res.status(400).json({ error: 'Invalid plan selected' });
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: planCode, currency: 'USD', callback_url: process.env.APP_URL || 'https://pupfile.com/dashboard', metadata: { user_id: userId, plan_type: plan } }),
      });
      const result = await response.json();
      if (!result.status) return res.status(400).json({ error: result.message });
      return res.status(200).json({ authorization_url: result.data.authorization_url, reference: result.data.reference });
    } catch (error) { console.error('Paystack Error:', error); return res.status(500).json({ error: 'Payment initialization failed' }); }
  }

  /* --- manage_subscription --- */
  if (action === 'manage') {
    if (!PAYSTACK_SECRET || !SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Server not configured for payment management' });
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=subscription_code,subscription_status,tier`, {
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!profileRes.ok) return res.status(500).json({ error: 'Failed to fetch profile' });
    const profiles = await profileRes.json();
    if (!profiles || profiles.length === 0) return res.status(404).json({ error: 'User profile not found' });
    const profile = profiles[0];
    if (!profile.subscription_code) return res.json({ action: 'redirect', url: null, message: 'No active subscription found. Please subscribe first.' });
    const paystackRes = await fetch(`https://api.paystack.co/subscription/${profile.subscription_code}/manage/link`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
    });
    if (!paystackRes.ok) return res.status(500).json({ error: `Paystack API error: ${paystackRes.status} ${await paystackRes.text()}` });
    const paystackData = await paystackRes.json();
    if (!paystackData.status || !paystackData.data?.link) return res.status(500).json({ error: 'Failed to generate management link' });
    return res.json({ action: 'redirect', url: paystackData.data.link });
  }

  /* --- status --- */
  if (action === 'status') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=subscription_code,subscription_status,tier`, {
      headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!profileRes.ok) return res.status(500).json({ error: 'Failed to fetch profile' });
    const profiles = await profileRes.json();
    if (!profiles || profiles.length === 0) return res.status(404).json({ error: 'User profile not found' });
    return res.json({ subscription_code: profiles[0].subscription_code, subscription_status: profiles[0].subscription_status, tier: profiles[0].tier });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
