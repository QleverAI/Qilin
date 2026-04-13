# Remove Mocks & Connect Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar todos los datos mock del mapa táctico, conectar datos reales de OpenSky vía REST polling, quitar embarcaciones de la UI, y añadir un popup de ruta de vuelo (origen/destino) al hacer click en un avión.

**Architecture:** El frontend hace polling REST cada 15s a `/aircraft` y carga alertas al inicio desde `/alerts`. Al clicar un avión, el frontend llama a `/routes/{callsign}` que actúa de proxy hacia OpenSky con cache en Redis. Los barcos se eliminan completamente de la UI ya que AIS no tiene fuente activa.

**Tech Stack:** React 18 + hooks, FastAPI, httpx (ya instalado en ingestor pero hay que añadir a API), Redis (cache de rutas), MapLibre GL

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `services/api/main.py` | Modificar | Añadir `GET /routes/{callsign}` con proxy OpenSky + cache Redis |
| `services/api/requirements.txt` | Modificar | Añadir `httpx` |
| `frontend/src/hooks/useQilinData.js` | Reescribir | Quitar mocks/animación, fetch real de aircraft + alertas, polling 15s |
| `frontend/src/App.jsx` | Modificar | Quitar vessels del state, filtros y props |
| `frontend/src/components/BottomBar.jsx` | Modificar | Quitar stat de embarcaciones |
| `frontend/src/components/FilterPanel.jsx` | Modificar | Quitar 3 filtros de embarcaciones |
| `frontend/src/components/MapView.jsx` | Modificar | Quitar vessel layers/icons, ampliar popup con rutas |

---

### Task 1: Añadir `GET /routes/{callsign}` a la API

**Files:**
- Modify: `services/api/main.py`
- Modify: `services/api/requirements.txt`

- [ ] **Step 1: Añadir httpx a requirements**

Abrir `services/api/requirements.txt` y añadir al final:
```
httpx==0.27.*
```

- [ ] **Step 2: Añadir el import de httpx en main.py**

Al bloque de imports de `services/api/main.py`, añadir después de `import asyncpg`:
```python
import httpx
```

- [ ] **Step 3: Añadir la constante de OpenSky y el endpoint**

Al final de `services/api/main.py`, antes de la función `websocket_endpoint`, añadir:

```python
OPENSKY_CLIENT_ID     = os.getenv("OPENSKY_CLIENT_ID", "")
OPENSKY_CLIENT_SECRET = os.getenv("OPENSKY_CLIENT_SECRET", "")
OPENSKY_TOKEN_URL     = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"

_api_token: str | None = None
_api_token_exp: float  = 0.0


async def _get_opensky_token(client: httpx.AsyncClient) -> str | None:
    global _api_token, _api_token_exp
    import time
    if not OPENSKY_CLIENT_ID or not OPENSKY_CLIENT_SECRET:
        return None
    if _api_token and time.time() < _api_token_exp - 30:
        return _api_token
    try:
        resp = await client.post(
            OPENSKY_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": OPENSKY_CLIENT_ID,
                "client_secret": OPENSKY_CLIENT_SECRET,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        _api_token = data["access_token"]
        _api_token_exp = time.time() + data.get("expires_in", 3600)
        return _api_token
    except Exception as e:
        log.warning(f"Error obteniendo token OpenSky para rutas: {e}")
        return None


@app.get("/routes/{callsign}")
async def get_route(callsign: str, _user: str = Depends(get_current_user)):
    """
    Proxy hacia OpenSky /api/routes para obtener origen/destino de un vuelo.
    Cache en Redis 5 minutos para no saturar la API de OpenSky.
    """
    cs = callsign.upper().strip()
    redis = app.state.redis

    # Cache hit
    cached = await redis.get(f"route:{cs}")
    if cached:
        return json.loads(cached)

    result: dict = {}
    try:
        async with httpx.AsyncClient() as client:
            headers = {}
            token = await _get_opensky_token(client)
            if token:
                headers["Authorization"] = f"Bearer {token}"
            resp = await client.get(
                "https://opensky-network.org/api/routes",
                params={"callsign": cs},
                headers=headers,
                timeout=8,
            )
            if resp.status_code == 200:
                data = resp.json()
                route = data.get("route", [])
                result = {
                    "origin":      route[0] if len(route) > 0 else None,
                    "destination": route[1] if len(route) > 1 else None,
                    "operator":    data.get("operatorIata"),
                    "flight":      data.get("flightNumber"),
                }
            elif resp.status_code == 404:
                result = {}  # Vuelo sin datos de ruta conocidos
            else:
                log.warning(f"OpenSky routes HTTP {resp.status_code} para {cs}")
    except Exception as e:
        log.warning(f"Error consultando ruta {cs}: {e}")

    # Guardar en cache aunque esté vacío (evita spam a OpenSky para vuelos sin datos)
    await redis.setex(f"route:{cs}", 300, json.dumps(result))
    return result
```

