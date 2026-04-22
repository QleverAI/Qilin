# Tactical Panel + Aircraft Favorites — Design Spec

## Goal

Replace the tactical map's right panel (FilterPanel + AlertPanel) with a new `TacticalPanel` that shows aircraft details when selected (no popup) and a persistent favorites section. Favorites are stored per user in the database.

---

## Architecture

### Backend

**New table:** `user_favorites`
```sql
CREATE TABLE IF NOT EXISTS user_favorites (
    username    TEXT        NOT NULL,
    icao24      TEXT        NOT NULL,
    callsign    TEXT,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, icao24)
);
```

**New endpoints** (all require JWT auth):

- `GET /favorites` — returns `[{ icao24, callsign, added_at }]` for the authenticated user
- `POST /favorites/{icao24}` — body `{ "callsign": "..." }` — adds to favorites; 409 if already exists (ignored gracefully)
- `DELETE /favorites/{icao24}` — removes from favorites; 404 if not found (ignored gracefully)

### Frontend — New Files

- `frontend/src/components/TacticalPanel.jsx` — replaces FilterPanel + AlertPanel in the tactical view
- `frontend/src/hooks/useFavorites.js` — fetches, adds, removes favorites with optimistic updates

### Frontend — Modified Files

- `frontend/src/App.jsx` — add `selectedAircraft` state; pass `onSelectAircraft` to MapView; pass `selectedAircraft`, `setSelectedAircraft`, trail hooks to TacticalPanel; remove FilterPanel/AlertPanel imports from tactical view
- `frontend/src/components/MapView.jsx` — add `onSelectAircraft` prop; change aircraft click handler from popup to `onSelectAircraft(aircraft)`; keep popup for non-aircraft clicks (alerts, etc.) if any

### Backend — Modified Files

- `db/init.sql` — add `user_favorites` table definition
- `services/api/main.py` — add three new endpoints

---

## Component: `TacticalPanel.jsx`

**Props:**
```
selectedAircraft   — aircraft object | null
onClose            — () => void  (clears selectedAircraft)
trails             — from useAircraftTrail
onAddTrail         — from useAircraftTrail
onRemoveTrail      — from useAircraftTrail
onFlyTo            — (lon, lat) => void  (to center map on favorite)
```

**Layout:** `display: flex; flex-direction: column; height: 100%; overflow: hidden`

- Top section: Aircraft detail panel (shown only when `selectedAircraft` is truthy)
- Bottom section: Favorites panel (always visible; expands to fill full height when no aircraft selected)

### Aircraft Detail Sub-section

Header row:
- Callsign (bold, monospace)
- Type badge: `MILITARY` (red) / `VIP` (gold) / `CIVIL` (cyan)
- Star button ★: gold if favorite, `var(--txt-3)` if not; calls `toggleFavorite(aircraft)`
- Close button ×: calls `onClose()`

Metrics grid (2 columns):
- ALTITUD: `{altitude} ft`
- VELOCIDAD: `{velocity} kt`
- HEADING: `{heading}°`
- ZONA: `{zone}`
- ESTADO: `EN TIERRA` / `EN VUELO`

Trail button: `TRAIL ON` / `TRAIL OFF` — calls `onAddTrail(aircraft)` or `onRemoveTrail(icao24)`

Bases section:
- Label `BASES DETECTADAS`
- List of `{ airfield_icao, name, lat, lon }` — max 5 shown
- `Sin bases detectadas` if empty

Routes section:
- Label `RUTAS DETECTADAS`
- List of `{ origin, destination, count }` as `ORIGIN → DEST (N vuelos)`
- `Sin rutas detectadas` if empty

Bases and routes loaded with `useEffect` when `selectedAircraft` changes, via:
- `apiFetch(/api/aircraft/${icao24}/bases)`
- `apiFetch(/api/aircraft/${icao24}/routes)`

### Favorites Sub-section

Header row:
- `FAVORITOS · N` (where N is favorites count)
- Chevron button ▾/▴ to collapse/expand list

Collapsed: only header visible.
Expanded (default): list of favorites below header.

Each favorite row:
- Callsign (monospace) + icao24 (smaller, muted)
- Click on row: calls `onFlyTo(lon, lat)` if aircraft is currently live on map, otherwise just selects it in panel
- Star ★ button (gold): click removes from favorites

Empty state: `Sin favoritos marcados` centered in the list area.

---

## Hook: `useFavorites.js`

```
Returns: { favorites, loading, toggleFavorite, isFavorite }
```

- `favorites`: array of `{ icao24, callsign, added_at }`
- `loading`: boolean
- `toggleFavorite(aircraft)`: if already favorite → DELETE; if not → POST. Optimistic update: update state immediately, revert on API error.
- `isFavorite(icao24)`: boolean lookup

Fetches `GET /favorites` on mount (once — no polling, favorites don't change externally).

---

## MapView Changes

Add prop `onSelectAircraft: (aircraft) => void`.

In the aircraft click handler (`map.on('click', 'aircraft-layer', ...)`):
- Remove: popup creation/show logic
- Add: `if (onSelectAircraft) onSelectAircraft(feature.properties)`

Cursor changes (pointer on hover) remain unchanged.

---

## App.jsx Changes

In `AppShell`:
- Add state: `const [selectedAircraft, setSelectedAircraft] = useState(null)`
- Pass to `MapView`: `onSelectAircraft={setSelectedAircraft}`
- In tactical view, replace:
  ```jsx
  <FilterPanel ... />
  <AlertPanel ... />
  ```
  with:
  ```jsx
  <TacticalPanel
    selectedAircraft={selectedAircraft}
    onClose={() => setSelectedAircraft(null)}
    trails={trails}
    onAddTrail={addTrail}
    onRemoveTrail={removeTrail}
    onFlyTo={(lon, lat) => setFlyTarget({ lon, lat })}
  />
  ```
- Remove imports: `FilterPanel`, `AlertPanel`
- Keep: `filters`, `toggleFilter`, `counts` state can be removed since FilterPanel is gone

---

## Data Flow

```
MapView (click on aircraft)
  └─► setSelectedAircraft(aircraft)  [App.jsx state]
        └─► TacticalPanel receives selectedAircraft
              ├─► shows detail panel
              ├─► loads bases + routes via apiFetch
              └─► star button → useFavorites.toggleFavorite()
                    ├─► optimistic state update
                    ├─► POST/DELETE /favorites/{icao24}
                    └─► revert on error

useFavorites (mount)
  └─► GET /favorites
        └─► favorites state populated
```

---

## Error Handling

- `GET /favorites` fails: show empty list, no crash
- `POST /favorites` fails: revert optimistic add, show no visual error (silent)
- `DELETE /favorites` fails: revert optimistic remove, show no visual error (silent)
- Bases/routes load fails: show `Sin datos detectados` — never crashes the panel

---

## Out of Scope

- FilterPanel aircraft type filters (civil/military/vip) — removed entirely for now
- AlertPanel — removed from tactical view (dedicated alerts view to be built later)
- Favorites persistence across browsers for unauthenticated users
- Sorting or filtering the favorites list
- Clicking a favorite to fly to it requires the aircraft to be currently live in Redis (TTL 120s)
