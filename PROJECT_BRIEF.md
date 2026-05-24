# Pup File — Project Brief

## Overview

Pup File is a web-based dog care tracking platform that helps dog owners log, monitor, and share their pet's daily activities — meals, medications, bathroom breaks, symptoms, grooming, and more. It features tier-gated subscription plans, AI-generated vet reports (with PDF download & email-to-vet), QR emergency tags (under reconstruction), sitter magic links, co-parent sync, and free veterinary calculators. Landing page designed for a non-AI-generated look with moderate typography, honest founder story, and handcrafted dashboard mockup.

**URL:** https://pupfile.com  
**Status:** Production (live Paystack payments, live Supabase data, live OpenRouter AI, html2pdf.js for AI report PDFs)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Hosting** | Vercel (static files + serverless functions) |
| **Frontend** | Vanilla HTML, CSS, JavaScript (no framework) |
| **CSS** | Custom design system via `css/globals.css` with CSS custom properties |
| **Auth** | Supabase Auth (email/password) |
| **Database** | Supabase PostgreSQL with Row-Level Security (RLS) |
| **Payments** | Paystack (recurring subscriptions with plan codes) |
| **AI** | OpenRouter (deepseek/deepseek-v4-flash, alibaba/qwen-3.6-plus, google/gemma-4 for vet reports + chat assistant) |
| **QR** | html5-qrcode library (scanner), QRCode.js (generator) |
| **PDF** | html2pdf.js (client-side PDF generation from HTML) |
| **CDN** | jsdelivr for Supabase SDK, Paystack Pop, QR libraries, html2pdf

---

## Directory Structure

```
houndos/
├── index.html              # Landing / marketing page (hero, builder story, benefits, testimonials, calculators, pricing, privacy, footer)
├── auth.html               # Login / signup page (Supabase email/password, co-parent flow skips pet fields)
├── dashboard.html          # Main app (12 tabs, all tracking, modals, mobile nav, AI report PDF/email, tutorial)
├── admin.html              # Admin panel (view tickets, users, system logs)
├── privacy.html            # Privacy policy (11 sections)
├── terms.html              # Terms of service (13 sections)
├── cookies.html            # Cookie policy (with cookie usage table)
├── public-profile.html     # Public pet profile page (viewable via QR scan link)
├── sitter.html             # Sitter view (magic link access, no account needed)
├── .env                    # Environment variable template
├── vercel.json             # Vercel config (rewrites, headers, no cleanUrls)
├── schema.sql              # Full Supabase schema (profiles, pets, pet_logs, food_logs, views, triggers, RLS policies)
├── supabase-*.sql          # Migration scripts for features (care plans, support tickets, grooming, symptoms, etc.)
├── package-lock.json       # (present but no dependencies — all via CDN)
│
├── images/
│   └── hero-corgi.jpg      # Landing page hero image (Pixabay corgi photo — currently unused, replaced by HTML mockup)
│
├── css/
│   ├── globals.css         # Global design system: variables, dark mode, layout, buttons, cards, inputs, modals, toasts, sidebar, navbar, responsive breakpoints, support FAB, toggle switch
│   └── tutorial.css        # In-app tutorial overlay styles: spotlight cutout, tooltip, bottom sheet, progress dots, completion screen
│
├── js/
│   ├── app.js              # AppState engine (user, profile, pets, logs, tier, event system, feature gating)
│   │                       # ThemeManager (dark/light toggle), Toast system, date helpers, log icons/colors
│   ├── api.js              # Full Supabase data layer (1075 lines): auth, profiles, pets, logs, food logs,
│   │                       # GI logs, cardio logs, test results, derma logs, grooming, care plans,
│   │                       # public profiles, sitter links, AI reports, location alerts, Paystack checkout,
│   │                       # support tickets, barcode lookup, nutrition analysis
│   ├── ui.js               # UI utilities: sidebar toggle, modals, timeline renderer, pet selector,
│   │                       # pricing cards renderer, debounce, escapeHtml, copy-to-clipboard
│   ├── tutorial.js         # 11-step in-app tutorial overlay with spotlight, tooltip, tier awareness, mobile bottom sheet
│   └── calculators.js       # Toxicity database (17 items with severity, symptoms, actions),
│                            # Calorie calculator (RER formula, life-stage multipliers, macros),
│                            # CalculatorStorage (localStorage persistence)
│
└── api/                    # Vercel serverless functions (Node.js)
    ├── package.json            # Package config with @supabase/supabase-js + "type": "module"
    ├── create-subscription.js  # POST /api/create-subscription — initializes Paystack checkout, hides secret key
    ├── ai-report.js            # POST /api/ai-report — generates vet report via OpenRouter with multi-model fallback
    ├── paystack-webhook.js     # POST /api/paystack-webhook — auto-upgrades profiles.tier on payment, downgrades on cancellation
    ├── send-email.js           # POST /api/send-email — sends transactional emails via Brevo
    ├── manage-subscription.js  # POST /api/manage-subscription — Paystack subscription management portal
    ├── analytics.js            # POST /api/analytics — stores usage analytics events
    ├── create-coparent-link.js # POST /api/create-coparent-link — generates one-time co-parent invite token
    ├── accept-coparent-invite.js # POST /api/accept-coparent-invite — validates token, creates co-parent relationship
    ├── signup-setup.js         # POST /api/signup-setup — creates profile + first pet on signup (service role key)
    ├── chat-agent.js           # POST /api/chat-agent — AI assistant with context-aware responses, JSON action parsing
    ├── verify-sitter.js        # GET /api/verify-sitter — verifies sitter magic link token (service role key)
    ├── sitter-logs.js          # GET /api/sitter-logs — fetches pet logs for unauthenticated sitter view
    └── sitter-log.js           # POST /api/sitter-log — creates log entry from unauthenticated sitter
```