- [ ] **Step 4: Verificar que no hay errores de sintaxis**

```bash
cd services/api && python -c "import ast; ast.parse(open('main.py').read()); print('OK')"
```
Esperado: `OK`

- [ ] **Step 5: Commit**

```bash
git add services/api/main.py services/api/requirements.txt
git commit -m "feat(api): añadir endpoint GET /routes/{callsign} con proxy OpenSky y cache Redis"
```

---

### Task 2: Reescribir `useQilinData.js` sin mocks

**Files:**
- Modify: `frontend/src/hooks/useQilinData.js`

- [ ] **Step 1: Reemplazar el contenido completo del hook**

Reemplazar `frontend/src/hooks/useQilinData.js` con:

```javascript
import { useState, useEffect, useRef } from 'react'

const API_BASE   = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_WS_BASE = API_BASE.replace(/^http/, 'ws')

function getToken() {
  return sessionStorage.getItem('qilin_token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function normalizeAircraft(raw) {
  return {
    id:             raw.icao24,
    callsign:       raw.callsign || null,
    type:           raw.category === 'military' ? 'military' : 'civil',
    lat:            raw.lat,
    lon:            raw.lon,
    altitude:       raw.altitude,
    speed:          raw.velocity,
    heading:        raw.heading ?? 0,
    zone:           raw.zone,
    origin_country: raw.origin_country,
  }
}

function normalizeAlert(raw) {
  // Alertas de DB: tienen id, time, zone, severity, rule, title, description, entities
  return {
    id:          raw.id,
    severity:    raw.severity,
    zone:        raw.zone,
    rule:        raw.rule,
    title:       raw.title,
    description: raw.description,
    time:        raw.time,
    // Sin lat/lon — no se renderizan en el mapa pero sí en el panel
  }
}

function getWsUrl() {
  const token = getToken()
  return token ? `${API_WS_BASE}/ws?token=${token}` : `${API_WS_BASE}/ws`
}

export function useQilinData() {
  const [aircraft, setAircraft] = useState([])
  const [alerts,   setAlerts]   = useState([])
  const [wsStatus, setWsStatus] = useState('disconnected')

  const wsRef = useRef(null)

  // ── Carga inicial + polling cada 15s ──────────────────────────
  useEffect(() => {
    let cancelled = false

    async function fetchSnapshot() {
      try {
        const [rawAircraft, rawAlerts] = await Promise.all([
          apiFetch('/aircraft'),
          apiFetch('/alerts?limit=50'),
        ])
        if (cancelled) return
        setAircraft((rawAircraft || []).filter(a => a.lat && a.lon).map(normalizeAircraft))
        setAlerts((rawAlerts || []).map(normalizeAlert))
      } catch (err) {
        // Backend no disponible — mantener estado vacío, no crashear
        console.warn('[useQilinData] fetch failed:', err.message)
      }
    }

    // Solo cargamos alertas en el snapshot inicial; el polling posterior solo actualiza aircraft
    async function pollAircraft() {
      try {
        const raw = await apiFetch('/aircraft')
        if (cancelled) return
        setAircraft((raw || []).filter(a => a.lat && a.lon).map(normalizeAircraft))
      } catch (err) {
        console.warn('[useQilinData] poll failed:', err.message)
      }
    }

    fetchSnapshot()
    const interval = setInterval(pollAircraft, 15_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // ── WebSocket para alertas en tiempo real ─────────────────────
  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(getWsUrl())
        wsRef.current = ws

        ws.onopen  = () => setWsStatus('connected')
        ws.onclose = () => {
          setWsStatus('disconnected')
          setTimeout(connect, 5000)
        }
        ws.onerror = () => setWsStatus('error')

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'alert') {
              setAlerts(prev => [msg.data, ...prev].slice(0, 50))
            }
          } catch (_) {}
        }
      } catch (_) {
        setWsStatus('error')
      }
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  const stats = {
    aircraftTotal: aircraft.length,
    aircraftMil:   aircraft.filter(a => a.type === 'military').length,
    alertsHigh:    alerts.filter(a => a.severity === 'high').length,
    alertsMedium:  alerts.filter(a => a.severity === 'medium').length,
    alertsTotal:   alerts.length,
  }

  return { aircraft, alerts, stats, wsStatus }
}
```

