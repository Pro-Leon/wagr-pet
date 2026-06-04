/* --- Helper: get current access token --- */
async function getAccessToken() {
  try {
    var client = await waitForSupabase();
    if (!client) return '';
    var sessionResult = await client.auth.getSession();
    return sessionResult.data.session?.access_token || '';
  } catch {
    return '';
  }
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
  const res = await fetch(API_BASE + '/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
    body: JSON.stringify({ action: 'coparent_create', petId }),
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
  const res = await fetch(API_BASE + '/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
    body: JSON.stringify({ action: 'coparent_accept', token }),
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
  const { data: entries, error: entriesErr } = await db()
    .from('co_parents')
    .select('pet_id')
    .eq('user_id', userId);
  if (entriesErr) throw entriesErr;
  if (!entries || entries.length === 0) return [];
  const petIds = entries.map(e => e.pet_id);
  const { data: pets, error: petsErr } = await db()
    .from('pets')
    .select('*')
    .in('id', petIds);
  if (petsErr) throw petsErr;
  return pets || [];
}

/* --- Paystack Checkout --- */
async function openPaystackCheckout(email, plan, onSuccess) {
  const user = AppState.user;
  if (!user) { showToast('Please sign in to upgrade.', 'error'); return; }
  showToast('Initializing payment...', 'info');
  const isYearly = plan.endsWith('_yearly');
  localStorage.setItem('pupfile_pending_upgrade', JSON.stringify({ plan, tier: plan.split('_')[0], email, isYearly }));
  try {
    const response = await fetch(`${API_BASE}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_subscription', email, plan, userId: user.id })
    });
    if (response.ok) { const result = await response.json(); window.location.href = result.authorization_url; return; }
  } catch (err) { console.log('Serverless not available, using direct Paystack'); }
  if (typeof PaystackPop === 'undefined') { showToast('Payment system loading. Please try again.', 'error'); return; }
  const planCodes = {
    basic_monthly: 'PLN_x7yn9h54irimq96', basic_yearly: 'PLN_omjluu4cllyzgyd',
    family_monthly: 'PLN_38n01fa6kxbk9vn', family_yearly: 'PLN_3r0edwfqim3uixw'
  };
  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY, email: email, plan: planCodes[plan] || plan, currency: 'USD',
    callback: function(response) { if (onSuccess) onSuccess(response); },
    onClose: function() {}
  });
  handler.openIframe();
}

function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const trxref = params.get('trxref');
  const reference = params.get('reference');
  if (!trxref && !reference) return;
  if (history.replaceState) {
    const url = new URL(window.location);
    url.searchParams.delete('trxref'); url.searchParams.delete('reference');
    window.history.replaceState({}, '', url);
  }
  const pending = localStorage.getItem('pupfile_pending_upgrade');
  if (pending) {
    try {
      const { tier, isYearly } = JSON.parse(pending);
      window.isYearlyPricing = isYearly === true;
      showToast('Payment submitted! Verifying upgrade...', 'info');
      if (typeof pollForTierUpgrade === 'function') pollForTierUpgrade(tier);
    } catch (e) {}
    localStorage.removeItem('pupfile_pending_upgrade');
  }
}

/* --- Food Inventory --- */
async function getFoodInventory(petId) {
  const { data, error } = await db()
    .from('food_inventory')
    .select('*')
    .eq('pet_id', petId)
    .order('estimated_empty_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function addFoodInventory(item) {
  const { data, error } = await db()
    .from('food_inventory')
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateFoodInventory(id, updates) {
  const { data, error } = await db()
    .from('food_inventory')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteFoodInventory(id) {
  const { error } = await db()
    .from('food_inventory')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/* --- Tasks --- */
async function getTasks(petId) {
  const { data, error } = await db()
    .from('tasks')
    .select('*')
    .eq('pet_id', petId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function addTask(task) {
  const { data, error } = await db()
    .from('tasks')
    .insert(task)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateTask(id, updates) {
  const { data, error } = await db()
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteTask(id) {
  const { error } = await db()
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
