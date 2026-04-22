# Sentinel Emissions Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated SENTINEL page to the Qilin dashboard showing NO₂/SO₂ emissions per geographic zone with a MapLibre choropleth map, NO₂/SO₂ toggle, and a per-zone detail drawer with 7-day sparklines.

**Architecture:** New `GET /api/sentinel/zones` endpoint queries `sentinel_observations` in TimescaleDB and returns current values + 7-day history per zone. Frontend renders a MapLibre choropleth map with zone polygons colored by anomaly ratio; clicking a zone opens a detail drawer with gas metrics and sparklines.

**Tech Stack:** FastAPI + asyncpg (backend), React 18 + MapLibre GL JS (frontend), inline SVG sparklines (no extra charting library).

---

## File Map

**Create:**
- `frontend/src/data/sentinelZones.js` — GeoJSON FeatureCollection of all 19 zones + label lookup map
- `frontend/src/hooks/useSentinelData.js` — fetch `/api/sentinel/zones`, 6h polling
- `frontend/src/pages/SentinelPage.jsx` — map, toggle, legend, ZoneDrawer (all in one file)

**Modify:**
- `services/api/main.py` — add `GET /api/sentinel/zones` endpoint
- `frontend/src/components/TopBar.jsx` — add `SENTINEL` nav item
- `frontend/src/App.jsx` — wire `sentinel` view

---

## Task 1: Backend endpoint `GET /api/sentinel/zones`

**Files:**
- Modify: `services/api/main.py` (append new route near end of file, before WebSocket handler)

The `sentinel_observations` table schema (from `db/init.sql`):
```
time TIMESTAMPTZ, zone_id TEXT, product TEXT ('NO2'|'SO2'),
mean_value DOUBLE PRECISION, baseline_mean DOUBLE PRECISION,
anomaly_ratio DOUBLE PRECISION, granule_id TEXT
```

- [ ] **Step 1: Locate insertion point in `services/api/main.py`**

Find the last `@app.get` route (around line 949 — `get_polymarket_feed`). The new route goes after it, before the WebSocket handler.

- [ ] **Step 2: Add the endpoint**

Add immediately after `get_polymarket_feed`:

```python
@app.get("/api/sentinel/zones")
async def get_sentinel_zones(_user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"zones": []}
    try:
        current_rows = await app.state.db.fetch("""
            SELECT DISTINCT ON (zone_id, product)
              zone_id, product, mean_value, baseline_mean, anomaly_ratio, time
            FROM sentinel_observations
            ORDER BY zone_id, product, time DESC
        """)
        history_rows = await app.state.db.fetch("""
            SELECT zone_id, product,
              DATE(time AT TIME ZONE 'UTC') AS date,
              AVG(mean_value) AS value
            FROM sentinel_observations
            WHERE time >= NOW() - INTERVAL '7 days'
            GROUP BY zone_id, product, DATE(time AT TIME ZONE 'UTC')
            ORDER BY zone_id, product, date ASC
        """)
    except Exception as e:
        log.error(f"sentinel/zones error: {e}")
        return {"zones": []}

    zones_map = {}
    for row in current_rows:
        zid = row["zone_id"]
        if zid not in zones_map:
            zones_map[zid] = {"zone_id": zid, "no2": None, "so2": None}
        gas_key = "no2" if row["product"] == "NO2" else "so2"
        zones_map[zid][gas_key] = {
            "current": row["mean_value"],
            "baseline": row["baseline_mean"],
            "ratio": row["anomaly_ratio"],
            "history": [],
        }

    for row in history_rows:
        zid = row["zone_id"]
        if zid not in zones_map:
            continue
        gas_key = "no2" if row["product"] == "NO2" else "so2"
        if zones_map[zid][gas_key] is None:
            continue
        zones_map[zid][gas_key]["history"].append({
            "date": str(row["date"]),
            "value": float(row["value"]) if row["value"] is not None else None,
        })

    return {"zones": list(zones_map.values())}
```

- [ ] **Step 3: Verify endpoint locally (or on server)**

If the API is running locally:
```bash
curl -s -H "Authorization: Bearer $(curl -s -X POST http://localhost:8000/auth/login -d 'username=carlos&password=12345' | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')" http://localhost:8000/api/sentinel/zones | python3 -m json.tool | head -40
```

Expected: `{"zones": [...]}` — either with data or empty list if sentinel ingestor hasn't run.

- [ ] **Step 4: Commit**