---

## Authentication Flow

- **Supabase Auth** with email/password
- Login (`signIn`) and Signup (`signUp`) on `auth.html`
- On signup: `auth.html` unconditionally calls `POST /api/signup-setup` (service role key) immediately after `signUp()` to create profile + first pet, bypassing RLS. This works regardless of whether email confirmation is required.
- Co-parent signup (`auth.html`): when `?redirect=/coparent?token=...` is detected, pet name/breed/weight/birth-date fields are hidden, step 3 shows a "You're joining as a co-parent" message with a direct "Create Account" button. Pet creation is skipped entirely for co-parent flows.
- If `data.session` exists → auto-login; if only `data.user` → email confirmation required
- After login → redirect via `getRedirectUrl()` (supports `?redirect=` param for co-parent invites and other deep links)
- `getCurrentUser()` reads `supabase.auth.getSession()` on every dashboard load
- Profile is auto-created client-side as fallback on first dashboard load if still missing
- `loadDashboard()` copies `profile.display_name → AppState.user.display_name` so the greeting name survives page refresh
- Logout clears localStorage (`pupfile_user`, `pupfile_pets`, `pupfile_logs`) and calls `signOut()`

---

## Dashboard Tabs (12 Total)

| Tab | ID | Tier Gate | Description |
|---|---|---|---|---|---|
| Home | `home` | Starter | Greeting, streak, quick-log buttons (notes only for starter), summary cards, recent activity |
| Timeline | `timeline` | Basic+ | Full log feed grouped by date with meal/med/bathroom/note entries. Starter users see upgrade CTA |
| QR Tags | `qr` | Basic+ | QR code generation for collar tag, scanner for other pets' tags, GPS location alert. Currently showing "upgrades in progress" placeholder — being rebuilt |
| AI Reports | `ai` | Pro | Checkbox data sources (timeline, food, GI, cardio, tests, derma, grooming), time period selector, generates clinical summary via OpenRouter with multi-model fallback |
| AI Assistant | `ai-assistant` | Basic+ | Chat-based AI assistant powered by Qwen 3.6 Plus. Basic tier: read-only queries. Family+: can log to timeline via natural language. Robot head icon in sidebar |
| Food Log | `food` | Basic+ | Log commercial/homemade/raw/treat/supplement with brand, product, portion, ingredients. Nutritional analysis (simulated). Barcode lookup (demo) |
| Symptoms | `symptoms` | Family+ | 4 sub-tabs: GI (vomit/feces consistency+color), Cardio (respiratory rate), Test Results (name/date/vet/diagnosis), Dermatology (type/location/severity). All with filtering. Generates symptom report |
| Grooming | `grooming` | Family+ | Appointment tracking with groomer name, location, services checklist, products used, cost, rating |
| Sitter Links | `sitter` | Family+ | Generate magic link for sitters (no account needed). Care Plans — detailed care instructions with feeding, meds, walking, emergency contact, vet info |
| Co-parents | `coparent` | Family+ | Invite co-parents via one-time shareable link. Manage co-parents per pet. Family = 3 co-parents, Pro = unlimited |
| My Pets | `pets` | Starter | List/Add/Edit/Delete pets. Tier-gated: Starter=1, Basic=2, Family=4, Pro=unlimited |
| Settings | `settings` | Starter | Profile name, email, dark mode toggle, current plan, sign out, delete account |
| Support | `support` | Starter | Submit tickets (subject, message, priority), view ticket list with chat-bubble UI, closed ticket lock, notification badge (red dot) on sidebar links |
| Admin | `admin` | Admin only | Hidden link visible only when `profile.is_admin = true`. View all tickets, users, system logs |

