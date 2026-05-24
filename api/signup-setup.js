import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const allowedOrigins = ['https://pupfile.com', 'http://localhost:3000', 'http://localhost:5173'];
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { userId, email, displayName, pet } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ error: 'Missing userId or email' });
  }

  const errors = [];

  // Create or update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email,
      display_name: displayName || email.split('@')[0],
      tier: 'starter',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (profileError) errors.push('profile:' + profileError.message);

  // New signups always start at free tier; upgrades come via Paystack webhook
  const maxPets = 1;

  // Create first pet if data provided
  if (pet && pet.name) {
    const { count, error: countError } = await supabase
      .from('pets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      errors.push('pet_count:' + countError.message);
    } else if (count >= maxPets) {
      errors.push('pet:Pet limit reached for your plan.');
    } else {
      const { error: petError } = await supabase
        .from('pets')
        .insert({
          user_id: userId,
          name: pet.name,
          breed: pet.breed || null,
          weight_kg: pet.weight_kg || null,
          birth_date: pet.birth_date || null,
        });

      if (petError) errors.push('pet:' + petError.message);
    }
  }

  // Send welcome email (fire-and-forget)
  try {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    if (BREVO_API_KEY) {
      const petName = pet?.name || '';
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Pup File', email: 'hello@pupfile.com' },
          to: [{ email, name: displayName || email.split('@')[0] }],
          subject: 'Welcome to Pup File — your pet care dashboard is ready',
          htmlContent: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#ea580c">Pup File</h2>
              <p>Hi ${displayName || email.split('@')[0]},</p>
              <p>Welcome to Pup File! Your smart dog care dashboard is ready to go.</p>
              <p>Here's what you can do:</p>
              <ul>
                <li>Log meals, medications, and bathroom breaks</li>
                <li>Track symptoms and grooming appointments</li>
                <li>Generate QR emergency tags for your pet's collar</li>
                <li>Share sitter magic links</li>
                <li>Use free toxicity and calorie calculators</li>
              </ul>
              <a href="https://pupfile.com/dashboard" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">Go to Dashboard</a>
              <p style="color:#666;font-size:0.85rem">Start with the Starter plan — free forever, no credit card needed.</p>
            </div>`,
        }),
      });
    }
  } catch (e) {
    console.error('Welcome email failed:', e.message);
  }

  if (errors.length > 0) {
    return res.status(200).json({ ok: true, warnings: errors });
  }

  return res.status(200).json({ ok: true });
}
