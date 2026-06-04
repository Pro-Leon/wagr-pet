const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1g-ma3Dim52nx6W7b15ZKg_qPRXBZl5';
const PAYSTACK_PUBLIC_KEY = 'pk_live_396136bd41056ad903beb4a1639d80fd5c31d179';
const API_BASE = window.location.origin + '/api';

let supabaseClient = null;

function initSupabase() {
  if (supabaseClient) return supabaseClient;
  try {
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
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

function db() {
  if (!supabaseClient) initSupabase();
  if (!supabaseClient) throw new Error('Supabase client not initialized. Make sure the Supabase SDK script tag loads correctly.');
  return supabaseClient;
}

function waitForSupabase() {
  return new Promise(function (resolve) {
    (function poll(attempt) {
      if (supabaseClient) return resolve(supabaseClient);
      try {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
          supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          if (supabaseClient) return resolve(supabaseClient);
        }
      } catch (e) {}
      if (attempt >= 30) return resolve(null);
      setTimeout(function () { poll(attempt + 1); }, 200);
    })(0);
  });
}

(function autoInit(retries) {
  if (retries === void 0) retries = 0;
  try {
    if (!supabaseClient && typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase client initialized successfully via autoInit');
      return;
    }
  } catch (err) {
    console.warn('autoInit attempt ' + (retries + 1) + ' failed:', err);
  }
  if (!supabaseClient && retries < 30) {
    setTimeout(function () { autoInit(retries + 1); }, 200);
  } else if (!supabaseClient) {
    console.log('autoInit will keep retrying via waitForSupabase calls');
  }
})();

/* --- Auth --- */
async function signUp(email, password) {
  var client = await waitForSupabase();
  if (!client) throw new Error('Supabase client not initialized.');
  var result = await client.auth.signUp({ email: email, password: password });
  if (result.error) throw result.error;
  return result.data;
}

async function signIn(email, password) {
  var client = await waitForSupabase();
  if (!client) throw new Error('Supabase client not initialized.');
  var result = await client.auth.signInWithPassword({ email: email, password: password });
  if (result.error) throw result.error;
  return result.data;
}

async function signOut() {
  var client = await waitForSupabase();
  if (!client) throw new Error('Supabase client not initialized.');
  var result = await client.auth.signOut();
  if (result.error) throw result.error;
  localStorage.removeItem('pupfile_user');
  localStorage.removeItem('pupfile_pets');
  localStorage.removeItem('pupfile_logs');
}

async function getCurrentUser() {
  try {
    var client = await waitForSupabase();
    if (!client) return null;
    var sessionResult = await client.auth.getSession();
    if (sessionResult.error) {
      console.error('Session error:', sessionResult.error);
      return null;
    }
    if (!sessionResult.data.session) return null;
    return sessionResult.data.session.user;
  } catch (e) {
    console.error('getCurrentUser error:', e);
    return null;
  }
}

async function getSession() {
  var client = await waitForSupabase();
  if (!client) return null;
  var sessionResult = await client.auth.getSession();
  return sessionResult.data.session || null;
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
