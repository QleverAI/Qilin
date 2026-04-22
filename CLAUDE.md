# Qilin — Claude Instructions

## Proyecto

Plataforma de inteligencia geopolítica en tiempo real. Agrega y correlaciona datos de fuentes públicas — aeronaves (ADS-B via Airplanes.live), embarcaciones (AIS via AISHub) y noticias — para generar alertas de eventos geopolíticos con notificaciones vía Telegram.

## Arquitectura

```
ingestor-adsb     ──┐
ingestor-ais      ──┤
ingestor-news     ──┤
ingestor-social   ──┼──► Redis Streams ──► alert-engine (LLM) ──► Telegram / TimescaleDB
ingestor-docs     ──┤
ingestor-sec      ──┤
ingestor-sentinel ──┘
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + MapLibre GL |
| API | FastAPI + asyncpg + JWT (bcrypt) |
| Ingestores | Python asyncio + httpx + redis.asyncio |
| Motor de alertas | Python asyncio + Redis Streams |
| Base de datos | TimescaleDB (PostgreSQL 16) con hypertables |
| Cache / Bus | Redis 7 Streams |
| Infraestructura | Docker Compose |

## Comandos de desarrollo

### Arrancar todo el stack
```bash
cp .env.example .env   # primera vez: editar con credenciales
docker compose up --build
```

### Solo servicios de infraestructura (para desarrollo local)
```bash
docker compose up redis timescaledb
```

### Frontend (dev server)
```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

### API local
```bash
cd services/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Build frontend para producción
```bash
cd frontend
npm run build
```

## API — Endpoints de posicionamiento

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/aircraft` | Posiciones actuales de aeronaves (desde Redis) |
| `GET /api/aircraft/{icao24}/trail?hours=N` | Trayectoria histórica de aeronave (TimescaleDB, max 72h) |
| `GET /api/aircraft/{icao24}/bases` | Bases detectadas por aeronave |
| `GET /api/aircraft/{icao24}/routes` | Rutas detectadas por aeronave |
| `GET /api/vessels` | Posiciones actuales de buques (desde Redis, sin `unknown`) |
| `GET /api/vessels/{mmsi}/trail?hours=N` | Trayectoria histórica de buque (TimescaleDB, max 72h, default 12h) |
| `GET /api/vessels/{mmsi}/info` | Foto y resumen Wikipedia del buque (caché 24h) |
| `GET /api/vessels/{mmsi}/ports` | Puertos visitados por buque |
| `GET /api/vessels/{mmsi}/routes` | Rutas detectadas por buque |

## Servicios

| Servicio | Puerto | Descripción |
|---------|--------|-------------|
| `api` | 8000 | FastAPI REST + WebSocket en tiempo real |
| Frontend (prod) | 80 | Build estático servido por nginx en el VPS |
| Frontend (dev) | 3000 | React + Vite (proxy `/api` y `/ws` → 8000) |
| `redis` | 6379 | Cache de posiciones actuales + message bus |
| `timescaledb` | 5432 | Almacenamiento histórico con compresión automática 7d |
| `ingestor-adsb` | — | Polling Airplanes.live `/mil` — publica **todos** los militares globales sin filtrar por zona |
| `ingestor-ais` | — | WebSocket aisstream.io; filtra tankers/military/unknown; detecta AIS dark |
| `ingestor-news` | — | RSS de 104 medios geopolíticos; clasifica por sector/severidad; extrae og:image |
| `ingestor-social` | — | RSS vía RSSHub de ~40 cuentas X/Twitter geopolíticas |
| `ingestor-bases` | — | Detecta aterrizajes en `aircraft_positions`; aprende bases y rutas por aeronave |
| `ingestor-docs` | — | Documentos de defensa/geopolítica |
| `ingestor-sec` | — | Filings SEC relevantes |
| `ingestor-polymarket` | — | Mercados de predicción Polymarket |
| `ingestor-sentinel` | — | Copernicus CDSE OAuth2; monitoriza NO₂/SO₂ por zona; detecta anomalías ≥1.5x baseline |
| `rsshub` | 1200 | RSSHub self-hosted para fuentes sin RSS directo (Reuters, AP, X/Twitter) |
| `alert-engine` | — | Motor de reglas + enriquecimiento LLM (claude-haiku-4-5); triage automático; notifica Telegram |

## Variables de entorno clave (ver .env.example)

- `DB_USER` / `DB_PASSWORD` — credenciales PostgreSQL
- `AISSTREAM_API_KEY` — API key de aisstream.io para datos AIS en tiempo real
- `CDSE_USER` / `CDSE_PASSWORD` — credenciales Copernicus Data Space (registro gratuito)
- `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID` — bot para alertas
- `ADSB_POLL_INTERVAL` / `AIS_POLL_INTERVAL` — intervalos en segundos
- `ANTHROPIC_API_KEY` — clave Anthropic para enriquecimiento LLM de alertas
- `SENTINEL_POLL_INTERVAL` — intervalo Sentinel-5P en segundos (default 21600 = 6h)
- `JWT_SECRET` — clave de firma de tokens (cambiar en producción)
- `AUTH_USER_N` — usuarios con formato `username:$2b$12$bcrypt_hash`

## Base de datos