Tab switching in `dashboard.html:1605` uses `switchTab(tab, el)` which:
1. Sets `.active` class on sidebar + bottom nav
2. Shows only the targeted `.tab-content` (removes `.active` from all others, sets `style.display = ''`)
3. Calls the appropriate render function per tab
4. Re-checks feature access for gated tabs

---

## Pet Management

- Stored in `pets` table (id, user_id, name, breed, weight_kg, birth_date, medical_flags, sitter_token)
- `renderPetSelector()` populates `<select id="pet-select">`
- `handlePetChange()` switches active pet and reloads all logs (timeline, food, GI, cardio, tests, derma, grooming)
- Pet limit enforced in `AppState.maxPets()` — Free=1, Essential=2, Pro=Infinity
- Add/Edit/Delete via modals with full CRUD through Supabase

---

## Tier System

Defined in `AppState` (`app.js:94-111`):

| Tier | Level | Price | Max Pets | Key Features |
|---|---|---|---|---|
| **Starter** | 0 | $0 | 1 | Notes, calculators, 7-day timeline, 1 pet |
| **Basic** | 1 | $4.99/mo or $44/yr | 2 | Timeline logging, food log, passive QR tags, public emergency profile, unlimited log history |
| **Family** | 2 | $9.99/mo or $89/yr | 4 | Active QR + GPS alerts, co-parent sync (3 users), sitter links, symptom tracking, grooming, medication reminders, feeding schedule |
| **Pro** | 3 | $16.99/mo or $149/yr | Unlimited | All Family features + AI vet reports, weight tracking, vet records, food inventory, unlimited co-parents, priority support |

Feature gating via `AppState.canAccess(feature)`:
```javascript
const featureTiers = {
  'timeline': 'starter', 'pet_notes': 'starter',
  'food_log': 'basic', 'qr_passive': 'basic',
  'multiple_pets': 'basic', 'food_analysis': 'basic',
  'chat_assistant': 'basic',
  'symptom_tracking': 'family', 'grooming': 'family',
  'sitter_link': 'family', 'location_alert': 'family',
  'co_parent': 'family',
  'ai_report': 'pro', 'unlimited_pets': 'pro',
  'weight_tracking': 'pro', 'vet_records': 'pro',
  'food_inventory': 'pro', 'heat_cycle': 'pro',
  'unlimited_coparents': 'pro'
};
```

Tier is stored in `profiles.tier` column in Supabase. Updated after successful Paystack subscription.

---

## Tracking Features

### Timeline Logs (`pet_logs` table)
- Types: `meal`, `medication`, `bathroom`, `custom` (notes)
- Each log has: pet_id, user_id, log_type, title, notes, sitter_name, created_at
- Rendered grouped by date with icons, sitter badges, delete buttons
- Free tier: only `custom` (notes) allowed — sees upgrade CTA instead of full timeline

### Food Logs (`food_logs` table)
- Types: `commercial`, `homemade`, `raw`, `treat`, `supplement`
- Fields: brand, product, portion (size + unit), ingredients, notes, fed_at
- Nutritional analysis fields: calories_per_cup, protein/fat/fiber/carbs/moisture percentages
- Analysis simulated client-side via `analyzeNutrition()` (not a real API)
- Barcode lookup is mock data (demo only)

