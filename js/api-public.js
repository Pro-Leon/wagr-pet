/* --- Public Pet Profile (View) --- */
async function getPublicPetProfile(petId) {
  try {
    const { data, error } = await db().rpc('get_public_pet_profile', { pet_id: petId });
    if (!error && data && data.length > 0) return data[0];
  } catch (e) {}
  try {
    const { data, error } = await db()
      .from('vw_public_pet_profiles')
      .select('*')
      .eq('id', petId)
      .single();
    if (!error && data) return data;
  } catch (e) {}
  try {
    const { data, error } = await db()
      .from('public_pet_profiles')
      .select('pet_id as id, display_name as name, breed, medical_flags, owner_contact')
      .eq('pet_id', petId)
      .single();
    if (!error && data) return data;
  } catch (e) {}
  // Fallback: direct pets + profiles query
  try {
    const { data: pet, error: petErr } = await db()
      .from('pets')
      .select('id, name, breed, birth_date, weight_kg, medical_flags, microchip, color, allergies, medications, emergency_contact_name, emergency_contact_phone, primary_vet_name, primary_vet_phone, user_id')
      .eq('id', petId)
      .single();
    if (!petErr && pet) {
      const { data: profile } = await db()
        .from('profiles')
        .select('email')
        .eq('id', pet.user_id)
        .single();
      return { id: pet.id, name: pet.name, breed: pet.breed, medical_flags: pet.medical_flags, microchip: pet.microchip, allergies: pet.allergies, medications: pet.medications, emergency_contact_name: pet.emergency_contact_name, emergency_contact_phone: pet.emergency_contact_phone, primary_vet_name: pet.primary_vet_name, primary_vet_phone: pet.primary_vet_phone, owner_contact: profile?.email || '' };
    }
  } catch (e) {}
  throw new Error('Pet profile not found');
}

/* --- Sitter Token (Custom Hash) --- */
function generateHash() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  let hash = '';
  for (let i = 0; i < 32; i++) {
    hash += chars.charAt(array[i] % chars.length);
  }
  return hash;
}

async function createSitterToken(petId) {
  const token = generateHash();
  const { data, error } = await db()
    .from('pets')
    .update({ sitter_token: token })
    .eq('id', petId)
    .select()
    .single();
  if (error) throw error;
  return token;
}

async function verifySitterToken(token) {
  const { data, error } = await db()
    .from('pets')
    .select('id, name, breed, medical_flags, user_id')
    .eq('sitter_token', token)
    .single();
  if (error) return null;
  return data;
}

