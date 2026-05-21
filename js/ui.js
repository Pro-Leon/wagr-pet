/* ========================================
   Wagr — UI Controller
   ======================================== */

/* --- Sidebar Toggle --- */
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('active');
  if (overlay) overlay.classList.toggle('active');
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar) sidebar.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}

/* --- Modal Manager --- */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

/* --- Close modal on overlay click --- */
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
  if (e.target.classList.contains('sidebar-overlay')) {
    closeSidebar();
  }
});

/* --- Escape key to close modals --- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllModals();
    closeSidebar();
  }
});

/* --- Render Timeline --- */
function renderTimeline(logs, containerId = 'timeline-feed') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!logs || logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" style="stroke:var(--text-muted);margin-bottom:16px"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        <h4>Nothing here yet</h4>
        <p>Start tracking — your dog's day is ready to fill up.</p>
      </div>
    `;
    return;
  }

  // Group by date
  const groups = {};
  logs.forEach(log => {
    const dateKey = new Date(log.created_at).toLocaleDateString('en-US', { 
      weekday: 'long', month: 'short', day: 'numeric' 
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(log);
  });

  let html = '';
  Object.entries(groups).forEach(([dateLabel, items]) => {
    html += `<div class="timeline-group">`;
    html += `<div class="timeline-group-label">${dateLabel}</div>`;
    items.forEach(log => {
      const sitterBadge = log.sitter_name ? `<span class="sitter-badge">${escapeHtml(log.sitter_name)}</span>` : '';
      html += `
        <div class="timeline-item" data-log-id="${log.id}">
          <div class="timeline-icon ${getLogColor(log.log_type)}">
            ${getLogIcon(log.log_type)}
          </div>
          <div class="timeline-body">
            <div class="timeline-title-row">
              <div class="timeline-title">${escapeHtml(log.title)} ${sitterBadge}</div>
              <div class="timeline-time">${formatTime(log.created_at)}</div>
            </div>
            ${log.notes ? `<div class="timeline-notes">${escapeHtml(log.notes)}</div>` : ''}
          </div>
          <div class="timeline-actions">
            <button onclick="handleDeleteLog('${log.id}')" title="Delete">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  });

  container.innerHTML = html;
}

/* --- Render Pet Selector --- */
function renderPetSelector(pets, activePetId, selectId = 'pet-select') {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = pets.map(p => 
    `<option value="${p.id}" ${p.id === activePetId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');
}

/* --- Render Pricing Cards --- */
function renderPricingCards(containerId = 'pricing-cards') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const ck = '<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:#16a34a;fill:none;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>';

  container.innerHTML = `
    <div class="pricing-card plan-free">
      <div class="plan-name">Starter</div>
      <div class="plan-price">$0<span class="period">/mo</span></div>
      <div class="plan-desc">1 pet &middot; Forever free</div>
      <ul class="plan-features">
        <li>${ck}<span>1 Pet Profile</span></li>
        <li>${ck}<span>Toxicity & Calorie Calculators</span></li>
        <li>${ck}<span>7-Day Timeline Logging</span></li>
        <li>${ck}<span>Meal, Meds & Bathroom Logs</span></li>
        <li>${ck}<span>Activity Streak</span></li>
      </ul>
      <button class="btn btn-secondary w-full" onclick="closeAllModals()">Current Plan</button>
    </div>
    <div class="pricing-card featured">
      <div class="plan-badge">Popular</div>
      <div class="plan-name">Basic</div>
      <div class="plan-price">$4.99<span class="period">/mo</span></div>
      <div class="plan-desc">Up to 2 Pets</div>
      <ul class="plan-features">
        <li>${ck}<span>Up to 2 Pet Profiles</span></li>
        <li>${ck}<span>Unlimited Log History</span></li>
        <li>${ck}<span>Food Log (all types)</span></li>
        <li>${ck}<span>Passive QR Collar Tags</span></li>
        <li>${ck}<span>Public Emergency Profile</span></li>
      </ul>
      <button class="btn btn-primary w-full" onclick="handleSubscribe('basic')">Upgrade</button>
    </div>
    <div class="pricing-card">
      <div class="plan-name">Family</div>
      <div class="plan-price">$9.99<span class="period">/mo</span></div>
      <div class="plan-desc">Up to 4 Pets</div>
      <ul class="plan-features">
        <li>${ck}<span>Up to 4 Pets</span></li>
        <li>${ck}<span>Co-parent Sync (3 users)</span></li>
        <li>${ck}<span>Active QR + GPS Alerts</span></li>
        <li>${ck}<span>Sitter Magic Links & Care Plans</span></li>
        <li>${ck}<span>Symptom Tracking</span></li>
        <li>${ck}<span>Grooming Appointments</span></li>
        <li>${ck}<span>Medication & Vaccine Reminders</span></li>
      </ul>
      <button class="btn btn-primary w-full" onclick="handleSubscribe('family')">Upgrade</button>
    </div>
    <div class="pricing-card plan-pro">
      <div class="plan-name">Pro</div>
      <div class="plan-price">$16.99<span class="period">/mo</span></div>
      <div class="plan-desc">Unlimited Pets</div>
      <ul class="plan-features">
        <li>${ck}<span>Unlimited Pets</span></li>
        <li>${ck}<span>AI Vet-Prep Reports (PDF)</span></li>
        <li>${ck}<span>Unlimited Co-parent Users</span></li>
        <li>${ck}<span>Sitter Handover Summary Email</span></li>
        <li>${ck}<span>Weight Tracking & Trend Charts</span></li>
        <li>${ck}<span>Vet Records & Document Storage</span></li>
        <li>${ck}<span>Food Inventory & Restock Alerts</span></li>
        <li>${ck}<span>Priority Support</span></li>
      </ul>
      <button class="btn btn-primary w-full" onclick="handleSubscribe('pro')">Go Pro</button>
    </div>
  `;
}

/* --- Escape HTML --- */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* --- Format Number --- */
function formatNumber(num) {
  return new Intl.NumberFormat().format(num);
}

/* --- Debounce --- */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/* --- Smooth scroll to element --- */
function scrollToElement(selector) {
  const el = document.querySelector(selector);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* --- Copy to clipboard --- */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  } catch (e) {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Copied to clipboard', 'success');
  }
}

/* --- URL Params --- */
function getUrlParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