```bash
git add services/api/main.py
git commit -m "feat(api): add GET /api/sentinel/zones endpoint with 7-day history"
```

---

## Task 2: GeoJSON zone data file

**Files:**
- Create: `frontend/src/data/sentinelZones.js`

Each zone in `config/zones.yaml` has `lat: [min, max]` and `lon: [min, max]`. We convert each to a GeoJSON bounding-box Polygon with `zone_id` as a feature property. The `zone_id` values must exactly match those stored in `sentinel_observations` by the ingestor.

- [ ] **Step 1: Create `frontend/src/data/sentinelZones.js`**

```js
function bbox(zoneId, label, latMin, latMax, lonMin, lonMax) {
  return {
    type: 'Feature',
    properties: { zone_id: zoneId, label },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lonMin, latMin],
        [lonMax, latMin],
        [lonMax, latMax],
        [lonMin, latMax],
        [lonMin, latMin],
      ]],
    },
  }
}

export const SENTINEL_ZONES_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    bbox('north_america',    'América del Norte',              15, 72,  -170, -50),
    bbox('europe',           'Europa',                         35, 72,   -25,  45),
    bbox('china',            'China / Taiwan',                 18, 54,    73, 135),
    bbox('korea',            'Península de Corea',             33, 43,   124, 132),
    bbox('iran',             'Irán',                           25, 40,    44,  64),
    bbox('gulf_ormuz',       'Golfo Pérsico / Estrecho de Ormuz', 22, 27, 51,  60),
    bbox('iraq_syria',       'Iraq / Siria',                   29, 38,    38,  48),
    bbox('yemen',            'Yemen',                          12, 19,    42,  54),
    bbox('levante',          'Levante (Israel / Líbano / Gaza)', 29, 34,  34,  38),
    bbox('libya',            'Libia',                          20, 33,     9,  25),
    bbox('ukraine_black_sea','Ucrania / Mar Negro',            44, 53,    22,  40),
    bbox('baltic_sea',       'Mar Báltico',                    53, 66,     9,  30),
    bbox('south_caucasus',   'Cáucaso Sur',                    38, 44,    38,  51),
    bbox('india_pakistan',   'India / Pakistán',               20, 37,    60,  80),
    bbox('south_china_sea',  'Mar del Sur de China',            0, 25,   105, 125),
    bbox('sahel',            'Sahel',                          10, 20,   -10,  25),
    bbox('somalia_horn',     'Somalia / Cuerno de África',      0, 15,    38,  52),
    bbox('venezuela',        'Venezuela',                       0, 15,   -75, -58),
    bbox('myanmar',          'Myanmar',                        10, 28,    92, 102),
  ],
}

export const ZONE_LABELS = Object.fromEntries(
  SENTINEL_ZONES_GEOJSON.features.map(f => [f.properties.zone_id, f.properties.label])
)
```

- [ ] **Step 2: Verify the file has 19 features**

```bash
node -e "const z = require('./src/data/sentinelZones.js'); console.log(z.SENTINEL_ZONES_GEOJSON.features.length)"
```

Expected: `19`

