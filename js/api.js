/* ========================================
   Wagr — API Layer (Supabase SDK)
   ======================================== */

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1g-ma3Dim52nx6W7b15ZKg_qPRXBZl5';

// Paystack public key (required for inline checkout UI) - safe to expose
const PAYSTACK_PUBLIC_KEY = 'pk_live_396136bd41056ad903beb4a1639d80fd5c31d179';

// API base URL for serverless functions
// Uses current origin - works in dev and production
const API_BASE = window.location.origin + '/api';

/* Use a different name to avoid shadowing the CDN's window.supabase global */
let supabaseClient = null;

function initSupabase() {
  if (supabaseClient) return supabaseClient;

  try {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase client initialized successfully');
    } else {
      console.error('Supabase SDK not found on window.supabase. Check CDN script tag.');
    }
  } catch (err) {
    console.error('Failed to initialize Supabase:', err);
  }

  return supabaseClient;
}

/* Convenience getter */
function db() {
  if (!supabaseClient) initSupabase();
  if (!supabaseClient) throw new Error('Supabase client not initialized. Make sure the Supabase SDK script tag loads correctly.');
  return supabaseClient;
}

/* --- Auth --- */
async function signUp(email, password) {
  const { data, error } = await db().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await db().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await db().auth.signOut();
  if (error) throw error;
  localStorage.removeItem('houndos_user');
  localStorage.removeItem('houndos_pets');
  localStorage.removeItem('houndos_logs');
}

async function getCurrentUser() {
  try {
    const { data: { session }, error } = await db().auth.getSession();
    if (error) {
      console.error('Session error:', error);
      return null;
    }
    if (!session) return null;
    return session.user;
  } catch (e) {
    console.error('getCurrentUser error:', e);
    return null;
  }
}

async function getSession() {
  const { data: { session } } = await db().auth.getSession();
  return session;
}

