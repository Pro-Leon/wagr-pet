/* ========================================
   PupFile — In-App Tutorial Overlay
   Vanilla JS, no dependencies.
   ======================================== */

const Tutorial = (() => {
  const STEPS = [
    { id: 'pet-card', title: 'Meet your pet profile', body: 'Everything in PupFile is organized around your pet. View their name, breed, and access all their health data from here.', tab: 'home' },
    { id: 'streak-bar', title: 'Build your streak \ud83d\udd25', body: 'Log daily to track health patterns over time. The longer your streak, the more data your vet has to work with.', tab: 'home' },
    { id: 'quick-actions', title: 'Log in two taps', body: 'Feed, Meds, Walk, and Note buttons for instant logging. Tap any button to quickly record what happened.', tab: 'home' },
    { id: 'status-cards', title: 'Today at a glance', body: 'See last meal, meds, and walk at a glance. Tap any card to log a new entry of that type.', tab: 'home' },
    { id: 'tab-timeline', title: 'The full Timeline', body: 'Every log grouped by date \u2014 your complete history in one scrollable feed.', tab: 'timeline' },
    { id: 'tab-food', title: 'Food & nutrition log', body: 'Log every meal, portion, and ingredient. Track calories and nutritional breakdown over time.', tab: 'food' },
    { id: 'tab-symptoms', title: 'Symptom tracker', body: 'GI, cardio, dermatology, test results \u2014 structured for vets. Generate consistency charts and severity trends.', tab: 'symptoms' },
    { id: 'tab-ai', title: 'AI Vet-Prep Reports \u2728', body: 'One tap compiles 30 days of meals, meds, symptoms, and notes into a clinical summary your vet can actually use.', tab: 'ai', tier: 'pro' },
    { id: 'tab-qr', title: 'QR Emergency Tags', body: 'A QR code for their collar. Anyone who finds them taps it with their phone and you get their GPS location instantly.', tab: 'qr' },
    { id: 'tab-sitter', title: 'Sitter Magic Links \ud83d\udd17', body: 'Secure expiring link for sitters \u2014 no account needed, no app download. They log everything in real time.', tab: 'sitter', tier: 'family' },
    { id: 'tab-coparent', title: 'Co-parent sync', body: 'Invite family members to log and view in real time. Never wonder \u201cdid you feed him?\u201d again.', tab: 'coparent', tier: 'family' },
  ];

  const TIER_ORDER = ['starter', 'basic', 'family', 'pro'];

  let state = {
    active: false,
    currentStep: 0,
    previousFocus: null,
    overlay: null,
    spotlight: null,
    tooltip: null,
    completion: null,
  };

  function getTierIndex() {
    return TIER_ORDER.indexOf(typeof AppState !== 'undefined' && AppState.tier ? AppState.tier : 'starter');
  }

  function userHasTier(requiredTier) {
    if (!requiredTier) return true;
    return getTierIndex() >= TIER_ORDER.indexOf(requiredTier);
  }

  function getTierBadge(requiredTier) {
    if (!requiredTier) return '';
    if (userHasTier(requiredTier)) return '';
    var label = requiredTier === 'pro' ? 'PRO FEATURE' : 'FAMILY+';
    return '<span class="tutorial-tier-badge ' + requiredTier + '">' + label + '</span>';
  }

  function buildDots() {
    var html = '';
    for (var i = 0; i < STEPS.length; i++) {
      var cls = 'tutorial-dot';
      if (i < state.currentStep) cls += ' done';
      if (i === state.currentStep) cls += ' active';
      html += '<span class="' + cls + '"></span>';
    }
    return html;
  }

  function getStep() {
    return STEPS[state.currentStep];
  }

  function createElements() {
    var overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    document.body.appendChild(overlay);

    var spotlight = document.createElement('div');
    spotlight.className = 'tutorial-spotlight';
    document.body.appendChild(spotlight);

    var tooltip = document.createElement('div');
    tooltip.className = 'tutorial-tooltip tutorial-tooltip-enter';
    tooltip.setAttribute('role', 'dialog');
    tooltip.setAttribute('aria-modal', 'true');
    tooltip.setAttribute('aria-label', 'Tutorial step');
    document.body.appendChild(tooltip);

    state.overlay = overlay;
    state.spotlight = spotlight;
    state.tooltip = tooltip;
  }

  function removeElements() {
    [state.overlay, state.spotlight, state.tooltip, state.completion].forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    state.overlay = null;
    state.spotlight = null;
    state.tooltip = null;
    state.completion = null;
  }

  function positionTooltip(target) {
    var tooltip = state.tooltip;
    var isMobile = window.innerWidth < 640;

    tooltip.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');

    if (isMobile) {
      tooltip.style.left = '';
      tooltip.style.top = '';
      tooltip.style.right = '';
      tooltip.style.bottom = '';
      return;
    }

    var targetRect = target.getBoundingClientRect();
    var tooltipRect = tooltip.getBoundingClientRect();
    var viewportW = window.innerWidth;
    var viewportH = window.innerHeight;

    var spaceBottom = viewportH - targetRect.bottom - 16;
    var spaceTop = targetRect.top - 16;
    var spaceRight = viewportW - targetRect.right - 16;
    var spaceLeft = targetRect.left - 16;

    var position, tooltipX, tooltipY;

    if (spaceBottom >= tooltipRect.height + 60) {
      position = 'bottom';
      tooltipX = Math.max(8, Math.min(targetRect.left + targetRect.width / 2 - tooltipRect.width / 2, viewportW - tooltipRect.width - 8));
      tooltipY = targetRect.bottom + 16;
    } else if (spaceTop >= tooltipRect.height + 60) {
      position = 'top';
      tooltipX = Math.max(8, Math.min(targetRect.left + targetRect.width / 2 - tooltipRect.width / 2, viewportW - tooltipRect.width - 8));
      tooltipY = targetRect.top - tooltipRect.height - 16;
    } else if (spaceRight >= tooltipRect.width + 60) {
      position = 'right';
      tooltipX = targetRect.right + 16;
      tooltipY = Math.max(8, Math.min(targetRect.top + targetRect.height / 2 - tooltipRect.height / 2, viewportH - tooltipRect.height - 8));
    } else if (spaceLeft >= tooltipRect.width + 60) {
      position = 'left';
      tooltipX = targetRect.left - tooltipRect.width - 16;
      tooltipY = Math.max(8, Math.min(targetRect.top + targetRect.height / 2 - tooltipRect.height / 2, viewportH - tooltipRect.height - 8));
    } else {
      position = 'bottom';
      tooltipX = Math.max(8, viewportW - tooltipRect.width - 8);
      tooltipY = targetRect.bottom + 16;
    }

    tooltip.style.left = tooltipX + 'px';
    tooltip.style.top = tooltipY + 'px';
    tooltip.style.right = '';
    tooltip.style.bottom = '';
    tooltip.classList.add('arrow-' + position);
  }

  function updateSpotlight(target) {
    var rect = target.getBoundingClientRect();
    var padding = 8;
    state.spotlight.style.left = (rect.left - padding) + 'px';
    state.spotlight.style.top = (rect.top - padding) + 'px';
    state.spotlight.style.width = (rect.width + padding * 2) + 'px';
    state.spotlight.style.height = (rect.height + padding * 2) + 'px';
  }

  function renderStep() {
    var step = getStep();
    var el = document.getElementById(step.id);
    if (!el) {
      nextStep();
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    updateSpotlight(el);

    var tierBadge = getTierBadge(step.tier);
    var isLast = state.currentStep === STEPS.length - 1;

    state.tooltip.innerHTML =
      '<div class="tutorial-step-counter">STEP ' + (state.currentStep + 1) + ' OF ' + STEPS.length + '</div>' +
      '<div class="tutorial-title">' + step.title + tierBadge + '</div>' +
      '<div class="tutorial-body">' + step.body + '</div>' +
      '<div class="tutorial-dots">' + buildDots() + '</div>' +
      '<div class="tutorial-actions">' +
        '<button class="tutorial-skip" data-action="skip">Skip tour</button>' +
        '<button class="tutorial-next" data-action="next">' + (isLast ? 'Finish \ud83c\udf89' : 'Next \u2192') + '</button>' +
      '</div>';

    requestAnimationFrame(function () {
      positionTooltip(el);
      state.tooltip.classList.remove('tutorial-tooltip-enter');
      state.tooltip.classList.add('tutorial-tooltip-visible');
    });

    try { localStorage.setItem('pupfile_tutorial_step', String(state.currentStep)); } catch (e) {}
  }

  function nextStep() {
    state.currentStep++;
    if (state.currentStep >= STEPS.length) {
      showCompletion();
      return;
    }

    var step = getStep();
    var el = document.getElementById(step.id);
    if (!el) {
      nextStep();
      return;
    }

    if (step.tab && step.tab !== 'home' && typeof switchTab === 'function') {
      state.tooltip.classList.add('tutorial-tooltip-enter');
      state.tooltip.classList.remove('tutorial-tooltip-visible');
      switchTab(step.tab);
      setTimeout(function () {
        var freshEl = document.getElementById(step.id);
        if (freshEl) {
          freshEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          requestAnimationFrame(function () {
            updateSpotlight(freshEl);
            renderStep();
          });
        } else {
          nextStep();
        }
      }, 200);
      return;
    }

    renderStep();
  }

  function showCompletion() {
    try { localStorage.setItem('pupfile_tutorial_done', 'completed'); localStorage.removeItem('pupfile_tutorial_step'); } catch (e) {}

    state.tooltip.classList.add('tutorial-tooltip-enter');
    state.tooltip.classList.remove('tutorial-tooltip-visible');

    setTimeout(function () {
      state.tooltip.style.display = 'none';
      state.spotlight.style.display = 'none';

      var el = document.createElement('div');
      el.className = 'tutorial-completion';
      el.innerHTML =
        '<div class="tutorial-completion-emoji">\ud83d\udc3e</div>' +
        '<h2>You\'re all set!</h2>' +
        '<p>Start by logging your first event</p>' +
        '<button class="tutorial-completion-btn" data-action="close">Let\'s go \u2192</button>';
      document.body.appendChild(el);
      state.completion = el;

      state.active = false;

      var btn = el.querySelector('[data-action="close"]');
      if (btn) btn.focus();

      setTimeout(function () {
        close();
      }, 6000);
    }, 300);
  }

  function close() {
    state.active = false;
    removeElements();
    if (state.previousFocus && typeof state.previousFocus.focus === 'function') {
      state.previousFocus.focus();
    }
    state.previousFocus = null;
  }

  function skip() {
    try { localStorage.setItem('pupfile_tutorial_done', 'skipped'); localStorage.removeItem('pupfile_tutorial_step'); } catch (e) {}
    close();
  }

  function handleAction(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    if (!action) return;
    e.preventDefault();

    if (action === 'next') {
      nextStep();
    } else if (action === 'skip') {
      skip();
    } else if (action === 'close') {
      close();
    }
  }

  function handleKeydown(e) {
    if (!state.active) return;
    if (e.key === 'Escape') { e.preventDefault(); skip(); return; }

    if (e.key === 'Tab') {
      var focusable = state.tooltip.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  function handleResize() {
    if (!state.active) return;
    var step = getStep();
    var el = document.getElementById(step.id);
    if (el) {
      updateSpotlight(el);
      positionTooltip(el);
    }
  }

  function start() {
    if (state.active) return;

    STEPS.forEach(function (s) {
      if (!document.getElementById(s.id)) {
        console.warn('Tutorial: element #' + s.id + ' not found');
      }
    });

    state.active = true;
    state.currentStep = 0;
    state.previousFocus = document.activeElement;

    createElements();
    renderStep();
  }

  function resume(stepIndex) {
    if (state.active) return;

    state.active = true;
    state.currentStep = parseInt(stepIndex, 10) || 0;
    if (state.currentStep >= STEPS.length) state.currentStep = 0;
    state.previousFocus = document.activeElement;

    createElements();

    var step = getStep();
    if (step.tab && step.tab !== 'home' && typeof switchTab === 'function') {
      switchTab(step.tab);
      setTimeout(function () {
        renderStep();
      }, 200);
    } else {
      renderStep();
    }
  }

  function retake() {
    try {
      localStorage.removeItem('pupfile_tutorial_done');
      localStorage.removeItem('pupfile_tutorial_step');
    } catch (e) {}
    start();
  }

  function init() {
    var done;
    try { done = localStorage.getItem('pupfile_tutorial_done'); } catch (e) { done = null; }
    var savedStep;
    try { savedStep = localStorage.getItem('pupfile_tutorial_step'); } catch (e) { savedStep = null; }

    if (done && done !== '') return;

    var delay = savedStep !== null && savedStep !== '' ? 500 : 900;

    setTimeout(function () {
      var check = setInterval(function () {
        var petCard = document.getElementById('pet-card');
        var appReady = typeof AppState !== 'undefined';
        if (petCard && appReady) {
          clearInterval(check);
          if (savedStep !== null && savedStep !== '') {
            if (typeof switchTab === 'function') switchTab('home');
            setTimeout(function () { resume(parseInt(savedStep, 10)); }, 200);
          } else {
            if (typeof switchTab === 'function') switchTab('home');
            setTimeout(function () { start(); }, 200);
          }
        }
      }, 100);
      setTimeout(function () { clearInterval(check); }, 10000);
    }, delay);
  }

  document.addEventListener('click', handleAction);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleResize);

  return { init: init, start: start, resume: resume, skip: skip, close: close, retake: retake };
})();

document.addEventListener('DOMContentLoaded', function () {
  Tutorial.init();
});
