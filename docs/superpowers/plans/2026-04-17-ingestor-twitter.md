# Twitter / Social Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the existing `ingestor_social` service to the X API, add daily quota protection (300 tweets/day), and add a `TweetModal` popup to `SocialPage.jsx` matching the UX of `NewsPage`.

**Architecture:** The `ingestor_social` service, `social_posts` table, API endpoints (`/api/social/feed`, `/api/social/accounts`), `useSocialFeed` hook, and `SocialPage` already exist and are wired together. Three gaps remain: (1) the env-var name mismatch between `.env` and `docker-compose.yml`, (2) no daily quota guard in the ingestor loop, (3) no modal in `SocialPage`.

**Tech Stack:** Python asyncio + httpx + redis.asyncio (ingestor), React 18 + inline styles (frontend). No new dependencies needed.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `.env` | Modify | Add `X_BEARER_TOKEN` alias pointing to the bearer token value |
| `services/ingestor_social/main.py` | Modify | Add `check_quota` / `increment_quota` helpers and quota guard in the polling loop |
| `services/ingestor_social/test_parse.py` | Modify | Add tests for quota helpers |
| `frontend/src/pages/SocialPage.jsx` | Modify | Add `TweetModal` component and click handler on `TweetCard` |

---

## Task 1: Fix env-var alignment

`docker-compose.yml` passes `X_BEARER_TOKEN: ${X_BEARER_TOKEN:-}` to `ingestor_social`, but `.env` only has `TWITTER_BEARER_TOKEN`. The ingestor reads `os.getenv("X_BEARER_TOKEN", "")` — without this fix it starts with an empty token and immediately exits.

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add `X_BEARER_TOKEN` to `.env`**

Open `.env` and add the following line directly below the existing `TWITTER_BEARER_TOKEN` line:

```bash
X_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAAdK9AEAAAAAvTCtVd1f2BlS1dZIl30pWSEMV18%3DtHVpuYKQ6pTiZFz3jtym2Wn9qOzmbdcULSWQ6qz4DUFhAHMITy
```

Also add the poll interval variable so the service respects it:

```bash
SOCIAL_POLL_INTERVAL=3600
```

- [ ] **Step 2: Verify docker-compose reads it**

```bash
docker compose config | grep X_BEARER_TOKEN
```

Expected output contains:
```
X_BEARER_TOKEN: AAAAAAAAAA...
```

- [ ] **Step 3: Commit**

```bash
git add .env
git commit -m "fix(social): wire X_BEARER_TOKEN and SOCIAL_POLL_INTERVAL to ingestor_social"
```

---

## Task 2: Add daily quota guard to ingestor_social

The X API Basic plan allows ~10,000 tweet reads/month (~333/day). The ingestor must stop storing tweets once it hits the daily cap to avoid exhausting the quota.

**Files:**
- Modify: `services/ingestor_social/main.py`
- Modify: `services/ingestor_social/test_parse.py`

- [ ] **Step 1: Write failing tests for quota helpers**

Add to `services/ingestor_social/test_parse.py`:

```python
import asyncio
from unittest.mock import AsyncMock, MagicMock


# ── Quota helpers (copied from main.py once implemented) ──────────────────────

DAILY_CAP = 300


async def get_quota(redis, cap: int = DAILY_CAP) -> tuple[int, bool]:
    """Returns (current_count, cap_reached)."""
    from datetime import datetime, timezone
    key = f"twitter:quota:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    val = await redis.get(key)
    count = int(val) if val else 0
    return count, count >= cap


async def increment_quota(redis) -> int:
    """Increments today's quota counter. Returns new count."""
    from datetime import datetime, timezone
    key = f"twitter:quota:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 90000)  # 25h TTL
    return count


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_quota_under_cap():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value="50")
    count, reached = asyncio.run(get_quota(redis, cap=300))
    assert count == 50
    assert reached is False


def test_quota_at_cap():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value="300")
    count, reached = asyncio.run(get_quota(redis, cap=300))
    assert count == 300
    assert reached is True


def test_quota_over_cap():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value="301")
    count, reached = asyncio.run(get_quota(redis, cap=300))
    assert reached is True


def test_quota_no_key_returns_zero():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    count, reached = asyncio.run(get_quota(redis, cap=300))
    assert count == 0
    assert reached is False


def test_increment_quota_sets_ttl_on_first():
    redis = AsyncMock()
    redis.incr = AsyncMock(return_value=1)
    redis.expire = AsyncMock()
    result = asyncio.run(increment_quota(redis))
    assert result == 1
    redis.expire.assert_called_once()


def test_increment_quota_no_ttl_after_first():
    redis = AsyncMock()
    redis.incr = AsyncMock(return_value=2)
    redis.expire = AsyncMock()
    asyncio.run(increment_quota(redis))
    redis.expire.assert_not_called()
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/ingestor_social && python -m pytest test_parse.py -v -k "quota"
```