### GI Logs (`gi_logs` table)
- Types: `vomit`, `feces`, `both`
- Fields: consistency (solid/soft/liquid/mucoid/bloody/foreign_object), color, notes

### Cardio Logs (`cardio_logs` table)
- Fields: respiratory_rate (bpm), position (standing/sitting/lying), effort (normal/labored/rapid/shallow), notes

### Test Results (`test_results` table)
- Fields: test_name, test_date, veterinarian, diagnosis, notes

### Dermatology Logs (`derma_logs` table)
- Fields: issue_type (rash/lump/hot_spot/wound/hair_loss/itching/other), location, severity (mild/moderate/severe), description

### Grooming Appointments (`grooming_appointments` table)
- Fields: appointment_date, groomer_name, location, services_performed (JSON array), products_used, cost, rating, notes

---

## QR Emergency Tag System

**Status:** Under reconstruction — dashboard shows "upgrades in progress" placeholder. Existing tags continue to work.

**Flow (pre-rebuild):**
1. User generates QR code for their pet (Basic+). Uses QRCode.js library.
2. QR encodes a URL: `https://pupfile.com/p/{petId}`
3. Vercel rewrites `/p/:petId` → `public-profile.html` (clean URLs)
4. `public-profile.html` extracts petId from URL path (or query param / hash fallback) and calls `getPublicPetProfile()` which uses:
   - **Primary:** `supabase.rpc('get_public_pet_profile', { pet_id })` — SECURITY DEFINER function that bypasses auth schema restrictions for anonymous scanners
   - **Fallback 1:** `vw_public_pet_profiles` view (pets + auth.users join)
   - **Fallback 2:** `public_pet_profiles` table (publicly readable via RLS)
5. Page renders pet name, breed, medical flags, owner contact
6. "Share Location with Owner" button → `navigator.geolocation.getCurrentPosition()` → calls `sendLocationAlert()` with owner email → Brevo email with Google Maps link
7. Authenticated users in Dashboard can use QR scanner (html5-qrcode) to scan other pets' tags

---

## AI Vet Reports (Pro)

**Flow (`generateVetReport` in `api.js:400` and `dashboard.html:3362`):**
1. User selects data sources (timeline, food, GI, cardio, tests, derma, grooming) and time period (7/14/30/60/90 days)
2. Dashboard compiles a markdown summary of all selected logs
3. Sends to Vercel serverless function (`POST /api/ai-report`) which calls OpenRouter API
4. Multi-model fallback chain (server-side only): `deepseek/deepseek-v4-flash:free` → `alibaba/qwen-3.6-plus:free` → `google/gemma-4-31b-it:free`
5. The first model that returns a successful response is used. The model name is logged server-side and not exposed to the client.
6. All AI report requests go exclusively through `/api/ai-report` — no client-side fallback to protect the API key.
7. Returns clinical summary in markdown with: Summary, Key Findings, Recommendations
8. **Download PDF** — after generation, a "Download PDF" button uses `html2pdf.js` to capture the report as an A4 PDF (`{pet-name}-ai-report.pdf`)
9. **Email to Vet** — "Email to Vet" button prompts for vet email + optional note, sends via `/api/send-email` with `type: 'ai_report'`

---

## Sitter Magic Links & Care Plans (Pro)

**Sitter Links:**
- `createSitterToken()` generates a 32-char random token and stores it on the pet record (authenticated owner DB call)
- Token is embedded in URL: `https://pupfile.com/dashboard?sitter_token={token}`
- Sitter opens URL (no auth) → `handleSitterMode()` fetches `GET /api/verify-sitter?token=...` (serverless endpoint using `SUPABASE_SERVICE_ROLE_KEY`), bypassing RLS that blocks unauthenticated queries
- Pet info and logs are fetched via dedicated serverless endpoints (`GET /api/sitter-logs?petId=...&token=...`) instead of direct `db()` calls, avoiding RLS rejection
- Sitter logs are created via `POST /api/sitter-log` (verifies sitter_token server-side, inserts via service role key)
- All sitter API endpoints verify the sitter_token against the `pets` table before returning data or accepting writes
- Sitter name is stored in `localStorage('pupfile_sitter_name')`, sitter token in `localStorage('pupfile_sitter_token')`
- Links expire automatically when regenerated (new token overwrites old)

