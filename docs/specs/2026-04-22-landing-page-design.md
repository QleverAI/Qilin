# Qilin Landing Page — Design Spec
_Date: 2026-04-22_

## Overview

A public-facing marketing landing page for Qilin, replacing the current direct-login entry point. Includes login, registration, pricing, and a public chatbot. Style: dark Navy + Gold, satellite imagery, Palantir-inspired.

---

## Architecture

**Approach: React Router (react-router-dom v6)**

Add routing to the existing Vite/React frontend. The current `App.jsx` conditional-view pattern is refactored into proper routes.

```
/              → LandingPage   (public)
/login         → LoginPage     (public)
/register      → RegisterPage  (public)
/app           → AppShell      (requires auth → redirects to /login)
/app/tactical  → TacticalView
/app/news      → NewsPage
/app/social    → SocialPage
/app/documents → DocumentsPage
/app/markets   → FilingsPage
/app/polymarket→ PolymarketPage
/app/home      → HomePage
```

`/app` uses a `<ProtectedRoute>` wrapper: if no valid JWT in sessionStorage, redirect to `/login` with `?next=/app`.

After login/register success, redirect to `/app`.

---

## Pages

### LandingPage (`/`)

Single-page scroll layout. Sections in order:

1. **Nav** — fixed, blur backdrop. Logo `◈ QILIN`, links (Plataforma, Precios, Contacto), CTA buttons (Iniciar sesión → `/login`, Comenzar → `/register`).

2. **Hero** — full-viewport. Background: satellite photo of Earth from space (Unsplash, static import or CDN). Dark overlay + gold radial glow. Badge with live aircraft count (fetched from public `/api/stats` endpoint — no auth). Headline: *"Ve lo que otros no ven."* gold em. Subheadline. Two CTAs: "Solicitar acceso" → `/register`, "Ver demo en vivo" (scrolls to features or links to a public demo video — placeholder for now).

3. **Stats Bar** — 5 metrics. Aircraft count is live from `/api/stats`; others are static marketing numbers (340+, 70+, 500+, 300+, 24/7). Updating the live count every 30s via polling.

4. **Features Grid** — 3×2 grid. Six capability cards: Vigilancia Aérea, Tráfico Naval, Alertas con IA, Señales Satelitales, Inteligencia de Medios, Mercados de Predicción. **No data source attribution anywhere.** "Aviones privados" not "VIP".

5. **Satellite Callout** — full-width section with Earth-at-night background (city lights). Left-aligned text about atmospheric anomaly detection. No specific satellite names or agencies mentioned.

6. **Plans** — three cards: Scout ($0), Analyst ($49/mo), Command ($199/mo). Rounded cards (border-radius 12px). "Más popular" badge on Analyst. Plan features use ✓/✗. CTAs: Scout → `/register`, Analyst → `/register?plan=analyst`, Command → contact form (mailto or placeholder).

7. **Footer** — logo, links (Términos, Privacidad, Contacto, Status), copyright.

8. **Chatbot Qilin** — floating bottom-right. Always visible on `/`. Rounded design (20px radius panel, circular FAB). Public endpoint `/api/chat/public` (no auth required, rate-limited by IP to 20 req/hour). System prompt restricted to Qilin platform topics + plan info. Full conversation history in component state.

---

### LoginPage (`/login`)

Minimal centered card on dark background (reuse existing `LoginPage.jsx` canvas animation). Fields: username, password. Submit → `POST /auth/login`. On success: store JWT in sessionStorage, redirect to `/app` (or `?next` param). Link to `/register`.

---

### RegisterPage (`/register`)

Same visual style as LoginPage. Fields: username, email, password, confirm password. Client-side validation (passwords match, min 8 chars). Submit → `POST /auth/register`. On success: auto-login (store JWT), redirect to `/app`. Optional: pre-select plan from `?plan=analyst` query param (shown as highlighted choice on the page).

---

## Backend Changes

### New endpoint: `POST /auth/register`

```
Body:   { username: str, email: str, password: str }
Returns: { access_token: str, token_type: "bearer" }
Errors:  409 if username already exists
         422 if validation fails
```

Stores user in new `users` DB table. Password hashed with bcrypt (12 rounds). Login endpoint (`POST /auth/login`) checks `users` table first, then falls back to existing `AUTH_USER_N` env vars for backwards compatibility.

**New DB table:**
```sql
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'scout',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### New endpoint: `GET /api/stats` (public, no auth)

Returns basic platform stats for the landing page hero and stats bar:
```json
{ "aircraft_active": 340, "updated_at": "2026-04-22T12:00:00Z" }
```
Reads `aircraft_active` from a Redis key updated by `ingestor-adsb` on each cycle. Rate-limited, no sensitive data.

### New endpoint: `POST /api/chat/public` (no auth, IP rate-limited)

Same as existing `/api/chat` but:
- No JWT required
- Rate-limited to 20 requests/hour per IP (tracked in Redis)
- System prompt includes plan information and focuses on sales/onboarding context

---

## Frontend File Structure

New/changed files:
```
frontend/src/
  main.jsx                    ← add BrowserRouter
  App.jsx                     ← refactor to use Routes/Route
  components/
    ProtectedRoute.jsx        ← NEW: redirects to /login if no token
    ChatBotPublic.jsx         ← NEW: landing chatbot (public endpoint)
  pages/
    LandingPage.jsx           ← NEW: full landing page
    RegisterPage.jsx          ← NEW: registration form
    LoginPage.jsx             ← existing, minor update (add link to /register)
```

All existing app pages remain under `/app/*` routes, wrapped by `ProtectedRoute`.

---

## Visual Design

**Palette:**
- Background: `#02060e` (hero), `#040c18` (sections), `#071020` (featured cards)
- Gold accent: `#c8a03c` (base), `#e8c060` (light), `rgba(200,160,60,0.55)` (dim)
- Text: `#f0f4f8` (primary), `rgba(220,230,245,0.6)` (secondary), `rgba(220,230,245,0.3)` (muted)
- Border: `rgba(200,160,60,0.12)` (subtle), `rgba(200,160,60,0.35)` (hover)

**Typography:** System UI sans-serif for body; `IBM Plex Mono` for labels, nav, badges, eyebrows.

**Imagery:** Two Unsplash satellite photos (static imports bundled at build time, not CDN references in production):
- Hero: Earth from space (blue marble)
- Callout: Earth at night (city lights)

**Chatbot:** `border-radius: 20px` panel, `border-radius: 50%` FAB button, bubble-style messages (iMessage-inspired).

---

## Constraints

- No mention of specific data source providers anywhere on the public page
- "Aviones privados" throughout — never "VIP aircraft" or "VIP" in user-facing copy
- No mention of specific satellite programs, agencies, or atmospheric compounds in public copy
- The `/api/stats` endpoint returns only aircraft count — no sensitive operational data
- Registration does not grant immediate full access — plan defaults to `scout`

---

## Out of Scope (this sprint)

- Payment processing (Stripe integration) — future sprint
- Email verification on registration
- Password reset flow
- Plan enforcement in the API (all authenticated users currently get full access)
- Blog, docs, or additional public pages
- SEO / meta tags optimization
