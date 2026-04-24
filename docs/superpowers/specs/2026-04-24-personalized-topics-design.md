# Personalized Topics — Design Spec

## Goal

Allow users to subscribe to a set of topics (e.g. "oil", "Nvidia", "Taiwan Strait") so that all
content — news, intel findings, social feed, Telegram alerts — is filtered and prioritized around
those topics. A "My feed" toggle lets them switch between personalized and full views at any time.

---

## Section 1 — Data Model

### Topic catalog (`config/topics.yaml`)

Approximately 70 predefined topics organized in four categories:

```yaml
topics:
  - id: petroleo
    label_es: Petróleo
    label_en: Oil
    type: commodity          # commodity | sector | company | zone
    keywords: ["crude oil", "WTI", "Brent", "OPEC", "petróleo", "crudo"]

  - id: nvidia
    label_es: Nvidia
    label_en: Nvidia
    type: company
    keywords: ["NVDA", "Nvidia", "Jensen Huang", "GPU", "H100"]

  - id: taiwan_strait
    label_es: Estrecho de Taiwán
    label_en: Taiwan Strait
    type: zone
    keywords: ["Taiwan", "Taiwán", "PLAN", "PLA Navy", "Strait", "TSMC"]
  # ... ~67 more
```

Categories:
- **Sectors** (~20): energy, defense, technology, finance, food security, semiconductors…
- **Commodities** (~20): oil, gas, wheat, copper, lithium, gold…
- **Companies** (~15): Nvidia, Lockheed, Shell, TSMC, Aramco…
- **Zones** (~15): Taiwan Strait, Persian Gulf, Black Sea, South China Sea, Arctic…

### Database changes

**`users` table** — two new columns:
```sql
ALTER TABLE users ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
-- plan: 'free' | 'scout' | 'analyst' | 'pro'
```

**`user_topics` table** (new):
```sql
CREATE TABLE user_topics (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id   TEXT    NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, topic_id)
);
```

**`agent_findings` table** — add topics column:
```sql
ALTER TABLE agent_findings ADD COLUMN topics TEXT[] DEFAULT '{}';
```

**`analyzed_events` table** — add topics column:
```sql
ALTER TABLE analyzed_events ADD COLUMN topics TEXT[] DEFAULT '{}';
```

**`news_events` table** — add topics column:
```sql
ALTER TABLE news_events ADD COLUMN topics TEXT[] DEFAULT '{}';
```

### Plan limits

| Plan     | Max topics |
|----------|-----------|
| free     | 2         |
| scout    | 5         |
| analyst  | 20        |
| pro      | unlimited |

---

## Section 2 — Agent Engine Tagging

Topic tagging is applied **post-hoc** via keyword matching — no additional LLM call, no extra cost.

### Tagging function

A shared utility `tag_topics(text: str, catalog: list[dict]) -> list[str]`:
```python
def tag_topics(text: str, catalog: list[dict]) -> list[str]:
    text_lower = text.lower()
    return [
        t["id"] for t in catalog
        if any(kw.lower() in text_lower for kw in t["keywords"])
    ]
```

Applied to:
- `agent_findings.raw_output` — tagged after each agent writes its finding
- `analyzed_events.raw_output` — tagged after master writes its synthesis
- `news_events.content + title` — tagged at ingest time by `ingestor_news`

### Telegram personalization

After the existing global Telegram message is sent, agent_engine queries users with
`telegram_chat_id IS NOT NULL` and sends a personalized message to each user whose
`user_topics` intersect with the finding's `topics` array. Only findings with
`anomaly_score >= 7` trigger personal notifications.

Personal message footer: `🎯 Topics: oil, nvidia` — so the user knows why they received it.

If a user has no topics configured, they receive no personal Telegram messages (they rely
on the global channel or check the app).

---

## Section 3 — API Layer

### New endpoints

**Topic catalog (public)**
```
GET /api/topics
→ { topics: [ { id, label_es, label_en, type } ] }
```

**User topic management (authenticated)**
```
GET  /api/me/topics
→ { topics: ["petroleo", "nvidia"], limit: 5, plan: "scout" }

PUT  /api/me/topics
body: { topics: ["petroleo", "nvidia"] }
→ 200 OK | 400 { error: "exceeds_plan_limit", limit: 5 }
```