/* --- Profiles --- */
async function getProfile(userId) {
  const { data, error } = await db()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function updateProfile(userId, updates) {
  const { data, error } = await db()
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* --- Pets --- */
async function getPets(userId) {
  const { data, error } = await db()
    .from('pets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function addPet(pet) {
  const { data, error } = await db()
    .from('pets')
    .insert(pet)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updatePet(petId, updates) {
  const { data, error } = await db()
    .from('pets')
    .update(updates)
    .eq('id', petId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deletePet(petId) {
  const { error } = await db()
    .from('pets')
    .delete()
    .eq('id', petId);
  if (error) throw error;
}

/* --- Logs --- */
async function getLogs(petId, limit = 50, lookbackDays = null) {
  let query = db()
    .from('pet_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (lookbackDays) {
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', since);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function addLog(log) {
  const { data, error } = await db()
    .from('pet_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteLog(logId) {
  const { error } = await db()
    .from('pet_logs')
    .delete()
    .eq('id', logId);
  if (error) throw error;
}

/* --- Food Logs --- */
async function getFoodLogs(petId, limit = 50) {
  const { data, error } = await db()
    .from('food_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('fed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addFoodLog(foodLog) {
  const { data, error } = await db()
    .from('food_logs')
    .insert(foodLog)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateFoodLog(foodLogId, updates) {
  const { data, error } = await db()
    .from('food_logs')
    .update(updates)
    .eq('id', foodLogId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteFoodLog(foodLogId) {
  const { error } = await db()
    .from('food_logs')
    .delete()
    .eq('id', foodLogId);
  if (error) throw error;
}

/* --- Nutritional Analysis --- */
async function analyzeNutrition(foodData) {
  // Simulated nutritional analysis - in a real app, this would call an API
  const { food_type, portion_size, portion_unit, ingredients, brand_name, product_name } = foodData;
  
  // Default nutritional values based on food type
  const nutritionalProfiles = {
    commercial: {
      protein: 25,
      fat: 15,
      fiber: 4,
      carbs: 50,
      moisture: 6
    },
    homemade: {
      protein: 18,
      fat: 12,
      fiber: 2,
      carbs: 65,
      moisture: 3
    },
    raw: {
      protein: 35,
      fat: 25,
      fiber: 2,
      carbs: 30,
      moisture: 8
    },
    treat: {
      protein: 20,
      fat: 10,
      fiber: 3,
      carbs: 62,
      moisture: 5
    },
    supplement: {
      protein: 30,
      fat: 5,
      fiber: 1,
      carbs: 55,
      moisture: 9
    }
  };
  
  const profile = nutritionalProfiles[food_type] || nutritionalProfiles.commercial;
  
  // Calculate calories based on food type and portion
  const caloriesPerCup = food_type === 'commercial' ? 350 : food_type === 'raw' ? 400 : 300;
  
  // If ingredients are provided, try to make a more accurate estimation
  let adjustedProfile = { ...profile };
  if (ingredients) {
    // Simple keyword-based adjustments
    if (ingredients.toLowerCase().includes('chicken') || ingredients.toLowerCase().includes('beef')) {
      adjustedProfile.protein += 5;
      adjustedProfile.fat += 3;
    }
    if (ingredients.toLowerCase().includes('rice') || ingredients.toLowerCase().includes('potato')) {
      adjustedProfile.carbs += 5;
      adjustedProfile.protein -= 2;
    }
    if (ingredients.toLowerCase().includes('vegetable') || ingredients.toLowerCase().includes('carrot')) {
      adjustedProfile.fiber += 2;
      adjustedProfile.carbs -= 2;
    }
  }
  
  // Normalize percentages
  const total = adjustedProfile.protein + adjustedProfile.fat + adjustedProfile.fiber + adjustedProfile.carbs + adjustedProfile.moisture;
  adjustedProfile.protein = Math.round((adjustedProfile.protein / total) * 100);
  adjustedProfile.fat = Math.round((adjustedProfile.fat / total) * 100);
  adjustedProfile.fiber = Math.round((adjustedProfile.fiber / total) * 100);
  adjustedProfile.carbs = Math.round((adjustedProfile.carbs / total) * 100);
  adjustedProfile.moisture = Math.round((adjustedProfile.moisture / total) * 100);
  
  return {
    ...foodData,
    calories_per_cup,
    protein_percentage: adjustedProfile.protein,
    fat_percentage: adjustedProfile.fat,
    fiber_percentage: adjustedProfile.fiber,
    carbs_percentage: adjustedProfile.carbs,
    moisture_percentage: adjustedProfile.moisture,
    nutritional_analyzed: true,
    analysis_source: 'calculated'
  };
}

async function barcodeLookup(barcode) {
  // Simulated barcode lookup - in a real app, this would call a product database API
  // For demo purposes, return some sample data
  const mockDatabase = {
    '123456789012': {
      brand_name: 'Premium Pet Co',
      product_name: 'Healthy Kibble Chicken & Rice',
      food_type: 'commercial',
      calories_per_cup: 350,
      protein_percentage: 25,
      fat_percentage: 15,
      fiber_percentage: 4,
      carbs_percentage: 50,
      moisture_percentage: 6
    },
    '234567890123': {
      brand_name: 'Natural Pets',
      product_name: 'Organic Beef Recipe',
      food_type: 'commercial',
      calories_per_cup: 380,
      protein_percentage: 28,
      fat_percentage: 18,
      fiber_percentage: 3,
      carbs_percentage: 45,
      moisture_percentage: 6
    }
  };
  
  return mockDatabase[barcode] || null;
}

/* --- Public Pet Profile (View) --- */
async function getPublicPetProfile(petId) {
  // Try SECURITY DEFINER function first (works for anonymous QR scanners)
  try {
    const { data, error } = await db().rpc('get_public_pet_profile', { pet_id: petId });
    if (!error && data && data.length > 0) return data[0];
  } catch (e) { /* function may not exist yet, fall through */ }

  // Fallback: try the public view
  try {
    const { data, error } = await db()
      .from('vw_public_pet_profiles')
      .select('*')
      .eq('id', petId)
      .single();
    if (!error && data) return data;
  } catch (e) { /* view may not exist yet, fall through */ }

  // Last resort: query the public_pet_profiles table (publicly readable by RLS)
  try {
    const { data, error } = await db()
      .from('public_pet_profiles')
      .select('pet_id as id, display_name as name, breed, medical_flags, owner_contact')
      .eq('pet_id', petId)
      .single();
    if (!error && data) return data;
  } catch (e) { /* table fallback failed */ }

  throw new Error('Pet profile not found');
}

/* --- Sitter Token (Custom Hash) --- */
function generateHash() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 32; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
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
  const { data, error } = await db()
    .from('pet_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* --- AI Vet Report (Pro) --- */
async function generateVetReport(petId, options = {}) {
  const {
    includeTimeline = true,
    includeFood = true,
    includeGI = true,
    includeCardio = true,
    includeTests = true,
    includeDerma = true,
    includeGrooming = true,
    days = 30
  } = options;

  let reportSections = [];

  // Fetch data based on options
  if (includeTimeline) {
    const logs = await getLogs(petId, 100);
    const filtered = logs.filter(l => {
      const d = new Date(l.created_at);
      return (Date.now() - d.getTime()) / (1000*60*60*24) <= days;
    });
    if (filtered.length) {
      reportSections.push('## 📋 Timeline (Meals, Meds, Bathroom)\n' + 
        filtered.map(l => `- [${new Date(l.created_at).toLocaleDateString()}] ${l.log_type}: ${l.title}${l.notes ? ' — ' + l.notes : ''}`).join('\n')
      );
    }
  }

  if (includeFood) {
    const foodLogs = await getFoodLogs(petId, 100);
    const filtered = foodLogs.filter(l => {
      const d = new Date(l.fed_at);
      return (Date.now() - d.getTime()) / (1000*60*60*24) <= days;
    });
    if (filtered.length) {
      reportSections.push('## 🍖 Food Log\n' + 
        filtered.map(l => `- [${new Date(l.fed_at).toLocaleDateString()}] ${l.food_type}: ${l.brand_name || ''} ${l.product_name || ''} — ${l.portion_size} ${l.portion_unit}${l.calories_per_cup ? ` (${l.calories_per_cup} kcal/cup)` : ''}`).join('\n')
      );
    }
  }

  if (includeGI) {
    const giLogs = await getGiLogs(petId, 100);
    const filtered = giLogs.filter(l => {
      const d = new Date(l.recorded_at);
      return (Date.now() - d.getTime()) / (1000*60*60*24) <= days;
    });
    if (filtered.length) {
      reportSections.push('## 🤢 GI (Vomit/Feces)\n' + 
        filtered.map(l => `- [${new Date(l.recorded_at).toLocaleDateString()}] ${l.log_type} — ${l.consistency || 'normal'} ${l.color ? '(' + l.color + ')' : ''}${l.notes ? ' — ' + l.notes : ''}`).join('\n')
      );
    }
  }

  if (includeCardio) {
    const cardioLogs = await getCardioLogs(petId, 100);
    const filtered = cardioLogs.filter(l => {
      const d = new Date(l.recorded_at);
      return (Date.now() - d.getTime()) / (1000*60*60*24) <= days;
    });
    if (filtered.length) {
      reportSections.push('## ❤️ Cardiology (Respiratory Rate)\n' + 
        filtered.map(l => `- [${new Date(l.recorded_at).toLocaleDateString()}] ${l.respiratory_rate} bpm (${l.position}, ${l.effort})${l.notes ? ' — ' + l.notes : ''}`).join('\n')
      );
    }
  }

  if (includeTests) {
    const testResults = await getTestResults(petId, 50);
    const filtered = testResults.filter(l => {
      const d = new Date(l.test_date);
      return (Date.now() - d.getTime()) / (1000*60*60*24) <= days;
    });
    if (filtered.length) {
      reportSections.push('## 🧪 Test Results\n' + 
        filtered.map(l => `- [${l.test_date}] ${l.test_name} — ${l.diagnosis || 'pending'}${l.veterinarian ? ' (Vet: ' + l.veterinarian + ')' : ''}`).join('\n')
      );
    }
  }

  if (includeDerma) {
    const dermaLogs = await getDermaLogs(petId, 50);
    const filtered = dermaLogs.filter(l => {
      const d = new Date(l.recorded_at);
      return (Date.now() - d.getTime()) / (1000*60*60*24) <= days;
    });
    if (filtered.length) {
      reportSections.push('## 🩹 Dermatology (Skin Issues)\n' + 
        filtered.map(l => `- [${new Date(l.recorded_at).toLocaleDateString()}] ${l.issue_type} — ${l.severity} at ${l.location || 'unspecified'}${l.description ? ' — ' + l.description : ''}`).join('\n')
      );
    }
  }

  if (includeGrooming) {
    const groomingLogs = await getGroomingAppointments(petId, 50);
    const filtered = groomingLogs.filter(l => {
      const d = new Date(l.appointment_date);
      return (Date.now() - d.getTime()) / (1000*60*60*24) <= days;
    });
    if (filtered.length) {
      reportSections.push('## ✂️ Grooming\n' + 
        filtered.map(l => `- [${new Date(l.appointment_date).toLocaleDateString()}] ${l.groomer_name || 'N/A'} at ${l.location || 'N/A'} — ${l.services_performed?.join(', ') || 'services recorded'}${l.notes ? ' — ' + l.notes : ''}`).join('\n')
      );
    }
  }

  if (reportSections.length === 0) {
    throw new Error('No data available for the selected period. Add some logs first!');
  }

  const fullReport = `## Pet Health Report (Last ${days} days)\n\n${reportSections.join('\n\n')}`;

  // Serverless function call (keeps API key secure)
  const response = await fetch(`${API_BASE}/ai-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logSummary: fullReport })
  });

  if (response.ok) {
    const result = await response.json();
    return result.report;
  }

  const err = await response.json().catch(() => ({}));
  throw new Error(err.error || 'AI service unavailable. Please try again later.');
}

/* --- Location Alert --- */
async function sendLocationAlert(petId, lat, lng, ownerEmail, petName) {
  try {
    let email = ownerEmail;
    let name = petName || 'your pet';

    // If email not provided, try to look it up (works when user is signed in)
    if (!email) {
      const { data: pet } = await db()
        .from('pets')
        .select('name, user_id')
        .eq('id', petId)
        .single();
      if (pet) {
        if (!name) name = pet.name || 'your pet';
        const { data: owner } = await db()
          .from('profiles')
          .select('email')
          .eq('id', pet.user_id)
          .single();
        if (owner) email = owner.email;
      }
    }

    if (email) {
      const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
      try {
        await fetch(`${window.location.origin}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'location_alert',
            to: email,
            petName: name,
            link: mapsLink,
            message: `Someone scanned ${name}'s QR tag and shared their location.\nLatitude: ${lat}\nLongitude: ${lng}`,
          }),
        });
        return { success: true, message: 'Owner notified' };
      } catch (e) {
        console.log('Email alert fallback:', e.message);
      }
    }
    return { success: true, message: 'Owner notified (demo mode)' };
  } catch (e) {
    console.log('Location alert (demo mode):', petId, lat, lng);
    return { success: true, message: 'Owner notified (demo mode)' };
  }
}

/* --- Paystack Checkout --- */
async function openPaystackCheckout(email, plan, onSuccess) {
  const user = AppState.user;
  if (!user) {
    showToast('Please sign in to upgrade.', 'error');
    return;
  }

  showToast('Initializing payment...', 'info');

  // Try serverless function first
  try {
    const response = await fetch(`${API_BASE}/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan, userId: user.id })
    });

    if (response.ok) {
      const result = await response.json();
      window.location.href = result.authorization_url;
      return;
    }
  } catch (err) {
    console.log('Serverless not available, using direct Paystack');
  }

  // Fallback: Direct Paystack checkout (for local dev)
  if (typeof PaystackPop === 'undefined') {
    showToast('Payment system loading. Please try again.', 'error');
    return;
  }

  const planCodes = {
    basic_monthly: 'PLN_basic_monthly',
    basic_yearly: 'PLN_basic_yearly',
    family_monthly: 'PLN_family_monthly',
    family_yearly: 'PLN_family_yearly',
    pro_monthly: 'PLN_eq0p1x8wigfj00t',
    pro_yearly: 'PLN_3rsutm4lknn9lik'
  };

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email,
    plan: planCodes[plan] || plan,
    callback: function(response) {
      if (onSuccess) onSuccess(response);
    },
    onClose: function() {}
  });
  handler.openIframe();
}

/* --- GI Logs (Vomit/Feces) --- */
async function getGiLogs(petId, limit = 50) {
  const { data, error } = await db()
    .from('gi_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addGiLog(log) {
  const { data, error } = await db()
    .from('gi_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateGiLog(logId, updates) {
  const { data, error } = await db()
    .from('gi_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteGiLog(logId) {
  const { error } = await db()
    .from('gi_logs')
    .delete()
    .eq('id', logId);
  if (error) throw error;
}

/* --- Cardiology Logs (Respiratory Rate) --- */
async function getCardioLogs(petId, limit = 50) {
  const { data, error } = await db()
    .from('cardio_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addCardioLog(log) {
  const { data, error } = await db()
    .from('cardio_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateCardioLog(logId, updates) {
  const { data, error } = await db()
    .from('cardio_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteCardioLog(logId) {
  const { error } = await db()
    .from('cardio_logs')
    .delete()
    .eq('id', logId);
  if (error) throw error;
}

/* --- Test Results --- */
async function getTestResults(petId, limit = 50) {
  const { data, error } = await db()
    .from('test_results')
    .select('*')
    .eq('pet_id', petId)
    .order('test_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addTestResult(result) {
  const { data, error } = await db()
    .from('test_results')
    .insert(result)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateTestResult(resultId, updates) {
  const { data, error } = await db()
    .from('test_results')
    .update(updates)
    .eq('id', resultId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTestResult(resultId) {
  const { error } = await db()
    .from('test_results')
    .delete()
    .eq('id', resultId);
  if (error) throw error;
}

/* --- Dermatology Logs --- */
async function getDermaLogs(petId, limit = 50) {
  const { data, error } = await db()
    .from('derma_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addDermaLog(log) {
  const { data, error } = await db()
    .from('derma_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateDermaLog(logId, updates) {
  const { data, error } = await db()
    .from('derma_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteDermaLog(logId) {
  const { error } = await db()
    .from('derma_logs')
    .delete()
    .eq('id', logId);
  if (error) throw error;
}

/* --- Generate Symptom Report for Vet --- */
async function generateSymptomReport(petId, startDate, endDate) {
  const pet = await db().from('pets').select('*').eq('id', petId).single();
  const giLogs = await getGiLogs(petId);
  const cardioLogs = await getCardioLogs(petId);
  const testResults = await getTestResults(petId);
  const dermaLogs = await getDermaLogs(petId);

  let report = `# Symptom Report for ${pet.data.name}\n`;
  report += `**Breed:** ${pet.data.breed || 'Not specified'}\n`;
  report += `**Date Range:** ${startDate} to ${endDate}\n\n`;

  if (giLogs.length > 0) {
    report += `## GI Tracking (Vomit/Feces)\n`;
    giLogs.forEach(log => {
      report += `- **${log.log_type}** - ${log.consistency || ''} ${log.color || ''}\n`;
      report += `  Date: ${new Date(log.recorded_at).toLocaleDateString()}\n`;
      if (log.notes) report += `  Notes: ${log.notes}\n`;
    });
    report += '\n';
  }

  if (cardioLogs.length > 0) {
    report += `## Cardiology (Respiratory Rate)\n`;
    cardioLogs.forEach(log => {
      report += `- **${log.respiratory_rate} breaths/min** - ${log.position || ''} ${log.effort || ''}\n`;
      report += `  Date: ${new Date(log.recorded_at).toLocaleDateString()}\n`;
      if (log.notes) report += `  Notes: ${log.notes}\n`;
    });
    report += '\n';
  }

  if (testResults.length > 0) {
    report += `## Test Results\n`;
    testResults.forEach(r => {
      report += `- **${r.test_name}** - ${r.test_date}\n`;
      if (r.diagnosis) report += `  Diagnosis: ${r.diagnosis}\n`;
      if (r.veterinarian) report += `  Vet: ${r.veterinarian}\n`;
    });
    report += '\n';
  }

  if (dermaLogs.length > 0) {
    report += `## Dermatology (Skin Issues)\n`;
    dermaLogs.forEach(log => {
      report += `- **${log.issue_type}** - ${log.severity} - ${log.location || ''}\n`;
      report += `  Date: ${new Date(log.recorded_at).toLocaleDateString()}\n`;
      if (log.description) report += `  Description: ${log.description}\n`;
    });
    report += '\n';
  }

  return report;
}

/* --- Grooming Appointments --- */
async function getGroomingAppointments(petId, limit = 50) {
  const { data, error } = await db()
    .from('grooming_appointments')
    .select('*')
    .eq('pet_id', petId)
    .order('appointment_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function addGroomingAppointment(appointment) {
  const { data, error } = await db()
    .from('grooming_appointments')
    .insert(appointment)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateGroomingAppointment(id, updates) {
  const { data, error } = await db()
    .from('grooming_appointments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteGroomingAppointment(id) {
  const { error } = await db()
    .from('grooming_appointments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/* --- Care Plans for Pet Sitters --- */
async function getCarePlans(petId, activeOnly = true) {
  let query = db()
    .from('care_plans')
    .select('*')
    .eq('pet_id', petId)
    .order('start_date', { ascending: false });
  
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  
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
  
  // Generate shareable link
  const shareUrl = `${window.location.origin}/sitter?plan=${planId}`;
  
  // Format email content
  const emailSubject = `Pet Care Instructions for ${pet.data.name} - ${plan.start_date} to ${plan.end_date}`;
  const emailBody = `Hi ${plan.sitter_name},

Here are the care instructions for ${pet.data.name} (${pet.data.breed || 'dog'}) from ${plan.start_date} to ${plan.end_date}.

FEEDING:
${plan.feeding_instructions || 'See timeline for feeding schedule'}

MEDICATION:
${plan.medication_instructions || 'No medications'}

WALKING/EXERCISE:
${plan.walking_exercise || 'As usual'}

BEHAVIORAL NOTES:
${plan.behavioral_notes || 'None'}

EMERGENCY CONTACT:
${plan.emergency_contact || 'See profile'}

VET INFO:
${plan.vet_info || 'See profile'}

ADDITIONAL NOTES:
${plan.additional_notes || 'None'}

View full details and timeline: ${shareUrl}

Best regards`;

  return {
    shareUrl,
    emailSubject,
    emailBody,
    sitterEmail: plan.sitter_email,
    sitterName: plan.sitter_name
  };
}

/* --- Support Tickets --- */
async function createSupportTicket(ticket) {
  const { data, error } = await db()
    .from('support_tickets')
    .insert(ticket)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getUserTickets(userId) {
  const { data, error } = await db()
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getTicket(ticketId) {
  const { data, error } = await db()
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();
  if (error) throw error;
  return data;
}

async function getAllTickets() {
  const { data, error } = await db()
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function updateTicketStatus(ticketId, status, response, adminId) {
  const updates = { status };
  if (response) {
    updates.admin_response = response;
    updates.admin_responded_at = new Date().toISOString();
    updates.admin_id = adminId;
    updates.status = 'in_progress';
  }
  const { data, error } = await db()
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function closeTicket(ticketId) {
  const { data, error } = await db()
    .from('support_tickets')
    .update({ status: 'closed' })
    .eq('id', ticketId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* --- Co-parents --- */

async function createCoparentInvite(petId) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Not authenticated');
  const res = await fetch(API_BASE + '/create-coparent-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
    body: JSON.stringify({ petId }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Server error: endpoint not reachable (deploy API files to Vercel)'); }
  if (!res.ok) throw new Error(data.error || 'Failed to create invite');
  return data;
}

async function acceptCoparentInvite(token) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Not authenticated');
  const res = await fetch(API_BASE + '/accept-coparent-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
    body: JSON.stringify({ token }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Server error: endpoint not reachable (deploy API files to Vercel)'); }
  if (!res.ok) throw new Error(data.error || 'Failed to accept invite');
  return data;
}

async function getCoparents(petId) {
  const { data, error } = await db()
    .from('co_parents')
    .select('id, user_id, created_at, invited_by')
    .eq('pet_id', petId);
  if (error) throw error;
  if (!data || data.length === 0) return [];
  const userIds = [...new Set(data.map(c => c.user_id))];
  const { data: profiles } = await db()
    .from('profiles')
    .select('id, email')
    .in('id', userIds);
  const emailMap = {};
  if (profiles) profiles.forEach(p => { emailMap[p.id] = p.email; });
  return data.map(c => ({ ...c, email: emailMap[c.user_id] || null }));
}

async function removeCoparent(petId, userId) {
  const { error } = await db()
    .from('co_parents')
    .delete()
    .eq('pet_id', petId)
    .eq('user_id', userId);
  if (error) throw error;
}

async function getCoparentPets(userId) {
  const { data, error } = await db()
    .from('co_parents')
    .select('pet_id, pets!co_parents_pet_id_fkey(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(r => r.pets).filter(Boolean);
}

/* --- Helper: get current access token --- */
async function getAccessToken() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session?.access_token || '';
  } catch {
    return '';
  }
}

/* --- Account Management --- */

async function sendPasswordResetEmail(email) {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/auth',
  });
  if (error) throw error;
}

async function updateEmail(newEmail) {
  const { data, error } = await supabaseClient.auth.updateUser({ email: newEmail });
  if (error) throw error;
  return data;
}

async function updatePassword(newPassword) {
  const { data, error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

async function reauthenticateUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function getPaymentHistory(userId) {
  const { data, error } = await db()
    .from('payment_history')
    .select('*')
    .eq('user_id', userId)
    .order('paid_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

async function updateNotificationPreferences(userId, prefs) {
  const { data, error } = await db()
    .from('profiles')
    .update({ notification_preferences: prefs, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}