- [ ] **Step 2: Verificar que el archivo no tiene referencias a mockData**

```bash
grep -n "mock\|Mock\|generateAircraft\|generateVessels\|animRef\|frameRef\|requestAnimationFrame" frontend/src/hooks/useQilinData.js
```
Esperado: sin output (ningún match).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useQilinData.js
git commit -m "feat(frontend): reescribir useQilinData — datos reales, quitar mocks y animación"
```

---

### Task 3: Limpiar `App.jsx` — quitar vessels

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Actualizar DEFAULT_FILTERS — quitar vessel keys**

En `frontend/src/App.jsx` reemplazar el bloque `DEFAULT_FILTERS`:

```javascript
const DEFAULT_FILTERS = {
  civil:             true,
  military_aircraft: true,
  alerts:            true,
}
```

- [ ] **Step 2: Actualizar el destructuring de useQilinData**

Reemplazar:
```javascript
const { aircraft, vessels, alerts, stats, wsStatus } = useQilinData()
```
Por:
```javascript
const { aircraft, alerts, stats, wsStatus } = useQilinData()
```

- [ ] **Step 3: Eliminar visibleVessels y los conteos de barcos**

Eliminar completamente estas líneas:
```javascript
const visibleVessels = useMemo(() => vessels.filter(v => {
  if (v.type === 'military') return filters.military_vessel
  if (v.type === 'tanker')   return filters.tanker
  return filters.cargo
}), [vessels, filters])
```

Y en el bloque `counts`, reemplazar con:
```javascript
const counts = useMemo(() => ({
  civil:             aircraft.filter(a => a.type !== 'military').length,
  military_aircraft: aircraft.filter(a => a.type === 'military').length,
  alerts:            alerts.length,
}), [aircraft, alerts])
```

- [ ] **Step 4: Actualizar el render de la vista táctica — quitar vessels de MapView**

En el JSX de la vista táctica, cambiar:
```javascript
<MapView
  aircraft={visibleAircraft}
  vessels={visibleVessels}
  alerts={visibleAlerts}
  flyTarget={flyTarget}
/>
```
Por:
```javascript
<MapView
  aircraft={visibleAircraft}
  alerts={visibleAlerts}
  flyTarget={flyTarget}
/>
```

- [ ] **Step 5: Verificar que no quedan referencias a vessels**

```bash
grep -n "vessel\|Vessel\|cargo\|tanker" frontend/src/App.jsx
```
Esperado: sin output.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): quitar vessels de App — filtros, state y props"
```

---

### Task 4: Limpiar `FilterPanel.jsx` — quitar filtros de barcos

**Files:**
- Modify: `frontend/src/components/FilterPanel.jsx`

- [ ] **Step 1: Actualizar FILTERS_CONFIG**

En `frontend/src/components/FilterPanel.jsx` reemplazar `FILTERS_CONFIG`:

```javascript
const FILTERS_CONFIG = [
  { key: 'civil',             icon: '▲', label: 'Civil',      color: '#00c8ff' },
  { key: 'military_aircraft', icon: '▲', label: 'Mil. Aéreo', color: '#ff3b4a' },
  { key: 'alerts',            icon: '●', label: 'Alertas',    color: '#ff3b4a' },
]
```

- [ ] **Step 2: Verificar que no quedan referencias a barcos**