**Care Plans (`care_plans` table):**
- Detailed instructions: feeding, medication, walking/exercise, behavioral notes, emergency contact, vet info, additional notes
- Sitter name, email, date range
- `shareCarePlan()` generates email-ready content with subject and body

---

## Free Calculators

### Toxicity Checker
- 17 items in database (chocolate, grapes, xylitol, onions, avocado, macadamia nuts, alcohol, caffeine, cooked bones, antifreeze, ibuprofen, rodenticide, lily, daffodil, sago palm, etc.)
- Each item: name, severity (critical/high/moderate/low), symptoms, action, keywords
- Search by keyword with 2-character minimum

### Calorie Calculator
- Uses standard RER formula: `70 × weight(kg)^0.75`
- Life-stage multipliers: puppy up to 3.0x, adult moderate 1.6x, senior 1.2x, weight loss 1.0x, lactating 2.5x
- Returns: RER, daily calories, per-meal calories, estimated protein/fat/carbs (grams)
- Suggests 2 meals/day for adults, 3 for puppies

Both calculators have **no server dependency** — they work offline via localStorage persistence.

---

## Paystack Subscription Integration

**Plans (Paystack plan codes):**

| Plan | Code |
|---|---|
| Basic Monthly | `PLN_x7yn9h54irimq96` |
| Basic Yearly | `PLN_omjluu4cllyzgyd` |
| Family Monthly | `PLN_38n01fa6kxbk9vn` |
| Family Yearly | `PLN_3r0edwfqim3uixw` |
| Pro Monthly | `PLN_wlpu3bvnyl5x7di` |
| Pro Yearly | `PLN_bdr7x2i4rkb4cod` |

**Flow:**
1. User clicks "Upgrade" on pricing modal
2. `openPaystackCheckout(email, plan, onSuccess)` called
3. Tries Vercel serverless function first (`POST /api/create-subscription`)
   - Serverless function calls `https://api.paystack.co/transaction/initialize` with secret key
   - Returns `authorization_url` → user redirected to Paystack checkout
4. Fallback: client-side `PaystackPop.setup()` inline checkout (for local dev)
5. After successful payment, Paystack webhook should update `profiles.tier` (not yet implemented — manual or pending)

---

## Database Schema (Supabase)

### Core Tables
| Table | Purpose | RLS |
|---|---|---|
| `profiles` | User tier, admin flag, email | Users read/update own |
| `pets` | Pet profiles, sitter_token | Owners manage own, sitters read via token |
| `pet_logs` | Timeline entries (meal/med/bathroom/custom) | Owners + co-parents |
| `food_logs` | Food entries with nutritional data | Owners + co-parents |
| `gi_logs` | Vomit/feces tracking | Owners |
| `cardio_logs` | Respiratory rate tracking | Owners |
| `test_results` | Vet test results | Owners |
| `derma_logs` | Skin issue tracking | Owners |
| `grooming_appointments` | Grooming history | Owners |
| `care_plans` | Detailed sitter instructions | Owners |
| `public_pet_profiles` | QR-linked public profiles | Public read, owner manage |
| `support_tickets` | User support requests | User read own, admin read all |

### Views
- `vw_public_pet_profiles` — joins `pets` + `auth.users` for QR card display

### Key Design Choices
- UUID primary keys with `uuid_generate_v4()`
- `created_at` / `updated_at` timestamps on all tables
- `update_updated_at_column()` trigger function on core tables
- Row-Level Security (RLS) on all tables — no table is publicly writable
- Sitter access via `sitter_token` column on `pets` (unique, nullable)

---

## Serverless API Routes (Vercel)

API files in `api/` use `"type": "module"` from `api/package.json` for ES module support. Functions that need `SUPABASE_SERVICE_ROLE_KEY` use `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })` to bypass RLS for unauthenticated or cross-user operations.

### `POST /api/create-subscription`
- **Environment:** `PAYSTACK_SECRET_KEY`
- Initializes a Paystack checkout session
- Sends `email`, `plan`, `userId` to Paystack API
- Returns `authorization_url` for redirect

### `POST /api/ai-report`
- **Environment:** `OPENROUTER_KEY`
- Receives compiled log summary
- Calls OpenRouter with multi-model fallback chain: `deepseek/deepseek-v4-flash:free` → `alibaba/qwen-3.6-plus:free` → `google/gemma-4-31b-it:free`
- First successful model response is returned. Model name logged server-side only.
- Returns AI-generated clinical report markdown
- No client-side fallback — API key never exposed to client

