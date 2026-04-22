# Tactical Panel + Aircraft Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tactical map's right panel (FilterPanel + AlertPanel) with a new TacticalPanel showing aircraft details on click (no popup) and a persistent per-user favorites list.

**Architecture:** New `user_favorites` DB table + 3 REST endpoints. Frontend: `useFavorites` hook with optimistic updates, `TacticalPanel` component, `selectedAircraft` state in App.jsx, MapView stops showing popups and calls `onSelectAircraft` instead.

**Tech Stack:** FastAPI + asyncpg, React 18, CSS-in-JS inline styles (existing pattern).

---

## File Map

**Create:**
- `frontend/src/components/TacticalPanel.jsx` — replaces FilterPanel + AlertPanel in tactical layout
- `frontend/src/hooks/useFavorites.js` — fetch/add/remove favorites with optimistic updates

**Modify:**
- `db/init.sql` — add `user_favorites` table
- `services/api/main.py` — add FavoriteRequest model + 3 endpoints
- `frontend/src/hooks/apiClient.js` — extend `apiFetch` to support method/body
- `frontend/src/components/MapView.jsx` — remove popup, add `onSelectAircraft` prop
- `frontend/src/App.jsx` — add `selectedAircraft` state, wire TacticalPanel, remove FilterPanel/AlertPanel

---

## Task 1: DB table + API endpoints + apiClient update

**Files:**
- Modify: `db/init.sql` (append after users table ~line 330)
- Modify: `services/api/main.py` (add model + 3 routes after `get_sentinel_zones`)
- Modify: `frontend/src/hooks/apiClient.js` (extend `apiFetch`)

- [ ] **Step 1: Add `user_favorites` table to `db/init.sql`**

Append after the users table block (after the `users_email_idx` index line):

```sql
CREATE TABLE IF NOT EXISTS user_favorites (
    username   TEXT        NOT NULL,
    icao24     TEXT        NOT NULL,
    callsign   TEXT,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, icao24)
);

CREATE INDEX IF NOT EXISTS favorites_username_idx ON user_favorites (username);
```

- [ ] **Step 2: Add `FavoriteRequest` model to `services/api/main.py`**

Find the block of Pydantic models near the top of the file (near `RegisterRequest`, `ChatRequest`). Add:

```python
class FavoriteRequest(BaseModel):
    callsign: str | None = None
```

- [ ] **Step 3: Add the 3 favorites endpoints to `services/api/main.py`**

After the `get_sentinel_zones` function, add:

```python
@app.get("/favorites")
async def get_favorites(user: str = Depends(get_current_user)):
    if not app.state.db:
        return []
    rows = await app.state.db.fetch(
        "SELECT icao24, callsign, added_at FROM user_favorites WHERE username=$1 ORDER BY added_at DESC",
        user,
    )
    return [
        {"icao24": r["icao24"], "callsign": r["callsign"], "added_at": r["added_at"].isoformat()}
        for r in rows
    ]


@app.post("/favorites/{icao24}")
async def add_favorite(icao24: str, req: FavoriteRequest, user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"ok": False}
    try:
        await app.state.db.execute(
            "INSERT INTO user_favorites (username, icao24, callsign) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            user, icao24.lower(), req.callsign,
        )
    except Exception as e:
        log.error(f"add_favorite error: {e}")
    return {"ok": True}


@app.delete("/favorites/{icao24}")
async def remove_favorite(icao24: str, user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"ok": False}
    await app.state.db.execute(
        "DELETE FROM user_favorites WHERE username=$1 AND icao24=$2",
        user, icao24.lower(),
    )
    return {"ok": True}
```

- [ ] **Step 4: Extend `apiFetch` in `frontend/src/hooks/apiClient.js`**

Current `apiFetch` (line 15):
```js
export async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
```

Replace with:
```js
export async function apiFetch(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: { ...authHeaders(), ...extraHeaders },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
```

- [ ] **Step 5: Commit**

```bash
git add db/init.sql services/api/main.py frontend/src/hooks/apiClient.js
git commit -m "feat(favorites): DB table, API endpoints, apiFetch options support"
```

---

## Task 2: `useFavorites` hook

**Files:**
- Create: `frontend/src/hooks/useFavorites.js`

- [ ] **Step 1: Create `frontend/src/hooks/useFavorites.js`**