```bash
grep -n "cargo\|tanker\|military_vessel\|Petróleo\|Naval\|Carga" frontend/src/components/FilterPanel.jsx
```
Esperado: sin output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FilterPanel.jsx
git commit -m "feat(frontend): quitar filtros de embarcaciones del panel"
```

---

### Task 5: Limpiar `BottomBar.jsx` — quitar stat de embarcaciones

**Files:**
- Modify: `frontend/src/components/BottomBar.jsx`

- [ ] **Step 1: Quitar la fila de embarcaciones del array items**

En `frontend/src/components/BottomBar.jsx` reemplazar el array `items`:

```javascript
const items = [
  { icon:'▲', color:'var(--cyan)',  value: stats.aircraftTotal, label:'aeronaves' },
  { icon:'▲', color:'var(--red)',   value: stats.aircraftMil,   label:'militares' },
  { icon:'●', color:'var(--red)',   value: stats.alertsHigh,    label:'high'      },
  { icon:'●', color:'var(--amber)', value: stats.alertsMedium,  label:'medium'    },
]
```

- [ ] **Step 2: Verificar que no hay referencias a vessels/embarcaciones**

```bash
grep -n "vessel\|embarcacion" frontend/src/components/BottomBar.jsx
```
Esperado: sin output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BottomBar.jsx
git commit -m "feat(frontend): quitar stat de embarcaciones de BottomBar"
```

---

### Task 6: Actualizar `MapView.jsx` — quitar vessel layers y ampliar popup con rutas

**Files:**
- Modify: `frontend/src/components/MapView.jsx`

- [ ] **Step 1: Quitar la prop `vessels` y la función `makeShipIcon`**

En `frontend/src/components/MapView.jsx`:

Cambiar la firma del componente de:
```javascript
export default function MapView({ aircraft, vessels, alerts, onFlyTo, flyTarget }) {
```
A:
```javascript
export default function MapView({ aircraft, alerts, flyTarget }) {
```

Eliminar completamente la función `makeShipIcon` (líneas 27-41 aproximadamente).

- [ ] **Step 2: Quitar el registro de iconos de barcos en el evento `load`**

Dentro del callback `map.on('load', () => { ... })`, eliminar estas tres líneas:
```javascript
map.addImage('ship-cargo',    makeShipIcon('#00e5a0'))
map.addImage('ship-tanker',   makeShipIcon('#ffb020'))
map.addImage('ship-military', makeShipIcon('#b06dff', 24))
```

- [ ] **Step 3: Quitar source y layer de vessels en el evento `load`**

Dentro del callback `map.on('load', () => { ... })`, eliminar el bloque:
```javascript
// ── Vessels ──
map.addSource('vessels-src', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })
map.addLayer({ id:'vessels-layer', type:'symbol', source:'vessels-src',
  layout:{ 'icon-image':['get','icon'], 'icon-rotate':['get','heading'],
    'icon-rotation-alignment':'map', 'icon-allow-overlap':true, 'icon-ignore-placement':true,
    'icon-size':1 },
  paint:{ 'icon-opacity':0.88 } })
```

- [ ] **Step 4: Quitar el click handler de vessels-layer**

Cambiar:
```javascript
;['aircraft-layer','vessels-layer'].forEach(layer => {
```
Por:
```javascript
;['aircraft-layer'].forEach(layer => {
```

- [ ] **Step 5: Quitar el useEffect que actualiza vessels**

Eliminar completamente el bloque:
```javascript
// Update vessel source
useEffect(() => {
  if (!ready || !mapRef.current) return
  try {
    mapRef.current.getSource('vessels-src')?.setData(
      toGeoJSON(vessels, v => {
        if (v.type === 'military') return 'ship-military'
        if (v.type === 'tanker')   return 'ship-tanker'
        return 'ship-cargo'
      })
    )
  } catch (_) {}
}, [vessels, ready])
```

- [ ] **Step 6: Añadir estado de ruta al componente**

Después de la línea:
```javascript
const [detail, setDetail] = useState(null)
```
Añadir:
```javascript
const [route, setRoute]   = useState(null)   // { origin, destination, operator, flight } | null
const [routeLoading, setRouteLoading] = useState(false)
```

- [ ] **Step 7: Añadir helper fetchRoute y conectarlo al click**

Después de la declaración de `pulseRef`, añadir la función:
```javascript
async function fetchRoute(callsign) {
  if (!callsign) { setRoute(null); return }
  const token = sessionStorage.getItem('qilin_token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  setRouteLoading(true)
  setRoute(null)
  try {
    const res  = await fetch(`/api/routes/${encodeURIComponent(callsign)}`, { headers })
    const data = res.ok ? await res.json() : {}
    setRoute(data)
  } catch (_) {
    setRoute({})
  } finally {
    setRouteLoading(false)
  }
}
```

