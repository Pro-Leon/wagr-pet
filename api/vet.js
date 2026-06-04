import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API = 'https://api.brevo.com/v3/smtp/email';
const SENDER = { name: 'PupFile', email: 'hello@pupfile.com' };

const VACCINE_INTERVALS = {
  'rabies 3yr': 1095, 'rabies 1yr': 365, 'rabies': 365, 'dhpp': 365, 'dapt': 365,
  'bordetella': 183, 'leptospirosis': 365, 'canine influenza': 365, 'lyme': 365,
  'parvovirus': 365, 'parvo': 365, 'coronavirus': 365, 'measles': 365,
};

function cors(res, req) {
  const origin = req?.headers?.origin;
  if (origin && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:') && !origin.endsWith('.vercel.app') && origin !== 'https://pupfile.com' && !origin.endsWith('.pupfile.com')) return false;
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

function calculateNextDueDate(vaccineName, dateGiven) {
  const name = vaccineName.toLowerCase().trim();
  let intervalDays = 365;
  for (const [key, days] of Object.entries(VACCINE_INTERVALS)) {
    if (name.includes(key)) { intervalDays = days; break; }
  }
  const given = new Date(dateGiven);
  const due = new Date(given.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return due.toISOString().split('T')[0];
}

async function notifyOwner(validated, subject, htmlBody) {
  if (!BREVO_API_KEY) return;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, notification_preferences')
      .eq('id', validated.pet.user_id)
      .single();
    if (!profile) return;
    const prefs = profile.notification_preferences || {};
    if (prefs.vet_upload === false) return;
    const email = profile.email;
    if (!email) return;
    await fetch(BREVO_API, {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email, name: '' }],
        subject,
        htmlContent: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#ea580c">PupFile</h2><p>Hi there,</p>${htmlBody}
          <a href="https://pupfile.com/dashboard" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">View in Dashboard</a>
          <p style="color:#666;font-size:0.85rem">You can manage notification preferences in your dashboard settings.</p></div>`,
      }),
    });
  } catch (e) {}
}

async function validateVetToken(vetToken) {
  const { data: link } = await supabase
    .from('vet_upload_links')
    .select('*')
    .eq('token', vetToken)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .single();
  if (!link) return null;
  const { data: pet } = await supabase
    .from('pets')
    .select('id, user_id, name')
    .eq('id', link.pet_id)
    .single();
  if (!pet) return null;
  return { link, pet };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' }); return res.status(200).end(); }
  if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' });

  const action = req.method === 'GET' ? req.query.action : (req.body?.action || '');

  /* --- Create a vet upload link --- */
  if (req.method === 'POST' && action === 'create') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { petId, vetName, clinicName, duration, durationUnit } = req.body;
    if (!petId || !vetName || !duration || !durationUnit) return res.status(400).json({ error: 'Missing required fields' });

    const { data: pet } = await supabase.from('pets').select('id, user_id').eq('id', petId).single();
    if (!pet || pet.user_id !== user.id) return res.status(403).json({ error: 'Pet not found' });

    const { data: profile } = await supabase.from('profiles').select('tier').eq('id', user.id).single();
    if (profile?.tier === 'starter') return res.status(403).json({ error: 'Vet upload links require the Starter plan or higher.' });

    const multipliers = { hours: 1, days: 24, weeks: 168, months: 720 };
    const hours = multipliers[durationUnit] || 24;
    const expiresAt = new Date(Date.now() + duration * hours * 60 * 60 * 1000).toISOString();

    const { data: link, error } = await supabase.from('vet_upload_links').insert({
      pet_id: petId, user_id: user.id, vet_name: vetName, clinic_name: clinicName || '', expires_at: expiresAt,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ link });
  }

  /* --- List active vet upload links --- */
  if (req.method === 'GET' && action === 'list') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { petId } = req.query;
    if (!petId) return res.status(400).json({ error: 'Missing petId' });

    const { data: links, error } = await supabase.from('vet_upload_links').select('*').eq('pet_id', petId).eq('is_active', true).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ links: links || [] });
  }

  /* --- Revoke a vet upload link --- */
  if (req.method === 'POST' && action === 'revoke') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });
    const token = authHeader.split('Bearer ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { linkId } = req.body;
    if (!linkId) return res.status(400).json({ error: 'Missing linkId' });

    const { error } = await supabase.from('vet_upload_links').update({ is_active: false }).eq('id', linkId).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  /* --- Verify vet token --- */
  if (req.method === 'GET' && action === 'verify') {
    const { token: vetToken } = req.query;
    if (!vetToken) return res.status(400).json({ error: 'Missing token parameter' });
    const valid = await validateVetToken(vetToken);
    if (!valid) return res.status(404).json({ error: 'Invalid or expired vet link' });
    return res.status(200).json({
      pet: { ...valid.pet, vet_name: valid.link.vet_name, clinic_name: valid.link.clinic_name, link_id: valid.link.id }
    });
  }

  /* --- Upload a vaccination record --- */
  if (req.method === 'POST' && action === 'vaccination') {
    const { token: vetToken, vaccine_name, date_given, next_due_date, notes } = req.body || {};
    if (!vetToken || !vaccine_name || !date_given) return res.status(400).json({ error: 'Missing required fields: token, vaccine_name, date_given' });
    const validated = await validateVetToken(vetToken);
    if (!validated) return res.status(403).json({ error: 'Invalid or expired vet link' });
    const dueDate = next_due_date || calculateNextDueDate(vaccine_name, date_given);
    const { data, error } = await supabase.from('vaccinations').insert({
      pet_id: validated.pet.id, user_id: validated.pet.user_id, vaccine_name, date_given,
      next_due_date: dueDate, vet_name: validated.link.vet_name, notes: notes || '', uploaded_by_vet: true,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await notifyOwner(validated,
      `Vet uploaded vaccination record for ${validated.pet.name}`,
      `<p><strong>${validated.link.vet_name}</strong> has uploaded a vaccination record for <strong>${validated.pet.name}</strong>.</p>
       <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:12px 0">
         <p><strong>Vaccine:</strong> ${vaccine_name}</p><p><strong>Date given:</strong> ${date_given}</p>
         <p><strong>Next due:</strong> ${dueDate}</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
       </div>`
    );
    return res.status(200).json({ vaccination: data, next_due_date: dueDate });
  }

  /* --- Upload a vet record (document) --- */
  if (req.method === 'POST' && action === 'record') {
    const { token: vetToken, file_name, file_url, record_type, notes } = req.body || {};
    if (!vetToken || !file_name) return res.status(400).json({ error: 'Missing required fields: token, file_name' });
    const validated = await validateVetToken(vetToken);
    if (!validated) return res.status(403).json({ error: 'Invalid or expired vet link' });
    const { data, error } = await supabase.from('vet_records').insert({
      pet_id: validated.pet.id, user_id: validated.pet.user_id, file_name, file_url: file_url || '',
      record_type: record_type || 'other', notes: notes || '', uploaded_by_vet: true, vet_name: validated.link.vet_name,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await notifyOwner(validated,
      `Vet uploaded a record for ${validated.pet.name}`,
      `<p><strong>${validated.link.vet_name}</strong> has uploaded a new record for <strong>${validated.pet.name}</strong>.</p>
       <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:12px 0">
         <p><strong>Document:</strong> ${file_name}</p><p><strong>Type:</strong> ${record_type || 'Other'}</p>
         ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
         ${file_url ? `<p><a href="${file_url}" style="color:#ea580c">View Document</a></p>` : ''}
       </div>`
    );
    return res.status(200).json({ record: data });
  }

  return res.status(405).json({ error: 'Method or action not allowed' });
}