(If `require` fails due to ESM, skip this check — the import will be validated at runtime.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/sentinelZones.js
git commit -m "feat(frontend): add sentinel zones GeoJSON data file"
```

---

## Task 3: `useSentinelData` hook

**Files:**
- Create: `frontend/src/hooks/useSentinelData.js`

Uses `apiFetch` from `apiClient.js` (authenticated). Polls every 6h. Returns `{ zones, loading, error, lastUpdated }`.

- [ ] **Step 1: Create `frontend/src/hooks/useSentinelData.js`**

```js
import { useState, useEffect } from 'react'
import { apiFetch } from './apiClient'

export function useSentinelData() {
  const [zones,       setZones]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function fetchData() {
    try {
      const data = await apiFetch('/api/sentinel/zones')
      setZones(data.zones ?? [])
      setLastUpdated(new Date().toISOString())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 6 * 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  return { zones, loading, error, lastUpdated }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useSentinelData.js
git commit -m "feat(frontend): add useSentinelData hook with 6h polling"
```

---

## Task 4: TopBar + App.jsx wiring

**Files:**
- Modify: `frontend/src/components/TopBar.jsx` (line 3–11, the `NAV_ITEMS` array)
- Modify: `frontend/src/App.jsx` (lines 120–126, the view switcher)

- [ ] **Step 1: Add `SENTINEL` to `NAV_ITEMS` in `TopBar.jsx`**

Current `NAV_ITEMS` (lines 3–11):
```js
const NAV_ITEMS = [
  { id: 'home',       label: 'INICIO'     },
  { id: 'tactical',   label: 'TÁCTICO'    },
  { id: 'news',       label: 'NOTICIAS'   },
  { id: 'documents',  label: 'DOCUMENTOS' },
  { id: 'social',     label: 'SOCIAL'     },
  { id: 'markets',    label: 'MERCADOS'   },
  { id: 'polymarket', label: 'PREDICCIÓN' },
]
```

Replace with:
```js
const NAV_ITEMS = [
  { id: 'home',       label: 'INICIO'     },
  { id: 'tactical',   label: 'TÁCTICO'    },
  { id: 'news',       label: 'NOTICIAS'   },
  { id: 'documents',  label: 'DOCUMENTOS' },
  { id: 'social',     label: 'SOCIAL'     },
  { id: 'sentinel',   label: 'SENTINEL'   },
  { id: 'markets',    label: 'MERCADOS'   },
  { id: 'polymarket', label: 'PREDICCIÓN' },
]
```

- [ ] **Step 2: Add `sentinel` import and view in `App.jsx`**

Add import at top of `App.jsx` (after existing page imports):
```js
import SentinelPage from './pages/SentinelPage'
```

In the "All other views" return block (lines 120–126), add the sentinel line:
```jsx
{view === 'home'       && <HomePage aircraft={aircraft} alerts={alerts} onNavigate={setView} />}
{view === 'news'       && <NewsPage />}
{view === 'documents'  && <DocumentsPage />}
{view === 'social'     && <SocialPage />}
{view === 'sentinel'   && <SentinelPage />}
{view === 'markets'    && <FilingsPage />}
{view === 'polymarket' && <PolymarketPage />}
```

- [ ] **Step 3: Start dev server and verify SENTINEL tab appears**

```bash
cd frontend && npm run dev
```

Open http://localhost:3000, log in, and confirm `SENTINEL` tab is visible in TopBar between SOCIAL and MERCADOS. Clicking it should render an empty div (SentinelPage not created yet — will show React error, that's fine for now).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TopBar.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add SENTINEL nav tab and App.jsx view wiring"
```

---

## Task 5: `SentinelPage.jsx` — map, toggle, legend, ZoneDrawer

**Files:**
- Create: `frontend/src/pages/SentinelPage.jsx`

This file contains four components: `ratioColor` (helper), `Sparkline`, `ZoneDrawer`, and the default export `SentinelPage`.

- [ ] **Step 1: Create `frontend/src/pages/SentinelPage.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useSentinelData }       from '../hooks/useSentinelData'
import { SENTINEL_ZONES_GEOJSON, ZONE_LABELS } from '../data/sentinelZones'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

function ratioColor(ratio) {
  if (!ratio || ratio < 1.0) return '#166534'
  if (ratio < 1.5)           return '#854d0e'
  if (ratio < 2.0)           return '#9a3412'
  return '#991b1b'
}

function buildColorExpression(zones, activeGas) {
  if (zones.length === 0) return '#166534'
  const pairs = []
  for (const z of zones) {
    const d = activeGas === 'no2' ? z.no2 : z.so2
    pairs.push(z.zone_id, ratioColor(d?.ratio))
  }
  return ['match', ['get', 'zone_id'], ...pairs, '#166534']
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ history }) {
  if (!history || history.length === 0) {
    return (
      <div style={{ height: 40, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
          SIN HISTÓRICO
        </span>
      </div>
    )
  }
  const values = history.map(h => h.value).filter(v => v !== null)
  if (values.length === 0) return null
  const min   = Math.min(...values)
  const max   = Math.max(...values)
  const range = max - min || 1
  const W = 200, H = 40, PAD = 4
  const pts = values.map((v, i) => {
    const x = PAD + (i / Math.max(values.length - 1, 1)) * (W - 2 * PAD)
    const y = H - PAD - ((v - min) / range) * (H - 2 * PAD)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 40, display: 'block' }}>
      <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="#374151" strokeWidth="0.5" />
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── ZoneDrawer ────────────────────────────────────────────────────────────────
function ZoneDrawer({ zone, onClose }) {
  const maxRatio  = Math.max(zone.no2?.ratio ?? 0, zone.so2?.ratio ?? 0)
  const badge     = maxRatio >= 2.0
    ? { label: 'SEVERO',   color: '#991b1b', bg: 'rgba(153,27,27,0.15)'  }
    : maxRatio >= 1.5
    ? { label: 'ANOMALÍA', color: '#9a3412', bg: 'rgba(154,52,18,0.15)'  }
    : { label: 'NORMAL',   color: '#166534', bg: 'rgba(22,101,52,0.15)'  }

  return (
    <div style={{
      width: 340, flexShrink: 0,
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--border-md)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
      }}>
        <span style={{
          flex: 1, fontFamily: 'var(--mono)', fontSize: 'var(--label-md)',
          fontWeight: 700, letterSpacing: '.08em',
          color: 'var(--txt-1)', textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ZONE_LABELS[zone.zone_id] ?? zone.zone_id}
        </span>
        <span style={{
          fontSize: 'var(--label-sm)', fontWeight: 700, fontFamily: 'var(--mono)',
          padding: '2px 8px', borderRadius: 2, flexShrink: 0,
          color: badge.color, background: badge.bg,
          border: `1px solid ${badge.color}55`,
        }}>
          {badge.label}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--txt-3)',
            cursor: 'pointer', fontSize: 18, lineHeight: 1,
            padding: '2px 4px', flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* Gas panels */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {['no2', 'so2'].map(gas => {
          const d = zone[gas]
          return (
            <div key={gas} style={{
              marginBottom: 16,
              padding: '10px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 3,
            }}>
              {/* Gas header */}
              <div style={{
                display: 'flex', alignItems: 'center',
                marginBottom: d ? 10 : 0,
              }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                  fontWeight: 700, letterSpacing: '.15em', color: 'var(--txt-2)',
                }}>
                  {gas.toUpperCase()}
                </span>
                {d && (
                  <span style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--mono)', fontSize: 'var(--label-md)',
                    fontWeight: 700, color: ratioColor(d.ratio),
                  }}>
                    {d.ratio?.toFixed(2)}x
                  </span>
                )}
              </div>

              {d ? (
                <>
                  {/* Metrics grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 8, marginBottom: 12,
                  }}>
                    {[
                      { label: 'ACTUAL',   value: d.current  },
                      { label: 'BASELINE', value: d.baseline },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{
                          fontSize: 'var(--label-sm)', color: 'var(--txt-3)',
                          fontFamily: 'var(--mono)', marginBottom: 2,
                        }}>
                          {label}
                        </div>
                        <div style={{
                          fontSize: 'var(--label-md)', color: 'var(--txt-1)',
                          fontFamily: 'var(--mono)',
                        }}>
                          {value != null ? value.toExponential(2) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sparkline */}
                  <div style={{
                    fontSize: 'var(--label-sm)', color: 'var(--txt-3)',
                    fontFamily: 'var(--mono)', marginBottom: 4,
                  }}>
                    7 DÍAS
                  </div>
                  <Sparkline history={d.history} />
                </>
              ) : (
                <div style={{
                  fontSize: 'var(--label-sm)', color: 'var(--txt-3)',
                  fontFamily: 'var(--mono)',
                }}>
                  Sin observaciones recientes
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── SentinelPage ──────────────────────────────────────────────────────────────
export default function SentinelPage() {
  const mapRef         = useRef(null)
  const mapInstanceRef = useRef(null)
  const { zones, loading, error, lastUpdated } = useSentinelData()
  const [activeGas,     setActiveGas]     = useState('no2')
  const [selectedZoneId, setSelectedZoneId] = useState(null)

  const selectedZone = zones.find(z => z.zone_id === selectedZoneId) ?? null

  const hoursAgo = lastUpdated
    ? Math.round((Date.now() - new Date(lastUpdated).getTime()) / 3600000)
    : null

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current) return
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: MAP_STYLE,
      center: [20, 20],
      zoom: 1.8,
    })
    mapInstanceRef.current = map

    map.on('load', () => {
      map.addSource('sentinel-zones', {
        type: 'geojson',
        data: SENTINEL_ZONES_GEOJSON,
      })
      map.addLayer({
        id: 'sentinel-fill',
        type: 'fill',
        source: 'sentinel-zones',
        paint: { 'fill-color': '#166534', 'fill-opacity': 0.55 },
      })
      map.addLayer({
        id: 'sentinel-outline',
        type: 'line',
        source: 'sentinel-zones',
        paint: { 'line-color': '#374151', 'line-width': 1 },
      })
      map.on('click', 'sentinel-fill', e => {
        const zoneId = e.features[0]?.properties?.zone_id
        if (zoneId) setSelectedZoneId(zoneId)
      })
      map.on('mouseenter', 'sentinel-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'sentinel-fill', () => { map.getCanvas().style.cursor = '' })
    })

    return () => { map.remove(); mapInstanceRef.current = null }
  }, [])

  // Update fill colors when zones data or active gas changes
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || zones.length === 0) return
    const apply = () => {
      if (map.getLayer('sentinel-fill')) {
        map.setPaintProperty('sentinel-fill', 'fill-color', buildColorExpression(zones, activeGas))
      }
    }
    map.loaded() ? apply() : map.once('load', apply)
  }, [zones, activeGas])

  const statusLabel = error
    ? 'DATOS DESACTUALIZADOS'
    : loading
    ? 'CARGANDO...'
    : hoursAgo !== null
    ? `ÚLTIMO DATO: hace ${hoursAgo}h`
    : 'SIN DATOS'

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* NO₂ / SO₂ toggle */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 10,
          display: 'flex',
          background: 'var(--bg-1)',
          border: '1px solid var(--border-md)',
          borderRadius: 3, overflow: 'hidden',
        }}>
          {['no2', 'so2'].map(gas => (
            <button
              key={gas}
              onClick={() => setActiveGas(gas)}
              style={{
                background: activeGas === gas ? 'rgba(200,160,60,0.15)' : 'transparent',
                border: 'none',
                borderRight: gas === 'no2' ? '1px solid var(--border-md)' : 'none',
                color: activeGas === gas ? 'var(--accent)' : 'var(--txt-2)',
                fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                fontWeight: 700, letterSpacing: '.1em',
                padding: '6px 16px', cursor: 'pointer',
              }}
            >
              {gas.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Status / last updated */}
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-md)',
          borderRadius: 3, padding: '5px 10px',
          fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
          color: error ? 'var(--amber)' : 'var(--txt-3)',
        }}>
          {statusLabel}
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 24, left: 12, zIndex: 10,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-md)',
          borderRadius: 3, padding: '8px 12px',
        }}>
          {[
            { color: '#166534', label: '< 1.0x  normal'   },
            { color: '#854d0e', label: '1.0–1.5x  elevado' },
            { color: '#9a3412', label: '1.5–2.0x  anomalía'},
            { color: '#991b1b', label: '> 2.0x  severo'    },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, background: color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-2)' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone Drawer */}
      {selectedZone && (
        <ZoneDrawer zone={selectedZone} onClose={() => setSelectedZoneId(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Start dev server and manually verify**

```bash
cd frontend && npm run dev
```

1. Log in → click **SENTINEL** tab → confirm map renders (dark CartoDB base with green polygons covering all 19 zones)
2. Toggle **NO₂ → SO₂** → confirm page re-renders (colors stay green if no data, or change if sentinel ingestor has run)
3. Click any polygon → confirm ZoneDrawer opens on the right with zone name, status badge, NO₂ and SO₂ panels
4. Click `×` → confirm drawer closes
5. Check top-right badge shows status (CARGANDO... then a time or SIN DATOS)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/SentinelPage.jsx
git commit -m "feat(frontend): add SentinelPage with choropleth map, NO₂/SO₂ toggle, and ZoneDrawer"
```

---

## Task 6: Production deploy

**Files:**
- No new files — build and sync to server

- [ ] **Step 1: Build frontend**

```bash
cd frontend && npm run build
```

Expected: `dist/` folder created with no errors.

- [ ] **Step 2: Deploy to server via paramiko**

Run this Python script (paramiko already used in this project):

```python
import paramiko, subprocess, os

host = '178.104.238.122'
user = 'root'
password = 'Qilin$Srv#2026!kZ'

# Push local commits to server via git
# (Server has no GitHub credentials — push changes directly)
subprocess.run(['git', 'push'], check=True)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password)

commands = [
    'cd /opt/qilin && git pull',
    'cd /opt/qilin/frontend && npm run build',
    'systemctl reload nginx',
]
for cmd in commands:
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print(f'$ {cmd}\n{out}{err}')

client.close()
```

- [ ] **Step 3: Verify on production**

Open https://178.104.238.122 (or the production URL), log in, click **SENTINEL** — map should render correctly.

- [ ] **Step 4: Commit deploy script if used**

No commit needed — deploy is operational, not code.