**Telegram configuration (authenticated)**
```
GET  /api/me/telegram
→ { chat_id: "123456789", configured: true }

PUT  /api/me/telegram
body: { chat_id: "123456789" }
→ 200 OK

POST /api/me/telegram/test
→ sends "✅ Qilin alert test — your notifications are working." to saved chat_id
→ 200 OK | 400 { error: "no_chat_id" }
```

### Modified endpoints

Existing feed endpoints accept an optional `?topics_only=true` query param. When present,
results are filtered to items whose `topics` array intersects with the authenticated user's
subscribed topics. Items with empty `topics` array are excluded in filtered mode.

Affected endpoints:
- `GET /api/news/feed?topics_only=true`
- `GET /api/intel/timeline?topics_only=true`
- `GET /api/social/feed?topics_only=true`

The `/api/me` endpoint is extended to include `topics` and `telegram_configured` in its
response so the frontend avoids extra round-trips on load.

### Cache behavior

- `GET /api/topics` — cacheable, TTL 3600s (catalog changes infrequently)
- `/api/me/topics`, `/api/me/telegram` — NOT cached (`no-store`, per-user)
- Feed endpoints with `?topics_only=true` — NOT cached (per-user, different result per user)
- Feed endpoints without `?topics_only=true` — cached as today (no change)

---

## Section 4 — Frontend

### TopicSelector component (`src/components/TopicSelector.jsx`)

Chip-grid organized by category. Props:
```jsx
<TopicSelector
  selected={["petroleo", "nvidia"]}   // current selection
  limit={5}                            // from plan
  onChange={(topics) => {}}            // fires on every change
  catalog={topics}                     // from GET /api/topics
/>
```

- Chips are visually disabled (greyed, no click) once `selected.length >= limit`
- Selected chips show a checkmark + filled background
- Category headers group the chips: SECTORS / COMMODITIES / COMPANIES / ZONES
- Localized labels via `useLang()` (uses `label_en` or `label_es` based on lang)

### "My feed" toggle in TopBar

A compact toggle button positioned next to the ES|EN toggle:
```
[ MY FEED ● ]   ←→   [ ALL FEED ○ ]
```

State lives in `App.jsx`: `const [topicsOnly, setTopicsOnly] = useState(false)`.

Initialization: after the user profile loads, if `user.topics.length > 0` → set `topicsOnly = true`.
If no topics are configured, the toggle is hidden (nothing to filter).

`topicsOnly` is passed as prop down to the pages that support filtering.

### Pages affected

- **NewsPage** — `useNewsFeed({ topicsOnly })` adds `?topics_only=true` when enabled
- **IntelPage** — `useIntelTimeline({ topicsOnly })` adds `?topics_only=true` when enabled
- **SocialPage** — `useSocialFeed({ topicsOnly })` adds `?topics_only=true` when enabled
- **MarketsPage** — no change (real-time quotes, topic filtering not applicable)
- **PolymarketPage** — no change (prediction markets, topic filtering not applicable)

When `topicsOnly = true` and results come back empty, each page shows a friendly empty state:
> "No content matches your topics. Toggle off 'My feed' to see everything."

### ProfilePage — new sections

**My Topics section**
- Displays `TopicSelector` with current selection and plan limit
- "Save" button calls `PUT /api/me/topics`
- Shows plan name + limit: "Scout plan · 5 topics max · Upgrade"

**Telegram Notifications section**
- Input field for `chat_id`
- Helper text with step-by-step: "1. Open Telegram · 2. Search @QilinAlertBot · 3. Send /start · 4. Copy your chat ID here"
- "Send test message" button → calls `POST /api/me/telegram/test`
- Success/error inline feedback

---

## Section 5 — Telegram Setup & Registration Onboarding

### Bot setup flow

1. User opens Telegram and searches for `@QilinAlertBot`
2. Sends `/start`
3. Bot replies: "Your chat ID is: `123456789` — paste this in your Qilin profile to receive alerts."
4. User copies the ID, pastes it in ProfilePage or the registration wizard

The bot needs one new command handler: `/start` → reply with `Your chat ID is: {message.chat.id}`.

### Multi-step registration wizard

The `RegisterPage` becomes a 3-step wizard:

**Step 1 — Account**
Username, email, password (same as today). "Continue →"

**Step 2 — My Topics**
Full `TopicSelector` component. Shows plan limit (all new users start on `free` → 2 topics).
"Skip for now" link + "Continue →" button (enabled even with 0 topics selected).