- `aircraft_positions` — hypertable con posiciones ADS-B (compresión 7d)
- `vessel_positions` — hypertable con posiciones AIS (compresión 7d)
- `alerts` — alertas generadas con JSONB `entities`
- `news_events` — noticias con clasificación por sector/severidad e `image_url` (og:image)
- `aircraft_bases` — bases/aeródromos conocidos por aeronave (icao24 + airfield_icao)
- `aircraft_routes` — rutas origen→destino detectadas por aeronave
- `airfields` — catálogo OurAirports (~70k aeródromos con lat/lon e indicador militar)
- `vessel_ports` — puertos visitados por buque (mmsi + port_id + visit_count)
- `vessel_routes` — rutas origen→destino detectadas por buque

Redis keys:
- `stream:adsb` — stream de posiciones de aeronaves
- `stream:ais` — stream de posiciones de buques
- `stream:alerts` — stream de alertas (WebSocket lo consume)
- `current:aircraft:{icao24}` — posición actual, TTL 120s
- `current:vessel:{mmsi}` — posición actual

## Zonas configurables

`config/zones.yaml` — añadir, quitar o modificar zonas y chokepoints sin tocar código.

## Autenticación

JWT con bcrypt. En modo dev (sin `JWT_SECRET` configurado), la API acepta `carlos/12345`. En producción, configurar `AUTH_USER_N=username:bcrypt_hash` y un `JWT_SECRET` robusto.

## Reglas del motor de alertas

`services/alert_engine/main.py`:
- `rule_military_aircraft_surge` — ≥5 aeronaves militares en zona
- `rule_asw_patrol` — ≥2 aviones patrulla ASW por callsign
- `rule_ais_dark` — buque tanker/desconocido sin AIS
- `rule_naval_group` — ≥3 buques militares en zona

Anti-spam: cooldown de 1h por regla+zona. Ventana de correlación: 6h.

## Convenciones de código

### Python
- asyncio puro — sin threading, sin código bloqueante en el loop principal
- Logging con `logging.basicConfig` y prefijo del servicio: `[API]`, `[ADSB]`, `[AIS]`, `[ALERT]`
- Variables de entorno siempre con `os.getenv("KEY", "default")`
- No usar `print()`, solo `log.info/warning/error`

### JavaScript / React
- Componentes funcionales con hooks
- Estado global mínimo en `App.jsx`, props hacia abajo
- CSS-in-JS con objetos `style={{...}}` inline (sin archivos CSS por componente)
- `useMemo` para filtrados derivados de datos que cambian frecuentemente
- WebSocket y polling en `src/hooks/useQilinData.js`

### Docker
- Cada servicio tiene su propio `Dockerfile` y `requirements.txt`
- Volumen `./config` montado en `/app/config` en todos los servicios que lo necesiten

## Cosas importantes a tener en cuenta

- **No hardcodear** credenciales — siempre desde `os.getenv()`
- **El frontend en dev** usa proxy de Vite para `/api` y `/ws` → no hay problema de CORS
- **En producción** el `allow_origins=["*"]` en CORS debe restringirse
- **TimescaleDB** requiere que `init.sql` se ejecute solo en la primera creación del volumen
- **Redis Streams** usan `$` como `last_id` inicial para solo leer mensajes nuevos
- El frontend tiene datos mock en `src/data/` para desarrollo sin backend

## Despliegue en producción

### Hetzner VPS — activo en `178.104.238.122`
- Docker Compose con nginx como reverse proxy (puerto 80)
- Frontend: `npm run build` → `frontend/dist/` servido por nginx
- Git push desde local (el servidor no tiene credenciales GitHub)

## Mapa táctico — comportamiento esperado

- **Filtro de buques**: el frontend solo muestra buques con `category !== 'unknown'` — se muestran military, tanker, cargo, passenger. Los desconocidos se descartan en `useQilinData.js` antes de pasarlos al mapa.
- **Iconos diferenciados por tipo**:
  - Aeronaves: `plane-civil` (cyan), `plane-military` (rojo, flecha), `plane-fighter` (rojo, delta), `plane-helicopter` (naranja, rotor), `plane-transport` (rojo, ala ancha), `plane-surveillance` (violeta), `plane-vip` (dorado)
  - Buques: `ship-military` (rojo, proa aguda), `ship-tanker` (ámbar, casco fino), `ship-cargo` (azul, casco ancho)
  - La clasificación de subtipo de aeronave se hace en `MapView.jsx → getAircraftIcon()` usando el campo `type_code` del ADS-B
- **Trayectoria de buques**: al seleccionar un buque en el panel táctico aparece el botón "RUTA — MOSTRAR TRAYECTORIA". Activa/desactiva una línea discontinua ámbar con las últimas N horas de posiciones (default 12h). Hook: `useVesselTrail`. Renderizado: capas `vessel-trail-line-{mmsi}` en MapView.
- **Trayectoria de aeronaves**: panel TRAYECTORIAS (arriba-izquierda del mapa). Hasta 6 trails simultáneos. Hook: `useAircraftTrail`. Incluye marcadores de bases. Refresco cada 30s.

### Mejoras planificadas
- **ENTSO-E**: ingestor de datos de generación eléctrica europea (cortes de luz como indicador geopolítico)
- **Correlación LLM avanzada**: correlación cruzada entre streams (Sentinel + AIS + noticias)
- **Frontend móvil**: app React Native (Expo) con push notifications
- **Alertas en tiempo real**: WebSocket en el frontend para alertas sin polling