Expected: 6 tests FAIL with `ImportError` or `NameError`.

- [ ] **Step 3: Add quota helpers and guard to `main.py`**

Add the following after the module-level constants (after `POLL_INTERVAL = ...`):

```python
DAILY_CAP = int(os.getenv("TWITTER_DAILY_CAP", "300"))
```

Add the two helper functions after `load_accounts()`:

```python
async def get_quota(redis, cap: int = DAILY_CAP) -> tuple[int, bool]:
    from datetime import timezone
    key = f"twitter:quota:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    val = await redis.get(key)
    count = int(val) if val else 0
    return count, count >= cap


async def increment_quota(redis) -> int:
    from datetime import timezone
    key = f"twitter:quota:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 90000)
    return count
```

In `publish()`, after `await redis.setex(key, 86400, payload)`, add:

```python
    await increment_quota(redis)
```

At the top of the `while True:` loop in `main()`, before iterating over accounts, add:

```python
            count, reached = await get_quota(redis)
            if reached:
                log.warning(f"Cuota diaria alcanzada ({count}/{DAILY_CAP}) — esperando hasta mañana")
                await asyncio.sleep(3600)
                continue
```

- [ ] **Step 4: Run all tests — expect PASS**

```bash
cd services/ingestor_social && python -m pytest test_parse.py -v
```

Expected: all tests PASS (existing 5 + new 6 = 11 total).

- [ ] **Step 5: Commit**

```bash
git add services/ingestor_social/main.py services/ingestor_social/test_parse.py
git commit -m "feat(social): add daily quota guard (300 tweets/day cap)"
```

---

## Task 3: Add TweetModal to SocialPage

`SocialPage.jsx` has a `TweetCard` that links directly to X. Add a `TweetModal` component — same pattern as `NewsModal` in `NewsPage.jsx` — that opens when a card is clicked, showing full tweet content, media (photo or video thumbnail with play overlay), metrics, and a link to X.

**Files:**
- Modify: `frontend/src/pages/SocialPage.jsx`

- [ ] **Step 1: Add `TweetModal` component**

Insert the following component just before the `TweetCard` function definition (around line 86):