```js
import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from './apiClient'

export function useFavorites() {
  const [favorites, setFavorites] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    apiFetch('/api/favorites')
      .then(data => setFavorites(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isFavorite = useCallback((icao24) => {
    if (!icao24) return false
    return favorites.some(f => f.icao24 === icao24.toLowerCase())
  }, [favorites])

  const toggleFavorite = useCallback(async (aircraft) => {
    const icao24   = (aircraft.id || aircraft.icao24 || '').toLowerCase()
    const callsign = aircraft.label || aircraft.callsign || icao24
    if (!icao24) return

    const already = favorites.some(f => f.icao24 === icao24)

    if (already) {
      // Optimistic remove
      setFavorites(prev => prev.filter(f => f.icao24 !== icao24))
      try {
        await apiFetch(`/api/favorites/${icao24}`, { method: 'DELETE' })
      } catch {
        // Revert
        setFavorites(prev => [...prev, { icao24, callsign, added_at: new Date().toISOString() }])
      }
    } else {
      // Optimistic add
      const entry = { icao24, callsign, added_at: new Date().toISOString() }
      setFavorites(prev => [entry, ...prev])
      try {
        await apiFetch(`/api/favorites/${icao24}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callsign }),
        })
      } catch {
        // Revert
        setFavorites(prev => prev.filter(f => f.icao24 !== icao24))
      }
    }
  }, [favorites])

  return { favorites, loading, isFavorite, toggleFavorite }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useFavorites.js
git commit -m "feat(favorites): useFavorites hook with optimistic updates"
```

---

## Task 3: `TacticalPanel` component

**Files:**
- Create: `frontend/src/components/TacticalPanel.jsx`

The panel has two sections:
1. **Aircraft detail** (top, shown when `selectedAircraft` is truthy) — scrollable, max 65% height
2. **Favorites** (bottom, always visible) — takes remaining space

The `selectedAircraft` object has these fields from MapView's GeoJSON feature properties:
`{ id, label, type, heading, speed, altitude, zone, origin_country, vip_owner, lon, lat }`

Bases from `/api/aircraft/{icao24}/bases`: `{ airfield_icao, airfield_name, visit_count, ... }`
Routes from `/api/aircraft/{icao24}/routes`: `{ origin_icao, dest_icao, origin_name, dest_name, flight_count }`

- [ ] **Step 1: Create `frontend/src/components/TacticalPanel.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { apiFetch } from '../hooks/apiClient'
import { useFavorites } from '../hooks/useFavorites'

const TYPE_META = {
  military: { label: 'MILITARY', color: '#f43f5e' },
  vip:      { label: 'VIP',      color: '#ffd60a' },
  civil:    { label: 'CIVIL',    color: '#4f9cf9' },
}

