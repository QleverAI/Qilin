# Spec: Eliminar mocks, conectar datos reales y popup de vuelo

**Fecha:** 2026-04-13  
**Alcance:** Vista táctica — mapa y alertas. News/Documents/Social conservan sus mocks.  
**Enfoque:** REST polling (Opción A) + WebSocket para alertas + lookup de rutas on-demand

---

## Contexto

El frontend arranca con datos ficticios de `mockData.js`. El backend real ya funciona:

- `GET /aircraft` → Redis `current:aircraft:*` (TTL 120s, ingestor cada 15s)
- `GET /alerts` → TimescaleDB tabla `alerts`
- `WebSocket /ws` → stream de alertas en tiempo real desde `stream:alerts`
- `GET /vessels` → Redis `current:vessel:*` — **AIS deshabilitado, siempre vacío**

El login guarda JWT en `sessionStorage` bajo `qilin_token`.

---

## 1. Quitar barcos completamente

AIS está deshabilitado por falta de fuente. Los barcos se eliminan de toda la UI:

**`FilterPanel.jsx`** — eliminar las 3 entradas de embarcaciones:
- `cargo` → "Carga"
- `tanker` → "Petróleo"  
- `military_vessel` → "Naval Mil"

Solo quedan: Civil, Mil. Aéreo, Alertas.

**`MapView.jsx`** — eliminar:
- Source y layers `vessels-src` / `vessels-layer`
- Icono `ship-cargo`, `ship-tanker`, `ship-military`
- Funciones `makeShipIcon`

**`App.jsx`** — eliminar:
- `vessels` de destructuring de `useQilinData`
- `visibleVessels` y sus filtros
- Props `vessels` a `MapView`
- Conteos `cargo`, `tanker`, `military_vessel` de `counts`
- `DEFAULT_FILTERS`: quitar `cargo`, `tanker`, `military_vessel`

**`useQilinData.js`** — no llamar a `GET /vessels`, no exponer `vessels` en el return.

---

## 2. Cambios en `useQilinData.js`

### Eliminar
- Import de `mockData.js`
- Estado inicial con mock data — reemplazar por `[]`
- Loop de animación: `tick`, `animRef`, `frameRef`, el `useEffect` de `requestAnimationFrame`

### Añadir

**`fetchSnapshot()`** — al montar y cada 15s:
```
GET /aircraft  → normalizar → setAircraft
```

**Carga inicial de alertas** — solo al montar:
```
GET /alerts?limit=50 → setAlerts
```

**`setInterval` de 15s** — para aircraft. Se limpia en cleanup.

**Token helper** — leer de `sessionStorage('qilin_token')` e incluir como `Authorization: Bearer <token>`.

El WebSocket existente no cambia.

### Normalización aircraft (Redis → frontend)

| Campo API | Campo frontend | Notas |
|---|---|---|
| `icao24` | `id` | identificador único |
| `callsign` | `callsign` | puede ser `null` |
| `category` | `type` | `"unknown"` → `"civil"` como fallback |
| `velocity` | `speed` | m/s |
| `heading` | `heading` | grados, puede ser `null` → 0 |
| `lat`, `lon` | `lat`, `lon` | directo |
| `altitude` | `altitude` | metros |
| `zone` | `zone` | nombre de zona |
| `origin_country` | `origin_country` | país de registro |

---

## 3. Popup de info de vuelo con ruta

Al hacer click en un avión en el mapa, se muestra un panel con:
- Callsign, tipo, zona, velocidad, altitud, rumbo, país de registro
- **Aeropuerto de origen y destino** (IATA + nombre si disponible)

### Fuente de rutas: OpenSky `/api/routes`

OpenSky expone `GET https://opensky-network.org/api/routes?callsign=IBE3421` que devuelve:
```json
{
  "callsign": "IBE3421",
  "route": ["LEMD", "KJFK"],
  "updateTime": 1712345678,
  "operatorIata": "IB",
  "flightNumber": 3421
}
```

### Nuevo endpoint en la API: `GET /routes/{callsign}`

La API hace de proxy hacia OpenSky para evitar problemas de CORS y poder reutilizar credenciales:

```python
@app.get("/routes/{callsign}")
async def get_route(callsign: str, _user = Depends(get_current_user)):
    # Llama a OpenSky /api/routes?callsign={callsign}
    # Si hay credenciales OAuth → las usa
    # Devuelve {origin: "LEMD", destination: "KJFK"} o {} si no hay datos
```

Cache en Redis: `route:{callsign}` con TTL 300s (5 min) para no saturar OpenSky.

### Flujo en el frontend

1. Usuario clica avión → `MapView` setea `detail` con los datos básicos
2. `MapView` hace `GET /api/routes/{callsign}` con el token
3. Mientras carga muestra "Consultando ruta..." 
4. Muestra origen → destino, o "Ruta no disponible" si OpenSky no tiene datos

### UI del popup (sobre el existente en `MapView.jsx`)

El card existente ya muestra zona/velocidad/altitud/rumbo. Se amplía añadiendo:
```
RUTA    MAD → JFK
        LEMD → KJFK
```
Con un estado de carga y fallback elegante si no hay datos.

---

## 4. Alertas

Las alertas en DB no tienen coordenadas lat/lon — el `AlertPanel` las muestra correctamente. El mapa no las renderiza (sin coords no hay marcador). Las nuevas alertas llegan por WebSocket en tiempo real.

---

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `frontend/src/hooks/useQilinData.js` | Reescritura: quitar mocks, añadir fetch real, quitar vessels |
| `frontend/src/components/FilterPanel.jsx` | Quitar 3 filtros de embarcaciones |
| `frontend/src/components/MapView.jsx` | Quitar vessel layers/icons, ampliar popup con rutas |
| `frontend/src/App.jsx` | Quitar vessels de state, filtros y props |
| `services/api/main.py` | Añadir `GET /routes/{callsign}` con cache Redis |

## Archivos que NO cambian

- `services/ingestor_adsb/main.py`
- `services/alert_engine/main.py`
- `db/init.sql`
- Páginas News/Documents/Social y sus mocks

---

## Criterios de éxito

1. El mapa muestra aeronaves reales de OpenSky (o vacío si no hay en las zonas)
2. Las posiciones se actualizan cada 15s
3. No hay embarcaciones en el mapa ni en los filtros
4. Al clicar un avión aparece popup con origen/destino real
5. Las alertas vienen de la DB; las nuevas llegan por WebSocket
6. Sin referencias a `mockData.js` en código activo del mapa táctico