async function addSitterLog(log) {
  const sitterToken = localStorage.getItem('pupfile_sitter_token');
  if (!sitterToken) throw new Error('No sitter token');
  const res = await fetch(window.location.origin + '/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'log', petId: log.pet_id, token: sitterToken,
      log_type: log.log_type, title: log.title, notes: log.notes, sitter_name: log.sitter_name,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create log');
  return data.log;
}

/* --- Sitter Links (new multi-step system) --- */
async function createSitterLink(petId, sitterName, label, duration, durationUnit, carePlanId) {
  const token = await getAccessToken();
  const res = await fetch(API_BASE + '/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ action: 'create', petId, sitterName, label, duration, durationUnit, carePlanId: carePlanId || null }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create sitter link');
  return data.link;
}

async function listSitterLinks(petId) {
  const token = await getAccessToken();
  const res = await fetch(API_BASE + '/share?action=list&petId=' + encodeURIComponent(petId), {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load sitter links');
  return data.links || [];
}

async function revokeSitterLink(linkId) {
  const token = await getAccessToken();
  const res = await fetch(API_BASE + '/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ action: 'revoke', linkId }),
  });
  if (!res.ok) throw new Error('Failed to revoke sitter link');
}

/* --- Care Plan Notifications --- */
async function getCarePlanNotifications(petId) {
  const plans = await getCarePlans(petId, true);
  if (!plans.length) return [];
  const now = new Date();
  const activePlan = plans.find(p => {
    const start = new Date(p.start_date);
    const end = new Date(p.end_date);
    return start <= now && end >= now;
  }) || plans[0];
  if (!activePlan) return [];
  const notifications = [];
  const thirtySixHoursAgo = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs } = await db()
    .from('pet_logs')
    .select('log_type, title, created_at')
    .eq('pet_id', petId)
    .gte('created_at', thirtySixHoursAgo)
    .order('created_at', { ascending: false })
    .limit(50);
  const logs = recentLogs || [];
  const todayStr = now.toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.created_at.startsWith(todayStr));
  if (activePlan.feeding_instructions) {
    const mealCount = todayLogs.filter(l => l.log_type === 'meal').length;
    if (mealCount === 0 && activePlan.feeding_instructions.toLowerCase().includes('feed')) {
      notifications.push({ type: 'feeding', icon: 'utensils-crossed', title: 'Feeding due', message: 'No meals logged today. Care plan has feeding instructions.' });
    }
  }
  if (activePlan.medication_instructions) {
    const medCount = todayLogs.filter(l => l.log_type === 'medication').length;
    if (medCount === 0) {
      notifications.push({ type: 'medication', icon: 'pill', title: 'Medication reminder', message: 'No medications logged today. Check the care plan for instructions.' });
    }
  }
  if (activePlan.walking_exercise) {
    const walkCount = todayLogs.filter(l => l.log_type === 'bathroom').length;
    if (walkCount === 0) {
      notifications.push({ type: 'exercise', icon: 'footprints', title: 'Exercise reminder', message: 'No walks logged today. Care plan includes exercise instructions.' });
    }
  }
  return notifications;
}

/* --- Care Plans for Pet Sitters --- */
async function getCarePlans(petId, activeOnly = true) {
  let query = db()
    .from('care_plans')
    .select('*')
    .eq('pet_id', petId)
    .order('start_date', { ascending: false });
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getCarePlan(planId) {
  const { data, error } = await db()
    .from('care_plans')
    .select('*')
    .eq('id', planId)
    .single();
  if (error) throw error;
  return data;
}

async function createCarePlan(plan) {
  const { data, error } = await db()
    .from('care_plans')
    .insert(plan)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateCarePlan(planId, updates) {
  const { data, error } = await db()
    .from('care_plans')
    .update(updates)
    .eq('id', planId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteCarePlan(planId) {
  const { error } = await db()
    .from('care_plans')
    .delete()
    .eq('id', planId);
  if (error) throw error;
}

async function shareCarePlan(planId) {
  const plan = await getCarePlan(planId);
  const pet = await db().from('pets').select('name, breed, medical_flags').eq('id', plan.pet_id).single();
  const shareUrl = `${window.location.origin}/sitter?plan=${planId}`;
  const emailSubject = `Pet Care Instructions for ${pet.data.name} - ${plan.start_date} to ${plan.end_date}`;
  const emailBody = `Hi ${plan.sitter_name},
Here are the care instructions for ${pet.data.name} (${pet.data.breed || 'dog'}) from ${plan.start_date} to ${plan.end_date}.
FEEDING: ${plan.feeding_instructions || 'See timeline for feeding schedule'}
MEDICATION: ${plan.medication_instructions || 'No medications'}
WALKING/EXERCISE: ${plan.walking_exercise || 'As usual'}
BEHAVIORAL NOTES: ${plan.behavioral_notes || 'None'}
EMERGENCY CONTACT: ${plan.emergency_contact || 'See profile'}
VET INFO: ${plan.vet_info || 'See profile'}
ADDITIONAL NOTES: ${plan.additional_notes || 'None'}
View full details and timeline: ${shareUrl}
Best regards`;
  return { shareUrl, emailSubject, emailBody, sitterEmail: plan.sitter_email, sitterName: plan.sitter_name };
}