export default function TacticalPanel({
  selectedAircraft, onClose,
  trails, onAddTrail, onRemoveTrail,
  onFlyTo,
}) {
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const [bases,        setBases]        = useState([])
  const [routes,       setRoutes]       = useState([])
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [favOpen,      setFavOpen]      = useState(true)

  const icao24 = selectedAircraft?.id
  const hasTrail = !!(icao24 && trails[icao24])
  const tc = TYPE_META[selectedAircraft?.type] || TYPE_META.civil

  useEffect(() => {
    if (!icao24) { setBases([]); setRoutes([]); return }
    setLoadingExtra(true)
    Promise.all([
      apiFetch(`/api/aircraft/${icao24}/bases`).catch(() => []),
      apiFetch(`/api/aircraft/${icao24}/routes`).catch(() => []),
    ]).then(([b, r]) => {
      setBases(Array.isArray(b) ? b : [])
      setRoutes(Array.isArray(r) ? r : [])
    }).finally(() => setLoadingExtra(false))
  }, [icao24])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--bg-1)', overflow: 'hidden',
    }}>

      {/* ── Aircraft detail ── */}
      {selectedAircraft && (
        <div style={{
          borderBottom: '1px solid var(--border-md)',
          overflowY: 'auto', flexShrink: 0, maxHeight: '65%',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0,
          }}>
            <span style={{
              flex: 1, fontFamily: 'var(--mono)', fontWeight: 700,
              fontSize: 'var(--label-md)', color: 'var(--txt-1)',
              letterSpacing: '.06em', textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {selectedAircraft.label || selectedAircraft.id}
            </span>
            <span style={{
              fontSize: 'var(--label-sm)', fontWeight: 700,
              fontFamily: 'var(--mono)', padding: '1px 6px', borderRadius: 2,
              color: tc.color, background: `${tc.color}18`,
              border: `1px solid ${tc.color}44`, flexShrink: 0,
            }}>{tc.label}</span>
            <button
              onClick={() => toggleFavorite(selectedAircraft)}
              title={isFavorite(icao24) ? 'Quitar favorito' : 'Marcar favorito'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 17, lineHeight: 1, padding: '2px 4px',
                color: isFavorite(icao24) ? '#ffd60a' : 'var(--txt-3)',
                flexShrink: 0, transition: 'color .15s',
              }}
            >★</button>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--txt-3)',
                cursor: 'pointer', fontSize: 18, lineHeight: 1,
                padding: '2px 4px', flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* Body */}
          <div style={{ padding: '10px 14px' }}>
            {/* Metrics grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '6px 12px', marginBottom: 12,
            }}>
              {[
                { label: 'ALTITUD',   value: selectedAircraft.altitude != null ? `${selectedAircraft.altitude} ft` : '—' },
                { label: 'VELOCIDAD', value: selectedAircraft.speed     != null ? `${Math.round(selectedAircraft.speed)} kt` : '—' },
                { label: 'HEADING',   value: selectedAircraft.heading   != null ? `${selectedAircraft.heading}°` : '—' },
                { label: 'ZONA',      value: selectedAircraft.zone || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{
                    fontSize: 'var(--label-sm)', color: 'var(--txt-3)',
                    fontFamily: 'var(--mono)', marginBottom: 1,
                  }}>{label}</div>
                  <div style={{
                    fontSize: 'var(--label-md)', color: 'var(--txt-1)',
                    fontFamily: 'var(--mono)',
                  }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Trail button */}
            <button
              onClick={() => hasTrail ? onRemoveTrail(icao24) : onAddTrail(selectedAircraft)}
              style={{
                width: '100%', padding: '7px 0', marginBottom: 14,
                background: hasTrail ? 'rgba(79,156,249,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${hasTrail ? 'rgba(79,156,249,0.5)' : 'var(--border)'}`,
                borderRadius: 2,
                color: hasTrail ? 'var(--accent)' : 'var(--txt-2)',
                fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                fontWeight: 700, letterSpacing: '.1em', cursor: 'pointer',
              }}
            >
              {hasTrail ? 'TRAIL ON — DESACTIVAR' : 'TRAIL — ACTIVAR'}
            </button>

            {/* Bases */}
            <SectionBlock label="BASES DETECTADAS">
              {loadingExtra ? <Muted>Cargando…</Muted>
                : bases.length === 0 ? <Muted>Sin bases detectadas</Muted>
                : bases.slice(0, 5).map(b => (
                  <Row key={b.airfield_icao}>
                    <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)' }}>
                      {b.airfield_icao}
                    </span>
                    {b.airfield_name && (
                      <span style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', marginLeft: 6 }}>
                        {b.airfield_name}
                      </span>
                    )}
                  </Row>
                ))
              }
            </SectionBlock>

            {/* Routes */}
            <SectionBlock label="RUTAS DETECTADAS">
              {loadingExtra ? <Muted>Cargando…</Muted>
                : routes.length === 0 ? <Muted>Sin rutas detectadas</Muted>
                : routes.slice(0, 5).map((r, i) => (
                  <Row key={i}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-1)' }}>
                      <span style={{ color: 'var(--accent)' }}>{r.origin_icao}</span>
                      <span style={{ color: 'var(--txt-3)' }}> → </span>
                      <span style={{ color: 'var(--accent)' }}>{r.dest_icao}</span>
                      {r.flight_count > 1 && (
                        <span style={{ color: 'var(--txt-3)' }}> ({r.flight_count})</span>
                      )}
                    </span>
                  </Row>
                ))
              }
            </SectionBlock>
          </div>
        </div>
      )}

      {/* ── Favorites ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', minHeight: 0,
      }}>
        {/* Favorites header / toggle */}
        <button
          onClick={() => setFavOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '10px 14px',
            background: 'none', border: 'none',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer', width: '100%', flexShrink: 0,
          }}
        >
          <span style={{
            flex: 1, textAlign: 'left',
            fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
            fontWeight: 700, letterSpacing: '.16em',
            color: 'var(--txt-2)', textTransform: 'uppercase',
          }}>
            FAVORITOS · {favorites.length}
          </span>
          <span style={{ color: 'var(--txt-3)', fontSize: 11 }}>
            {favOpen ? '▴' : '▾'}
          </span>
        </button>

        {/* Favorites list */}
        {favOpen && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {favorites.length === 0 ? (
              <div style={{
                padding: '20px 14px', textAlign: 'center',
                fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                color: 'var(--txt-3)',
              }}>
                Sin favoritos marcados
              </div>
            ) : favorites.map(fav => (
              <div
                key={fav.icao24}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '8px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background .12s',
                }}
                onClick={() => onFlyTo && onFlyTo(fav.icao24)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--label-md)',
                    fontWeight: 700, color: 'var(--txt-1)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {fav.callsign || fav.icao24}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                    color: 'var(--txt-3)',
                  }}>
                    {fav.icao24}
                  </div>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    toggleFavorite({ id: fav.icao24, label: fav.callsign })
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ffd60a', fontSize: 15, lineHeight: 1,
                    padding: '2px 4px', flexShrink: 0,
                  }}
                >★</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function SectionBlock({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 'var(--label-sm)', fontWeight: 700, letterSpacing: '.15em',
        color: 'var(--txt-2)', fontFamily: 'var(--mono)', marginBottom: 6,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Row({ children }) {
  return (
    <div style={{
      padding: '3px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

function Muted({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
      color: 'var(--txt-3)',
    }}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TacticalPanel.jsx
git commit -m "feat(frontend): add TacticalPanel with aircraft detail and favorites"
```

---

## Task 4: MapView — remove popup, add `onSelectAircraft`

**Files:**
- Modify: `frontend/src/components/MapView.jsx`

The goal: remove the popup (the `{detail && (() => { ... })()}` block and all its state/logic), add `onSelectAircraft` prop. Aircraft click now calls `onSelectAircraft({ ...props, lon, lat })` instead of `setDetail`.

- [ ] **Step 1: Read `frontend/src/components/MapView.jsx` to find exact lines**

Key sections to identify before editing:
1. The component signature line: `export default function MapView({...})`
2. State declarations: `const [detail, setDetail]`, `const [route, setRoute]`, `const [routeLoading...]`, `const [meta...]`, `const [metaLoading...]`
3. Functions: `authHdr()`, `fetchRoute()`, `fetchMeta()`
4. Inside `map.on('load', ...)`: the aircraft click handler `map.on('click', 'aircraft-layer', ...)`
5. The general click handler `map.on('click', e => { ... setDetail(null) ... })`
6. The popup JSX: `{detail && (() => { ... })()}`

- [ ] **Step 2: Update the component signature to add `onSelectAircraft`**

Change:
```js
export default function MapView({ aircraft, alerts, flyTarget, trails = {}, onAddTrail, onRemoveTrail, onClearTrails }) {
```
To:
```js
export default function MapView({ aircraft, alerts, flyTarget, trails = {}, onAddTrail, onRemoveTrail, onClearTrails, onSelectAircraft }) {
```

- [ ] **Step 3: Remove internal state and fetch functions**

Remove these 5 state declarations (they will be after the `const [ready, setReady]` line):
```js
const [detail, setDetail]             = useState(null)
const [route, setRoute]               = useState(null)
const [routeLoading, setRouteLoading] = useState(false)
const [meta, setMeta]                 = useState(null)
const [metaLoading, setMetaLoading]   = useState(false)
```

Remove the `authHdr()` function.

Remove the `fetchRoute(callsign)` async function.

Remove the `fetchMeta(icao24)` async function.

- [ ] **Step 4: Replace aircraft click handler inside `map.on('load', ...)`**

Find:
```js
map.on('click', 'aircraft-layer', e => {
  const props = e.features[0]?.properties
  if (props) {
    setDetail({ ...props, px: e.point.x, py: e.point.y })
    fetchRoute(props.label)
    fetchMeta(props.id)
  }
})
```

Replace with:
```js
map.on('click', 'aircraft-layer', e => {
  const props = e.features[0]?.properties
  if (props && onSelectAircraft) {
    onSelectAircraft({ ...props, lon: e.lngLat.lng, lat: e.lngLat.lat })
  }
})
```

- [ ] **Step 5: Replace general click handler**

Find:
```js
map.on('click', e => {
  const hits = map.queryRenderedFeatures(e.point, { layers: ['aircraft-layer'] })
  if (!hits.length) {
    setDetail(null)
    setRoute(null)
    setMeta(null)
  }
})
```

Replace with:
```js
map.on('click', e => {
  const hits = map.queryRenderedFeatures(e.point, { layers: ['aircraft-layer'] })
  if (!hits.length && onSelectAircraft) {
    onSelectAircraft(null)
  }
})
```

- [ ] **Step 6: Remove the popup JSX block**

In the component's return JSX, find and remove the entire block:
```js
{detail && (() => {
  // ...everything from here...
  return (
    <div style={{...}}>
      ...
    </div>
  )
})()}
```

This block starts with `{detail && (() => {` and ends with `})()}`. Remove the entire thing. The `TrailPanel` block above it and the closing `</div>` of the container below it should remain.

Also remove any remaining references to `route`, `routeLoading`, `meta`, `metaLoading`, `detail` in the JSX (search for these names after the edit and remove them if any remain).

- [ ] **Step 7: Verify the file compiles (check for syntax errors)**

```bash
cd frontend && node --input-type=module < src/components/MapView.jsx 2>&1 | head -5
```

Expected: an import error (can't run in Node) or no output — NOT a syntax error message. If you see `SyntaxError`, fix the JSX.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/MapView.jsx
git commit -m "feat(frontend): MapView — remove popup, add onSelectAircraft prop"
```

---

## Task 5: App.jsx — wire selectedAircraft and TacticalPanel

**Files:**
- Modify: `frontend/src/App.jsx`

Current tactical view block (around lines 87-112) uses FilterPanel + AlertPanel in the aside. We replace them with TacticalPanel, add `selectedAircraft` state, wire `onSelectAircraft` to MapView, and pass `onFlyTo` to TacticalPanel.

- [ ] **Step 1: Add TacticalPanel import**

After the existing page imports, add:
```js
import TacticalPanel from './components/TacticalPanel'
```

- [ ] **Step 2: Remove FilterPanel and AlertPanel imports**

Remove these two import lines:
```js
import FilterPanel from './components/FilterPanel'
import AlertPanel  from './components/AlertPanel'
```

- [ ] **Step 3: Add `selectedAircraft` state inside `AppShell`**

After the existing `useState` declarations (after `flyTarget`), add:
```js
const [selectedAircraft, setSelectedAircraft] = useState(null)
```

- [ ] **Step 4: Remove filter-related state and memos**

Remove these declarations (they are no longer needed without FilterPanel):
```js
const [filters, setFilters] = useState(DEFAULT_FILTERS)
```
```js
function toggleFilter(key) {
  setFilters(prev => ({ ...prev, [key]: !prev[key] }))
}
```
```js
const visibleAircraft = useMemo(() => aircraft.filter(a => {
  if (a.type === 'military') return filters.military_aircraft
  if (a.type === 'vip')      return filters.vip
  return filters.civil
}), [aircraft, filters])
```
```js
const visibleAlerts = useMemo(() =>
  filters.alerts ? alerts : []
, [alerts, filters])
```
```js
const counts = useMemo(() => ({
  civil:             aircraft.filter(a => a.type === 'civil').length,
  military_aircraft: aircraft.filter(a => a.type === 'military').length,
  vip:               aircraft.filter(a => a.type === 'vip').length,
  alerts:            alerts.length,
}), [aircraft, alerts])
```

Also remove the `DEFAULT_FILTERS` constant at the top of the file:
```js
const DEFAULT_FILTERS = {
  civil:             true,
  military_aircraft: true,
  vip:               true,
  alerts:            true,
}
```

- [ ] **Step 5: Update the tactical view block**

Find the tactical grid return block. Replace the `<aside>` contents and update MapView props.

In the `<MapView>` call inside tactical view, add the `onSelectAircraft` prop:
```jsx
<MapView aircraft={aircraft} alerts={[]} flyTarget={flyTarget}
  trails={trails} onAddTrail={addTrail} onRemoveTrail={removeTrail} onClearTrails={clearAll}
  onSelectAircraft={setSelectedAircraft} />
```

Note: `alerts={[]}` (empty — alerts removed from tactical view for now), `aircraft={aircraft}` (direct, no filtering).

Replace the `<aside>` block:

Old:
```jsx
<aside style={{ gridColumn:2, gridRow:2, display:'flex', flexDirection:'column',
  background:'var(--bg-1)', borderLeft:'1px solid var(--border-md)', overflow:'hidden' }}>
  <FilterPanel filters={filters} onToggle={toggleFilter} counts={counts} />
  <AlertPanel alerts={visibleAlerts} stats={stats}
    onAlertClick={a => setFlyTarget({ lon: a.lon, lat: a.lat })} />
</aside>
```

New:
```jsx
<aside style={{ gridColumn:2, gridRow:2, display:'flex', flexDirection:'column',
  background:'var(--bg-1)', borderLeft:'1px solid var(--border-md)', overflow:'hidden' }}>
  <TacticalPanel
    selectedAircraft={selectedAircraft}
    onClose={() => setSelectedAircraft(null)}
    trails={trails}
    onAddTrail={addTrail}
    onRemoveTrail={removeTrail}
    onFlyTo={(icao24) => {
      const a = aircraft.find(x => x.id === icao24)
      if (a) setFlyTarget({ lon: a.lon, lat: a.lat })
    }}
  />
</aside>
```

- [ ] **Step 6: Update the analyst view and other views MapView usage (if any)**

In the analyst view block (around line 72), MapView is not used directly — skip.

In the "All other views" block, MapView is not used — skip.

Only the tactical view uses MapView. No other changes needed.

- [ ] **Step 7: Verify no remaining references to removed names**

Check that `visibleAircraft`, `visibleAlerts`, `filters`, `counts`, `toggleFilter`, `FilterPanel`, `AlertPanel` are gone from the file.

```bash
grep -n "visibleAircraft\|visibleAlerts\|FilterPanel\|AlertPanel\|toggleFilter\|DEFAULT_FILTERS" frontend/src/App.jsx
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): wire TacticalPanel in tactical view, remove FilterPanel/AlertPanel"
```

---

## Task 6: Run DB migration + deploy

**Files:** none (operational)

- [ ] **Step 1: Run the DB migration on the server via paramiko**

```python
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('178.104.238.122', username='root', password='Qilin$Srv#2026!kZ')

migration_sql = """
CREATE TABLE IF NOT EXISTS user_favorites (
    username   TEXT        NOT NULL,
    icao24     TEXT        NOT NULL,
    callsign   TEXT,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, icao24)
);
CREATE INDEX IF NOT EXISTS favorites_username_idx ON user_favorites (username);
"""

cmd = f"docker exec qilin_db psql -U qilin -d qilin -c \"{migration_sql.strip()}\""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))
client.close()
```

Expected output: `CREATE TABLE` and `CREATE INDEX`.

- [ ] **Step 2: Git push and deploy**

```python
import paramiko, subprocess

subprocess.run(['git', 'push'], check=True)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('178.104.238.122', username='root', password='Qilin$Srv#2026!kZ')

commands = [
    'cd /opt/qilin && git pull',
    'cd /opt/qilin/frontend && npm run build 2>&1 | tail -10',
    'docker compose -f /opt/qilin/docker-compose.yml restart api 2>&1 | tail -5',
    'systemctl reload nginx',
]
for cmd in commands:
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print(f'$ {cmd}\n{out}{err}')

client.close()
```

Expected: git pull shows new files, npm build succeeds, API restarts, nginx reloads.

- [ ] **Step 3: Smoke test**

Navigate to the production URL, log in, go to TÁCTICO view:
1. Confirm right panel shows only "FAVORITOS · 0" (no FilterPanel/AlertPanel)
2. Click an aircraft → detail panel appears with callsign, type badge, metrics, trail button
3. Click ★ → aircraft added to FAVORITOS list
4. Click × → detail panel closes, only FAVORITOS remains
5. Click the ★ in the FAVORITOS list → aircraft removed
6. Reload page → favorites persist (fetched from DB)
