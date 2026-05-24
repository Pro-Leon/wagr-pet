/* ========================================
   Pup File — Client-Side Analytics
   Lightweight, privacy-conscious telemetry.
   ======================================== */

const ANALYTICS_ENABLED_KEY = 'pupfile_analytics_consent';
const ANALYTICS_SESSION_KEY = 'pupfile_session_id';

function getSessionId() {
  let sid = localStorage.getItem(ANALYTICS_SESSION_KEY);
  if (!sid) {
    sid = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(ANALYTICS_SESSION_KEY, sid);
  }
  return sid;
}

function analyticsConsented() {
  return localStorage.getItem(ANALYTICS_ENABLED_KEY) === 'true';
}

function setAnalyticsConsent(enabled) {
  localStorage.setItem(ANALYTICS_ENABLED_KEY, enabled ? 'true' : 'false');
  if (enabled) {
    trackEvent('consent', 'analytics_accepted', { page: window.location.pathname });
  }
}

function getUserId() {
  try {
    const stored = localStorage.getItem('pupfile_user');
    if (stored) {
      const user = JSON.parse(stored);
      return user?.id || null;
    }
  } catch (e) { /* not logged in */ }
  return null;
}

async function trackEvent(eventType, eventName, extra = {}) {
  if (!analyticsConsented()) return;
  try {
    const payload = {
      event_type: eventType,
      event_name: eventName,
      page: extra.page || window.location.pathname,
      user_id: extra.userId || getUserId(),
      session_id: getSessionId(),
      metadata: extra.metadata || {},
    };
    // Fire-and-forget — no need to await
    fetch((window.location.origin || 'https://pupfile.com') + '/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (e) { /* analytics non-critical */ }
}

// Page view tracking
function trackPageView() {
  trackEvent('page_view', window.location.pathname.replace('/', '') || 'home', {
    metadata: {
      referrer: document.referrer || null,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
  });
}

// Feature usage tracking (dashboard tabs, etc.)
function trackFeature(featureName, extra = {}) {
  trackEvent('feature_use', featureName, extra);
}

// Error tracking
function trackError(error, context = '') {
  if (!analyticsConsented()) return;
  try {
    const payload = {
      event_type: 'error',
      event_name: error.message || 'Unknown error',
      page: window.location.pathname,
      user_id: getUserId(),
      session_id: getSessionId(),
      metadata: {
        stack: error.stack?.slice(0, 500) || null,
        context: context,
        url: window.location.href,
      },
    };
    fetch((window.location.origin || 'https://pupfile.com') + '/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (e) { /* analytics non-critical */ }
}

// Cookie consent banner
function showConsentBanner() {
  if (localStorage.getItem(ANALYTICS_ENABLED_KEY) !== null) return;
  const banner = document.createElement('div');
  banner.id = 'analytics-consent-banner';
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:var(--bg-secondary,#1a1a2e);border-top:1px solid var(--border-color,#333);padding:14px 20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;font-size:0.82rem;box-shadow:0 -4px 20px rgba(0,0,0,0.15)';
  banner.innerHTML = `
    <span style="color:var(--text-secondary,#aaa)">We use anonymized analytics to improve PupFile. <a href="/cookies" style="color:var(--orange-500,#ea580c);text-decoration:underline">Learn more</a></span>
    <div style="display:flex;gap:8px">
      <button id="consent-decline" style="padding:6px 14px;border-radius:6px;border:1px solid var(--border-color,#444);background:transparent;color:var(--text-secondary,#aaa);cursor:pointer;font-size:0.8rem">Decline</button>
      <button id="consent-accept" style="padding:6px 14px;border-radius:6px;border:none;background:var(--orange-500,#ea580c);color:#fff;cursor:pointer;font-weight:600;font-size:0.8rem">Accept</button>
    </div>
  `;
  document.body.appendChild(banner);
  document.getElementById('consent-accept').addEventListener('click', () => {
    setAnalyticsConsent(true);
    banner.remove();
    trackPageView();
  });
  document.getElementById('consent-decline').addEventListener('click', () => {
    setAnalyticsConsent(false);
    banner.remove();
  });
}

// Auto-init: track page view on load, wire up global error handler, show consent banner
document.addEventListener('DOMContentLoaded', () => {
  showConsentBanner();
  if (analyticsConsented()) {
    trackPageView();
  }
  window.addEventListener('error', (e) => {
    trackError(e.error || e, 'uncaught');
  });
  window.addEventListener('unhandledrejection', (e) => {
    trackError(e.reason || new Error('Unhandled promise rejection'), 'unhandled_promise');
  });
});