```jsx
// ── Modal ──────────────────────────────────────────────────────────────────────

function TweetModal({ post, onClose }) {
  const color = CAT_COLOR[post.category] || '#888'
  const initial = (post.handle || '?')[0].toUpperCase()
  const pubDate = post.time
    ? new Date(post.time).toLocaleString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : ''

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '580px',
          background: 'var(--bg-1)',
          border: `1px solid ${color}33`,
          borderTop: `4px solid ${color}`,
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: '85vh',
        }}
      >
        {/* Media */}
        {post.media_url && post.media_type === 'photo' && (
          <div style={{ width: '100%', maxHeight: '260px', overflow: 'hidden', flexShrink: 0 }}>
            <img
              src={post.media_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
            />
          </div>
        )}
        {post.media_url && post.media_type !== 'photo' && (
          <a
            href={post.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', position: 'relative', flexShrink: 0 }}
          >
            <img
              src={post.media_url} alt=""
              style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block', opacity: 0.75 }}
              onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: '32px', background: 'rgba(0,0,0,0.6)',
                borderRadius: '50%', width: '56px', height: '56px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>▶</span>
            </div>
          </a>
        )}

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: `${color}22`, border: `1px solid ${color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: '700', color,
            }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--txt-1)', fontFamily: 'var(--mono)' }}>
                {post.display || post.handle}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
                @{post.handle} · {pubDate}
              </div>
            </div>
            <span style={{
              fontSize: '8px', fontWeight: '700', letterSpacing: '.08em',
              padding: '2px 7px', borderRadius: '2px',
              background: `${color}18`, color, border: `1px solid ${color}44`,
              fontFamily: 'var(--mono)', flexShrink: 0,
            }}>
              {CAT_LABELS[post.category] || post.category}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--txt-3)',
                cursor: 'pointer', fontSize: '18px', lineHeight: 1,
                padding: '2px 6px', flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* Tweet text */}
          <div style={{
            fontSize: '14px', color: 'var(--txt-1)', lineHeight: 1.65,
            marginBottom: '20px', wordBreak: 'break-word',
          }}>
            {post.content}
          </div>

          {/* Metrics */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            marginBottom: '20px',
            fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt-3)',
          }}>
            <span>❤ {(post.likes || 0).toLocaleString()}</span>
            <span>🔁 {(post.retweets || 0).toLocaleString()}</span>
          </div>

          {/* Link */}
          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '8px 20px',
                background: 'rgba(0,200,255,0.1)',
                border: '1px solid rgba(0,200,255,0.35)',
                borderRadius: '2px',
                color: 'var(--cyan)',
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '.1em',
                textDecoration: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,200,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,200,255,0.1)'}
            >
              VER EN X ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `useEffect` import and modal state**

`SocialPage.jsx` currently imports only `useState` and `useMemo`. Update the import line:

```jsx
import { useState, useMemo, useEffect } from 'react'
```

- [ ] **Step 3: Make `TweetCard` clickable and add modal state**

Replace the current `TweetCard` function signature and outer `<div>` to accept an `onClick` prop:

```jsx
function TweetCard({ post, onClick }) {
  const color = CAT_COLOR[post.category] || '#888'
  return (
    <div
      onClick={onClick}
      style={{
        padding: '11px 14px',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: '3px',
        marginBottom: '6px',
        transition: 'border-color .15s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,200,255,0.2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
```

- [ ] **Step 4: Add modal state and render in `SocialPage`**

In the `SocialPage` function, add modal state next to the existing state declarations:

```jsx
const [modalPost, setModalPost] = useState(null)
```

Add the modal render at the top of the returned JSX, just before the outer `<div>`:

```jsx
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {/* Modal */}
      {modalPost && (
        <TweetModal post={modalPost} onClose={() => setModalPost(null)} />
      )}
```

Update the `TweetCard` call in the `filtered.map(...)` to pass `onClick`:

```jsx
{filtered.map(post => (
  <TweetCard
    key={post.tweet_id}
    post={post}
    onClick={() => setModalPost(post)}
  />
))}
```

- [ ] **Step 5: Verify in browser**

Start the frontend dev server:

```bash
cd frontend && npm run dev
```

Navigate to the Social tab. Click any tweet card — the modal should open with header, media (if any), full tweet text, metrics, and "VER EN X ↗" button. Press Escape or click outside to close.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SocialPage.jsx
git commit -m "feat(social): add TweetModal popup matching NewsPage UX"
```

---

## Task 4: Update `.env.example` to document X variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add X API section to `.env.example`**

Add after the existing Telegram section:

```bash
# ── X (Twitter) API ───────────────────────────────────
# Registro: https://developer.x.com — Plan Basic requerido para lectura
# El ingestor social lee X_BEARER_TOKEN (nombre usado por docker-compose)
TWITTER_CONSUMER_KEY=
TWITTER_CONSUMER_SECRET=
TWITTER_BEARER_TOKEN=
X_BEARER_TOKEN=          # igual que TWITTER_BEARER_TOKEN
SOCIAL_POLL_INTERVAL=3600
TWITTER_DAILY_CAP=300
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document X API env vars in .env.example"
```
