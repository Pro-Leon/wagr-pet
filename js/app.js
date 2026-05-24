/* ========================================
   Pup File — AppState Engine
   ======================================== */

const AppState = {
  user: null,
  profile: null,
  activePet: null,
  pets: [],
  logs: [],
  tier: 'starter',
  isSitter: false,
  sitterPetId: null,
  activeTab: 'timeline',
  listeners: {},

  /* --- Subscribe to state changes --- */
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },

  /* --- Emit state change --- */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  },

  /* --- Set User --- */
  setUser(user) {
    this.user = user;
    localStorage.setItem('pupfile_user', JSON.stringify(user));
    this.emit('user:changed', user);
  },

  /* --- Set Profile --- */
  setProfile(profile) {
    this.profile = profile;
    this.tier = profile?.tier || 'starter';
    this.emit('profile:changed', profile);
  },

  /* --- Set Pets --- */
  setPets(pets) {
    this.pets = pets;
    localStorage.setItem('pupfile_pets', JSON.stringify(pets));
    if (!this.activePet && pets.length > 0) {
      this.activePet = pets[0];
    }
    this.emit('pets:changed', pets);
  },

  /* --- Set Active Pet --- */
  setActivePet(pet) {
    this.activePet = pet;
    this.logs = [];
    this.emit('activePet:changed', pet);
  },

  /* --- Set Logs --- */
  setLogs(logs) {
    this.logs = logs;
    this.emit('logs:changed', logs);
  },

  /* --- Set Tier --- */
  setTier(tier) {
    this.tier = tier;
    if (this.profile) {
      this.profile.tier = tier;
    }
    this.emit('tier:changed', tier);
  },

  /* --- Clear All --- */
  clear() {
    this.user = null;
    this.profile = null;
    this.activePet = null;
    this.pets = [];
    this.logs = [];
    this.tier = 'starter';
    this.isSitter = false;
    this.sitterPetId = null;
    localStorage.removeItem('pupfile_user');
    localStorage.removeItem('pupfile_pets');
    localStorage.removeItem('pupfile_logs');
    this.emit('state:cleared');
  },

  /* --- Tier Config --- */
  _tierLevels: { starter: 0, basic: 1, family: 2, pro: 3 },

  /* --- Check Feature Access --- */
  canAccess(feature) {
    const featureTiers = {
      'timeline': 'basic',
      'pet_notes': 'basic',
      'food_log': 'family',
      'qr_passive': 'basic',
      'public_emergency_profile': 'basic',
      'support_tickets': 'basic',
      'food_analysis': 'basic',
      'multiple_pets': 'basic',
      'coparent_sync': 'family',
      'location_alert': 'family',
      'sitter_link': 'family',
      'care_plans': 'family',
      'symptom_tracking': 'family',
      'grooming': 'family',
      'medication_reminders': 'family',
      'feeding_schedules': 'family',
      'chat_assistant': 'basic',
      'ai_report': 'pro',
      'unlimited_coparent': 'pro',
      'sitter_handover_email': 'pro',
      'weight_tracking': 'pro',
      'vet_records': 'pro',
      'heat_cycle': 'pro',
      'multi_pet_overview': 'pro',
      'food_inventory': 'pro',
      'priority_support': 'pro',
      'unlimited_pets': 'pro',
    };
    const required = featureTiers[feature] || 'starter';
    return (this._tierLevels[this.tier] || 0) >= (this._tierLevels[required] || 0);
  },

  canWrite() {
    return ['family', 'pro'].includes(this.tier);
  },

  canAccessTimeline() {
    return this.canAccess('timeline');
  },

  /* --- Timeline lookback days (Starter = 7, paid = unlimited) --- */
  timelineDays() {
    if (this.tier === 'starter') return 7;
    return null;
  },

  /* --- Max Pets --- */
  maxPets() {
    if (this.tier === 'pro') return Infinity;
    if (this.tier === 'family') return 4;
    if (this.tier === 'basic') return 2;
    return 1;
  },

  /* --- Max co-parents --- */
  maxCoparents() {
    if (this.tier === 'pro') return Infinity;
    if (this.tier === 'family') return 3;
    return 0;
  }
};

/* --- Dark Mode Manager --- */
const ThemeManager = {
  init() {
    const saved = localStorage.getItem('pupfile_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    this.set(theme);
  },

  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pupfile_theme', theme);
    this.updateToggle(theme);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    this.set(current === 'dark' ? 'light' : 'dark');
  },

  updateToggle(theme) {
    const toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(el => {
      el.innerHTML = theme === 'dark' 
        ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    });
    // Sync toggle switches (e.g. in settings)
    const darkToggles = document.querySelectorAll('#settings-dark-toggle');
    darkToggles.forEach(el => {
      el.classList.toggle('active', theme === 'dark');
    });
  }
};

/* --- Toast Manager --- */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="margin-left:auto;cursor:pointer;color:var(--text-muted);font-size:1.1rem;line-height:1">&times;</button>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* --- Date Helpers --- */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function formatDateTime(dateStr) {
  return `${formatDate(dateStr)} at ${formatTime(dateStr)}`;
}

function getLogIcon(type) {
  const icons = {
    meal: '<i data-lucide="utensils-crossed" style="width:14px;height:14px;vertical-align:middle"></i>',
    medication: '<i data-lucide="pill" style="width:14px;height:14px;vertical-align:middle"></i>',
    bathroom: '<i data-lucide="paw-print" style="width:14px;height:14px;vertical-align:middle"></i>',
    custom: '<i data-lucide="file-text" style="width:14px;height:14px;vertical-align:middle"></i>',
    food: '<i data-lucide="utensils-crossed" style="width:14px;height:14px;vertical-align:middle"></i>'
  };
  return icons[type] || '<i data-lucide="file-text" style="width:14px;height:14px;vertical-align:middle"></i>';
}

function getLogColor(type) {
  const colors = {
    meal: 'meal',
    medication: 'medication',
    bathroom: 'bathroom',
    custom: 'custom',
    food: 'meal'
  };
  return colors[type] || 'custom';
}

/* --- Init on Load --- */
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
});