### `POST /api/send-email`
- **Environment:** `BREVO_API_KEY`
- Sends transactional emails via Brevo (SendinBlue) SMTP API
- Accepts `{ type, to, toName, petName, link, message, ownerName, sitterName, tier, plan, report, note }`
- Supported types:
  - `sitter_invite` — sends magic link to sitter's email
  - `location_alert` — notifies owner when QR tag is scanned with GPS coordinates
  - `support_reply` — notifies user when admin responds to their ticket
  - `welcome` — sent on account creation
  - `subscription` — sent on successful plan upgrade
  - `ai_report` — sends AI health report to a vet email with monospace-formatted content and optional owner note
- Falls back silently on failure (non-critical messages)

### `POST /api/manage-subscription`
- **Environment:** `PAYSTACK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Receives `{ userId, action }` where action is `manage` or `status`
- `action: 'manage'` — fetches user's `subscription_code` from Supabase, calls Paystack's `/subscription/{code}/manage/link` API, returns the management portal URL
- `action: 'status'` — returns current subscription_code, subscription_status, and tier
- If no subscription_code exists, returns a message guiding the user to subscribe first

### `POST /api/paystack-webhook`
- **Environment:** `PAYSTACK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Paystack sends POST requests to this URL on subscription events
- Verifies HMAC-SHA256 signature using `PAYSTACK_SECRET_KEY`
- Processes events:
   - `charge.success`, `subscription.create`, `invoice.create` → upgrades `profiles.tier` to `basic`, `family`, or `pro`
   - `subscription.disable`, `subscription.expiring`, `invoice.failed` → downgrades `profiles.tier` to `starter`
- Maps Paystack plan codes → tiers (`basic_monthly` → `basic`, `family_yearly` → `family`, `pro_monthly` → `pro`, etc.)
- Uses Supabase service_role key (bypasses RLS) to update profiles
- Finds user by email via GoTrue Admin API, with fallback to `profiles` table query
- **Setup required:** Add URL `https://pupfile.com/api/paystack-webhook` in Paystack Dashboard → Settings → Webhooks → Add URL. Enable events: `charge.success`, `subscription.create`, `invoice.create`, `subscription.disable`, `subscription.expiring`, `invoice.failed`

### `POST /api/signup-setup`
- **Environment:** `SUPABASE_SERVICE_ROLE_KEY`
- Called unconditionally from `auth.html` signup handler immediately after `signUp()`
- Accepts `{ userId, displayName, petName?, petBreed? }`
- Creates a row in `profiles` (with `display_name`) and a row in `pets` using the service role key, bypassing RLS
- Works even when no session exists (email confirmation required, no auto-login)
- Client-side profile creation in `loadDashboard()` is kept as a fallback for existing users

### `POST /api/chat-agent`
- **Environment:** `OPENROUTER_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- AI assistant endpoint using `alibaba/qwen-3.6-plus:free` model
- Accepts `{ messages, petId, tier }` — the last user message is the query
- System prompt includes: today's logs, 7-day log history, food logs, medications, current pet profile, and user tier
- The model outputs JSON: `{ reply: string, actions: array }`
- Actions are parsed server-side and executed against Supabase using the service role key
- Supported actions: `log_timeline` (creates pet_log entry with `log_type`, `title`, `notes`, `sitter_name: 'AI Assistant'`)
- Tier enforcement: Basic tier users get read-only replies (actions are parsed but not executed); Family+ users get full logging capability
- Returns `{ reply, actions }` to the client

### `GET /api/verify-sitter`
- **Environment:** `SUPABASE_SERVICE_ROLE_KEY`
- Accepts `?token=` query parameter (sitter magic link token)
- Queries `pets` table by `sitter_token` using service role key (bypasses RLS for unauthenticated visitors)
- Returns `{ pet: { id, name, breed, medical_flags, user_id } }` or 404
- Replaces the client-side `verifySitterToken()` which failed due to RLS blocking unauthenticated reads

### `GET /api/sitter-logs`
- **Environment:** `SUPABASE_SERVICE_ROLE_KEY`
- Accepts `?petId=&token=` query parameters
- Verifies the sitter_token against the pet, then fetches latest 50 `pet_logs` entries
- Returns `{ logs: [...] }` or 403/500

### `POST /api/sitter-log`
- **Environment:** `SUPABASE_SERVICE_ROLE_KEY`
- Accepts JSON body: `{ petId, token, log_type, title, notes, sitter_name }`
- Verifies sitter_token against the pet, then inserts the log using `user_id` from the pet record
- Returns `{ log: {...} }` or 403/500

### `POST /api/create-coparent-link`
- **Environment:** `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- Uses static `import` from `@supabase/supabase-js` (requires `api/package.json` with `"type": "module"`)
- Validates tier coparent limits, generates one-time token with `randomBytes(32).toString('hex')`, stores in `co_parent_invites`

