import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API = 'https://api.brevo.com/v3/smtp/email';
const SENDER = { name: 'PupFile', email: 'hello@pupfile.com' };

function cors(res, req) {
  const origin = req?.headers?.origin;
  if (origin && origin !== 'https://pupfile.com' && !origin.startsWith('http://localhost:')) return false;
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

/* --- Common vaccine intervals in days --- */
const VACCINE_INTERVALS = {
  'rabies 3yr': 1095,
  'rabies 1yr': 365,
  'rabies': 365,
  'dhpp': 365,
  'dapt': 365,
  'bordetella': 183,
  'leptospirosis': 365,
  'canine influenza': 365,
  'lyme': 365,
  'parvovirus': 365,
  'parvo': 365,
  'coronavirus': 365,
  'measles': 365,
};

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

/* --- Send notification to pet owner --- */
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
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#ea580c">PupFile</h2>
            <p>Hi there,</p>
            ${htmlBody}
            <a href="https://pupfile.com/dashboard" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">View in Dashboard</a>
            <p style="color:#666;font-size:0.85rem">You can manage notification preferences in your dashboard settings.</p>
          </div>`,
      }),
    });
  } catch (e) { /* non-critical */ }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { if (!cors(res, req)) return res.status(200).end(); return res.status(200).end(); }
  if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.body?.action || '';

  async function validateVetToken(vetToken) {
    const { data: link, error: linkError } = await supabase
      .from('vet_upload_links')
      .select('*')
      .eq('token', vetToken)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();
    if (linkError || !link) return null;
    const { data: pet } = await supabase
      .from('pets')
      .select('id, user_id, name')
      .eq('id', link.pet_id)
      .single();
    if (!pet) return null;
    return { link, pet };
  }

  /* --- Upload a vaccination record --- */
  if (action === 'vaccination') {
    const { token: vetToken, vaccine_name, date_given, next_due_date, notes } = req.body || {};
    if (!vetToken || !vaccine_name || !date_given) {
      return res.status(400).json({ error: 'Missing required fields: token, vaccine_name, date_given' });
    }

    const validated = await validateVetToken(vetToken);
    if (!validated) return res.status(403).json({ error: 'Invalid or expired vet link' });

    const dueDate = next_due_date || calculateNextDueDate(vaccine_name, date_given);

    const { data, error } = await supabase
      .from('vaccinations')
      .insert({
        pet_id: validated.pet.id,
        user_id: validated.pet.user_id,
        vaccine_name,
        date_given,
        next_due_date: dueDate,
        vet_name: validated.link.vet_name,
        notes: notes || '',
        uploaded_by_vet: true,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await notifyOwner(validated,
      `Vet uploaded vaccination record for ${validated.pet.name}`,
      `<p><strong>${validated.link.vet_name}</strong> has uploaded a vaccination record for <strong>${validated.pet.name}</strong>.</p>
       <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:12px 0">
         <p><strong>Vaccine:</strong> ${vaccine_name}</p>
         <p><strong>Date given:</strong> ${date_given}</p>
         <p><strong>Next due:</strong> ${dueDate}</p>
         ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
       </div>`
    );

    return res.status(200).json({ vaccination: data, next_due_date: dueDate });
  }

  /* --- Upload a vet record (document) --- */
  if (action === 'record') {
    const { token: vetToken, file_name, file_url, record_type, notes } = req.body || {};
    if (!vetToken || !file_name) {
      return res.status(400).json({ error: 'Missing required fields: token, file_name' });
    }

    const validated = await validateVetToken(vetToken);
    if (!validated) return res.status(403).json({ error: 'Invalid or expired vet link' });

    const { data, error } = await supabase
      .from('vet_records')
      .insert({
        pet_id: validated.pet.id,
        user_id: validated.pet.user_id,
        file_name,
        file_url: file_url || '',
        record_type: record_type || 'other',
        notes: notes || '',
        uploaded_by_vet: true,
        vet_name: validated.link.vet_name,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await notifyOwner(validated,
      `Vet uploaded a record for ${validated.pet.name}`,
      `<p><strong>${validated.link.vet_name}</strong> has uploaded a new record for <strong>${validated.pet.name}</strong>.</p>
       <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:12px 0">
         <p><strong>Document:</strong> ${file_name}</p>
         <p><strong>Type:</strong> ${record_type || 'Other'}</p>
         ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
         ${file_url ? `<p><a href="${file_url}" style="color:#ea580c">View Document</a></p>` : ''}
       </div>`
    );

    return res.status(200).json({ record: data });
  }

  return res.status(400).json({ error: 'Unknown action. Use "vaccination" or "record".' });
}