- [ ] **Step 8: Llamar a fetchRoute cuando se selecciona un avión**

Dentro del handler de click en `aircraft-layer`, cambiar:
```javascript
map.on('click', layer, e => {
  const props = e.features[0]?.properties
  if (props) setDetail({ ...props, lngLat: e.lngLat })
})
```
Por:
```javascript
map.on('click', layer, e => {
  const props = e.features[0]?.properties
  if (props) {
    setDetail({ ...props, lngLat: e.lngLat })
    fetchRoute(props.label)  // props.label es el callsign
  }
})
```

Y en el handler de click en el mapa vacío (para cerrar el detail), añadir `setRoute(null)`:
```javascript
map.on('click', e => {
  if (!e.features?.length) {
    setDetail(null)
    setRoute(null)
  }
})
```

- [ ] **Step 9: Ampliar el card de detail con la sección de ruta**

En el JSX del card de detail (el `div` con `position:'absolute', top:14, right:14`), añadir la sección de ruta después de los campos existentes y antes del cierre del `div`:

```javascript
{/* Sección ruta */}
<div style={{ borderTop:'1px solid rgba(0,200,255,0.15)', marginTop:'8px', paddingTop:'8px' }}>
  <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'5px' }}>
    Ruta
  </div>
  {routeLoading && (
    <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.4)' }}>Consultando…</div>
  )}
  {!routeLoading && route && (route.origin || route.destination) && (
    <div style={{ fontSize:'11px', color:'#c8d8e8', letterSpacing:'.05em' }}>
      <span style={{ color:'#00c8ff' }}>{route.origin ?? '—'}</span>
      <span style={{ color:'rgba(0,200,255,0.35)', margin:'0 6px' }}>→</span>
      <span style={{ color:'#00c8ff' }}>{route.destination ?? '—'}</span>
    </div>
  )}
  {!routeLoading && route && !route.origin && !route.destination && (
    <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.3)' }}>Sin datos de ruta</div>
  )}
  {!routeLoading && !route && (
    <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.3)' }}>—</div>
  )}
</div>
```

- [ ] **Step 10: Verificar que no quedan referencias a vessels**

```bash
grep -n "vessel\|Vessel\|ship\|Ship\|makeShip" frontend/src/components/MapView.jsx
```
Esperado: sin output.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/MapView.jsx
git commit -m "feat(frontend): quitar vessel layers del mapa y añadir popup de ruta de vuelo"
```

---

### Task 7: Reconstruir el contenedor Docker de la API e integrar

**Files:**
- No files modified — solo verificación e integración

- [ ] **Step 1: Levantar solo infraestructura si no está corriendo**

```bash
docker compose up redis timescaledb -d
```
Esperado: contenedores `qilin_redis` y `qilin_db` running.

- [ ] **Step 2: Reconstruir la imagen de la API**

```bash
docker compose build api
```
Esperado: `Successfully built ...` al final.

- [ ] **Step 3: Levantar todo el stack**

```bash
docker compose up -d
```
Esperado: todos los servicios `Started` o `Running`.

- [ ] **Step 4: Verificar que el endpoint de rutas responde**

```bash
# Obtener un token primero
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -d "username=carlos&password=12345" | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Consultar una ruta
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/routes/IBE3421 | python -m json.tool
```
Esperado: JSON con `origin`, `destination` (pueden ser null si OpenSky no tiene datos del vuelo).

- [ ] **Step 5: Verificar que /aircraft devuelve datos**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/aircraft | python -m json.tool | head -40
```
Esperado: array JSON (puede estar vacío `[]` si OpenSky no tiene aeronaves en las zonas configuradas en ese momento).

- [ ] **Step 6: Levantar el frontend y verificar en navegador**

```bash
cd frontend && npm run dev
```
Abrir `http://localhost:3000`, hacer login con `carlos/12345`.  
Ir a vista Táctica y verificar:
- Los filtros solo muestran: Civil, Mil. Aéreo, Alertas (no hay Carga, Petróleo, Naval Mil)
- El mapa está vacío o muestra aviones reales (sin barcos)
- Al clicar un avión aparece el popup con sección "Ruta"

- [ ] **Step 7: Commit final de integración**

```bash
git add .
git commit -m "chore: integración completa — mapa táctico con datos reales sin mocks"
```