**Step 3 — Telegram Alerts**
Single `chat_id` input field + the same bot instructions as ProfilePage.
"Skip for now" link + "Finish →" button.

On "Finish →": the account is created (same `POST /api/auth/register` call), topics and
`chat_id` are saved if provided (calls `PUT /api/me/topics` and `PUT /api/me/telegram`
immediately after login).

Step indicator shown at top: `① Account  ② Topics  ③ Telegram`.

---

## Section 6 — CLAUDE.md Updates

After implementation, update CLAUDE.md to reflect:
- New API endpoints (`/api/topics`, `/api/me/topics`, `/api/me/telegram`, `/api/me/telegram/test`)
- New DB columns (`users.telegram_chat_id`, `users.plan`, `user_topics` table)
- New DB columns on findings/events (`topics TEXT[]`)
- `config/topics.yaml` added to configuration files
- Cache TTL entry for `/api/topics`

---

## Architecture Summary

```
config/topics.yaml
       │
       ▼
agent_engine ──► tag_topics() ──► agent_findings.topics[]
                                ──► analyzed_events.topics[]
                                ──► personalized Telegram per user

ingestor_news ──► tag_topics() ──► news_events.topics[]

API:
  GET /api/topics              (catalog)
  GET/PUT /api/me/topics       (user subscriptions)
  GET/PUT /api/me/telegram     (chat_id)
  GET /api/news/feed?topics_only=true  (filtered)
  GET /api/intel/timeline?topics_only=true
  GET /api/social/feed?topics_only=true

Frontend:
  TopBar → "My feed" toggle (topicsOnly bool)
  TopicSelector chip-grid component
  ProfilePage → Topics + Telegram sections
  RegisterPage → 3-step wizard
  NewsPage / IntelPage / SocialPage → consume topicsOnly prop
```

---

## Files to Create

| File | Description |
|------|-------------|
| `config/topics.yaml` | Topic catalog (~70 topics with keywords) |
| `frontend/src/components/TopicSelector.jsx` | Chip-grid selector component |
| `services/api/topic_utils.py` | `tag_topics()` shared utility |

## Files to Modify

| File | Change |
|------|--------|
| `services/api/main.py` | New `/topics`, `/me/topics`, `/me/telegram` endpoints; `topics_only` filter on feeds |
| `services/api/init.sql` | New columns + `user_topics` table |
| `services/agent_engine/main.py` | Call `tag_topics()` on findings; personalized Telegram loop |
| `services/ingestor_news/main.py` | Call `tag_topics()` on each news item at ingest |
| `frontend/src/App.jsx` | `topicsOnly` state; toggle init from profile |
| `frontend/src/components/TopBar.jsx` | "My feed" toggle widget |
| `frontend/src/pages/ProfilePage.jsx` | Topics + Telegram sections |
| `frontend/src/pages/RegisterPage.jsx` | 3-step wizard |
| `frontend/src/pages/NewsPage.jsx` | Accept + pass `topicsOnly` prop |
| `frontend/src/pages/IntelPage.jsx` | Accept + pass `topicsOnly` prop |
| `frontend/src/pages/SocialPage.jsx` | Accept + pass `topicsOnly` prop |
| `frontend/src/hooks/useNewsFeed.js` | Accept `topicsOnly` param |
| `frontend/src/hooks/useIntelTimeline.js` | Accept `topicsOnly` param |
| `frontend/src/hooks/useSocialFeed.js` | Accept `topicsOnly` param |
| `CLAUDE.md` | Document new endpoints, tables, env vars |

---

## Testing

Each task includes tests at the appropriate layer:

- **Backend unit**: `tag_topics()` with known inputs/outputs
- **API integration**: `PUT /api/me/topics` with over-limit payload → 400; valid payload → 200
- **API integration**: `GET /api/news/feed?topics_only=true` returns only matching items
- **API integration**: `POST /api/me/telegram/test` with no `chat_id` → 400
- **Frontend**: `TopicSelector` chip interactions (select, deselect, limit enforcement)
- **Frontend**: "My feed" toggle shows/hides correctly; empty state when no results

---

## Deployment

1. Run DB migrations (new columns + `user_topics` table) on TimescaleDB
2. Deploy `config/topics.yaml` to the VPS alongside the updated services
3. Rebuild and redeploy: `docker compose build api agent-engine ingestor-news && docker compose up -d`
4. Deploy frontend: `npm run build` → push `dist/` to VPS