### `POST /api/accept-coparent-invite`
- **Environment:** `SUPABASE_SERVICE_ROLE_KEY`
- Uses static `import` from `@supabase/supabase-js`

---

## Theme System

- Light/dark mode via `data-theme` attribute on `<html>`
- CSS custom properties change all theme values globally
- `ThemeManager` in `app.js:126`:
  - `init()` — reads `localStorage('pupfile_theme')` or `prefers-color-scheme`
  - `toggle()` — swaps light ↔ dark
  - `updateToggle()` — updates toggle button icon (sun/moon) and settings switch
- Skinny moon icon for dark mode, sun rays icon for light mode

---

## Admin Panel (`admin.html`)

- Only visible when `profile.is_admin === true`
- Links appear in dashboard sidebar and mobile menu with red color
- Capabilities (from code):
  - View all support tickets (with status, priority, user email)
  - Respond to tickets (admin response field)
  - Change ticket status (open → in_progress → resolved → closed)
  - View all user profiles and tiers
  - System overview / logs

---

## Key State Management (`AppState`)

Centralized in `app.js` with an event-driven pattern:
```javascript
const AppState = {
  user, profile, activePet, pets[], logs[], tier,
  isSitter, sitterPetId, activeTab,
  on(event, callback), emit(event, data),  // pub/sub
  setUser, setProfile, setPets, setActivePet, setLogs, setTier,
  canAccess(feature), maxPets(), clear()
};
```

Events: `user:changed`, `profile:changed`, `pets:changed`, `activePet:changed`, `logs:changed`, `tier:changed`, `state:cleared`

---

## Security Notes

- **Paystack secret key** (`sk_live_...`) stored in `.env` / Vercel env vars — never exposed to client
- **OpenRouter API key** (`sk-or-v1-...`) stored in `.env` / Vercel env vars — all AI requests go through serverless functions; no client-side fallback
- **Supabase anon key** is public by design — RLS protects all data
- **Supabase service role key** used in serverless functions (`signup-setup`, `verify-sitter`, `sitter-logs`, `sitter-log`, `chat-agent`, `paystack-webhook`, `manage-subscription`, coparent endpoints) to bypass RLS for operations that cross user boundaries or handle unauthenticated access
- All database queries go through Supabase SDK with RLS policies
- Sitter magic link access is secured by verifying `sitter_token` server-side before returning data; the token is a 32-char hex string stored on the `pets` record
- No data is ever sold. Third-party services: Supabase, Paystack, OpenRouter, Vercel

---

## Future Considerations / Known Gaps

- **Forgot Password / Reset Password** — implemented on auth.html: "Forgot password?" link opens inline reset form, user enters email → `resetPasswordForEmail()` sends Supabase reset link. Recovery auto-detected from URL hash (`type=recovery`), shows new-password form. Uses `supabase.auth.updateUser()` to apply new password.
- **Account Settings** — enhanced in dashboard Settings tab: profile name, change email (`updateUser({ email })` with dual confirmation), change password (re-authenticates then `updateUser({ password })`), notification preferences (4 toggles via `notification_preferences` JSONB on profiles), billing/subscription section (plan, next billing date, payment history table).
- **Billing & Subscription** — section in Settings shows plan, next billing date (`profiles.next_billing_date`), Paystack subscription management button, and payment history from `payment_history` table. `migration-account-billing.sql` adds columns/tables.

