# Sentinel Emissions Map — Design Spec

## Goal

Add a dedicated `/app/sentinel` page to the Qilin dashboard showing NO₂ and SO₂ emissions per geographic zone (Sentinel-5P data) with anomaly highlighting, a NO₂/SO₂ toggle, and a per-zone detail drawer with 7-day sparklines.

---

## Architecture

### Backend

**New endpoint:** `GET /api/sentinel/zones`

- Auth required (JWT, same as all `/api/*` endpoints)
- Returns all 18 zones with:
  - Current NO₂ and SO₂ values (latest `sentinel_observations` row per zone+product)
  - `anomaly_ratio` for each gas
  - `baseline_mean` for each gas
  - 7-day daily history array `[{date, value}]` for each gas (for sparklines)
- Data source: `sentinel_observations` table in TimescaleDB
- No caching needed — data only updates every 6h

**Query pattern:**
```sql
-- Current values per zone+product
SELECT zone_id, product, mean_value, baseline_mean, anomaly_ratio, observed_at
FROM sentinel_observations
WHERE observed_at = (
  SELECT MAX(observed_at) FROM sentinel_observations so2
  WHERE so2.zone_id = sentinel_observations.zone_id
    AND so2.product = sentinel_observations.product
)

-- 7-day history per zone+product
SELECT zone_id, product, DATE(observed_at) as date, AVG(mean_value) as value
FROM sentinel_observations
WHERE observed_at >= NOW() - INTERVAL '7 days'
GROUP BY zone_id, product, DATE(observed_at)
ORDER BY date ASC
```

**Response shape:**
```json
{
  "zones": [
    {
      "zone_id": "persian_gulf",
      "no2": { "current": 0.00045, "baseline": 0.00020, "ratio": 2.31, "history": [{"date": "2026-04-15", "value": 0.00022}, ...] },
      "so2": { "current": 0.00012, "baseline": 0.00010, "ratio": 1.20, "history": [...] }
    }
  ]
}
```

### Frontend

**New file:** `src/pages/SentinelPage.jsx`

**New file:** `src/hooks/useSentinelData.js`

**Modified:** `src/App.jsx` — add `sentinel` view to the view switcher

**Modified:** `src/components/TopBar.jsx` — add `SENTINEL` nav item

### Zone Polygons

Zones are defined in `config/zones.yaml` as bounding boxes (`lat_min`, `lat_max`, `lon_min`, `lon_max`). The frontend converts these to GeoJSON `Polygon` features at build time (hardcoded in a `src/data/sentinelZones.js` file generated from the YAML, or fetched from a `/api/sentinel/zones/geo` endpoint).

**Decision:** Hardcode the GeoJSON in `src/data/sentinelZones.js` — zones rarely change and this avoids an extra endpoint.

---

## Components

### `SentinelPage.jsx`

Layout: full height flex row.

- Left: MapLibre map (flex: 1) with choropleth layer
- Right: `ZoneDrawer` (340px, hidden until a zone is clicked)

State:
- `activeGas`: `'no2'` | `'so2'` (toggle)
- `selectedZone`: zone object | null (drives drawer)
- `zoneData`: from `useSentinelData`
- `lastUpdated`: timestamp of latest observation

### `useSentinelData.js`

- Fetches `GET /api/sentinel/zones` on mount
- Re-fetches every 6 hours (21600000ms interval)
- Returns `{ zones, loading, error, lastUpdated }`

### MapLibre Choropleth Layer

- Source: GeoJSON FeatureCollection from `sentinelZones.js`, each feature has `zone_id` as property
- Paint expression: data-driven `fill-color` based on `anomaly_ratio` of active gas
  ```
  < 1.0  → #166534 (green)
  1.0–1.5 → #854d0e (yellow)
  1.5–2.0 → #9a3412 (orange)
  > 2.0  → #991b1b (red)
  ```
- `fill-opacity`: 0.55
- On zone click: `setSelectedZone(zone)`

### NO₂ / SO₂ Toggle

Positioned top-left over the map (absolute). Two pill buttons styled with the existing `--border-md` / `--accent` CSS variables. Active gas has gold border + text.

### Last Updated Badge

Top-right corner of map (absolute). Shows `ÚLTIMO DATO: hace Xh` computed from `lastUpdated`.

### `ZoneDrawer`

340px panel, `background: var(--bg-1)`, `border-left: 1px solid var(--border-md)`.

Contents:
1. Header: zone name + close button
2. Status badge: NORMAL (green) / ANOMALÍA (orange) / SEVERO (red) based on max ratio of either gas
3. Metrics rows for NO₂ and SO₂:
   - Label, current value (scientific notation), baseline, ratio (e.g. `2.31x`)
4. Sparklines: one SVG per gas, 7-day trend, `<polyline>` on a 200×40px viewBox, no axes, subtle grid line at baseline

---

## Data Flow

```
TimescaleDB (sentinel_observations)
  └─► GET /api/sentinel/zones
        └─► useSentinelData (poll 6h)
              └─► SentinelPage
                    ├─► MapLibre choropleth (activeGas ratio → color)
                    └─► ZoneDrawer (selectedZone details + sparklines)
```

---

## Error Handling

- If `sentinel_observations` is empty (ingestor not running), endpoint returns `{"zones": []}` with HTTP 200. Page shows an empty map with a `SIN DATOS` banner.
- Network error in `useSentinelData`: shows last cached data + error badge `DATOS DESACTUALIZADOS`.
- Zone click on zone with no data: drawer shows `Sin observaciones recientes` instead of metrics.

---

## TopBar Integration

Add `SENTINEL` between `SOCIAL` and `MERCADOS` in TopBar nav. Uses `view === 'sentinel'` pattern already established in `App.jsx`.

---

## Out of Scope

- Real-time WebSocket updates (data only changes every 6h, polling is sufficient)
- Exporting data
- Filtering by anomaly threshold
- Mobile layout
