# Spec: Eliminar mocks y conectar datos reales al mapa táctico

**Fecha:** 2026-04-13  
**Alcance:** Solo vista táctica (mapa, alertas). News/Documents/Social conservan sus mocks.  
**Enfoque elegido:** Opción A — REST polling + WebSocket para alertas

---

## Contexto

El frontend arranca con datos ficticios generados en `mockData.js` y los anima localmente con `requestAnimationFrame`. El backend real ya existe y funciona:

- `GET /aircraft` → lee claves `current:aircraft:*` de Redis (TTL 120s, publicadas por el ingestor ADS-B cada 15s)
- `GET /vessels` → lee claves `current:vessel:*` de Redis
- `GET /alerts` → lee tabla `alerts` de TimescaleDB
- `WebSocket /ws` → emite eventos `{type:"alert", data:{...}}` en tiempo real desde `stream:alerts`

El login ya guarda el JWT en `sessionStorage` bajo la clave `qilin_token`.

---

## Cambios en `useQilinData.js`

### Eliminar
- Import de `mockData.js` (`generateAircraft`, `generateVessels`, `MOCK_ALERTS`)
- Estado inicial poblado: reemplazar por arrays vacíos `[]`
- Loop de animación: `tick`, `animRef`, `frameRef`, `useCallback`, el `useEffect` que llama `requestAnimationFrame`

### Añadir

**`fetchSnapshot()`** — función async que se ejecuta al montar y cada 15s:
```
GET /aircraft  → normalizar → setAircraft
GET /vessels   → normalizar → setVessels
```

**Carga inicial de alertas** — se ejecuta solo al montar:
```
GET /alerts?limit=50 → setAlerts
```

**`setInterval` de 15s** — para mantener aircraft y vessels actualizados. Se limpia en el cleanup del `useEffect`.

**Helper de autenticación** — leer el token de `sessionStorage` e incluirlo como `Authorization: Bearer <token>` en cada fetch. Si no hay token, no hacer fetch (el usuario no está logado).

### Sin cambios
El bloque WebSocket existente ya maneja `{type:"alert"}` correctamente — no se toca.

---

## Normalización de datos

El ingestor escribe en Redis con la estructura de OpenSky. El mapa espera una estructura propia. El mapeo se hace dentro de `fetchSnapshot()`:

| Campo Redis/API | Campo frontend | Notas |
|---|---|---|
| `icao24` | `id` | identificador único |
| `callsign` | `callsign` | puede ser `null` |
| `category` | `type` | `"unknown"` → `"civil"` como fallback |
| `velocity` | `speed` | m/s (OpenSky) |
| `heading` | `heading` | grados, puede ser `null` |
| `lat`, `lon` | `lat`, `lon` | directos |
| `altitude` | `altitude` | metros |
| `zone` | `zone` | nombre de zona config |

Para vessels (AIS deshabilitado, datos vacíos por ahora): la API devuelve array vacío — se acepta sin error.

---

## Alertas en el mapa

Las alertas guardadas en DB (`GET /alerts`) tienen zona pero **no tienen coordenadas lat/lon** — la tabla `alerts` solo almacena texto. El componente `AlertPanel` las muestra correctamente. El `MapView` renderiza alertas solo si tienen `lon` y `lat` — las que no las tengan simplemente no aparecen en el mapa (comportamiento correcto, no es un bug).

Las alertas en tiempo real via WebSocket tampoco incluyen coordenadas por diseño actual. Esto es aceptable para esta iteración.

---

## Archivos que cambian

| Archivo | Cambio |
|---|---|
| `frontend/src/hooks/useQilinData.js` | Reescritura completa del hook |
| `frontend/src/data/mockData.js` | Se puede eliminar o dejar (no se importa) |

## Archivos que NO cambian

- `frontend/src/components/MapView.jsx`
- `frontend/src/components/AlertPanel.jsx`
- `frontend/src/components/FilterPanel.jsx`
- `frontend/src/App.jsx`
- Todo el backend
- `mockNews.js`, `mockDocuments.js`, `mockSocial.js`

---

## Estado cuando no hay backend

Si el fetch falla (backend caído), los arrays quedan vacíos. El mapa se muestra vacío — no hay crash. El WebSocket reintenta la conexión cada 5s (ya implementado).

---

## Criterios de éxito

1. Al abrir la vista táctica, el mapa muestra aeronaves reales de OpenSky (o vacío si no hay datos en las zonas configuradas)
2. Cada 15s las posiciones se actualizan
3. Las alertas del panel vienen de la DB, no de constantes hardcodeadas
4. Las nuevas alertas aparecen en tiempo real via WebSocket
5. No hay referencias a `mockData.js` en el código activo