- **Subscription management portal** — implemented via `/api/manage-subscription` which generates a Paystack subscription management link. Users can cancel, pause, or update payment method via the Paystack portal opened in a new tab. "Switch to [Plan]" buttons in the pricing modal allow changing to a different tier via a new subscription checkout. Subscription code is stored in `profiles.subscription_code` and populated by the webhook on successful payment events.
- **Email notifications** — implemented via `/api/send-email` (Brevo). Sends: sitter invites, location alerts, support replies, welcome emails, subscription confirmations. Falls back silently if email API is unavailable.
- **Image upload** — symptom/grooming photo fields exist in UI structure but no actual upload logic
- **Sitter location alert** — `sendLocationAlert()` accepts optional `ownerEmail` and `petName` params. QR scanner page (`public-profile.html`) passes the owner's email from the public view. A new SECURITY DEFINER function `get_public_pet_profile` in Supabase provides anonymous access to pet profile + owner email for unauthenticated QR scanners. Falls back to `vw_public_pet_profiles` view, then `public_pet_profiles` table. Sends Brevo email with Google Maps link.
- **Co-parent system** — implemented via `co_parents` + `co_parent_invites` tables with full RLS. SECURITY DEFINER function `accept_co_parent_invite` handles acceptance atomically (validates, marks used, inserts relationship). Serverless endpoints `POST /api/create-coparent-link` (generates one-time token, checks tier limits, uses `crypto.randomBytes` for token) and `POST /api/accept-coparent-invite` (validates token, creates relationship). Both use static `import` from `@supabase/supabase-js` (requires `api/package.json` with `"type": "module"`). `coparent-accept.html` page with Vercel rewrite `/coparent`. Auth page uses `getRedirectUrl()` with `?redirect=` param so the user returns to `/coparent?token=...` after signup. Dashboard has a "Co-parents" tab (Family tier+) with per-pet management: generate links, copy/share, revoke, view co-parent list, remove co-parents. `loadDashboard()` fetches both owned and co-parented pets (marked with `_coparent` flag). RLS policies allow co-parents to read/write to `pet_logs` and `food_logs` for shared pets. Co-parent count limits enforced server-side and client-side: Family = 3, Pro = unlimited.
- **AI report** — client-side fallback removed. All AI report requests go through `/api/ai-report` serverless function with multi-model fallback chain (deepseek → qwen → gemma). OpenRouter API key is only stored server-side as `OPENROUTER_KEY` env var. Client never has access to it.
- **AI Assistant** — chat-based assistant in the dashboard accessible to all tiers (Basic+: read-only, Family+: can log to timeline). Uses `POST /api/chat-agent` which calls `alibaba/qwen-3.6-plus:free`. System prompt includes pet context (today's logs, 7-day history, food logs, medications). Model outputs JSON actions; `log_timeline` actions are executed server-side for Family+ users using the service role key. Chat UI uses bubble layout with robot head icon in sidebar and mobile nav.
- **Analytics / telemetry** — implemented via `js/analytics.js` and `/api/analytics` serverless function. Tracks: page views, dashboard feature usage (tab switches), uncaught errors. Uses a `analytics_events` Supabase table for storage. Cookie consent banner shown on first visit with Accept/Decline. Analytics only fire after consent is given. Opt-out is permanent until browser data is cleared.
- **PWA / offline** — implemented via `sw.js` service worker with cache-first strategy for static assets (HTML, CSS, JS, icons, manifest) and network-only for API calls. Pre-caches core files on install. CDN scripts (jsdelivr, Paystack) cached for offline resilience. Web App Manifest (`manifest.json`) with SVG icons (192/512/maskable), `display: standalone`, orange theme color. SVG favicon. iOS PWA meta tags (`apple-mobile-web-app-capable`, `apple-touch-icon`). Service worker registered on all 8 HTML pages.
- **Mobile app** — not implemented (responsive web only)
- **Internationalization** — English only, hardcoded
- **QR tags** — under reconstruction. Dashboard shows placeholder card. Planned: better scan reliability, printable collar tags, instant GPS alerts.
- **Landing page design** — moderate font sizes throughout (h1 2.2rem/2.8rem, body 0.78–0.95rem), handcrafted HTML/CSS dashboard mockup replaces the corgi photo and the old AI-generated-looking preview, builder story section with founder name and avatar placeholder, "and counting" added to the 12-countries stat
