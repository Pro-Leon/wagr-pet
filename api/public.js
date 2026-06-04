import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function cors(res, req) {
  const origin = req?.headers?.origin;
  if (origin && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:') && !origin.endsWith('.vercel.app') && origin !== 'https://pupfile.com' && !origin.endsWith('.pupfile.com')) return false;
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' }); return res.status(200).end(); }
  if (!cors(res, req)) return res.status(403).json({ error: 'Origin not allowed' });

  const petId = req.query.petId || req.query.id;

  if (!petId) {
    return res.status(400).json({ error: 'Missing petId parameter' });
  }

  const { data: pet, error: petErr } = await supabase
    .from('pets')
    .select('id, name, breed, birth_date, weight_kg, medical_flags, microchip, color, allergies, medications, emergency_contact_name, emergency_contact_phone, primary_vet_name, primary_vet_phone, user_id')
    .eq('id', petId)
    .single();

  if (petErr || !pet) {
    return res.status(404).json({ error: 'Pet not found' });
  }

  let ownerEmail = '';
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', pet.user_id)
    .single();

  if (profile) ownerEmail = profile.email;

  return res.status(200).json({
    id: pet.id,
    name: pet.name,
    breed: pet.breed,
    birth_date: pet.birth_date,
    weight_kg: pet.weight_kg,
    medical_flags: pet.medical_flags,
    microchip: pet.microchip,
    color: pet.color,
    allergies: pet.allergies,
    medications: pet.medications,
    emergency_contact_name: pet.emergency_contact_name,
    emergency_contact_phone: pet.emergency_contact_phone,
    primary_vet_name: pet.primary_vet_name,
    primary_vet_phone: pet.primary_vet_phone,
    owner_contact: ownerEmail,
  });
}
