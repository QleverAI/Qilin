# Qilin — Claude Instructions

## Proyecto

Plataforma de inteligencia geopolítica en tiempo real. Agrega y correlaciona datos de fuentes públicas — aeronaves (ADS-B via Airplanes.live), embarcaciones (AIS via AISHub) y noticias — para generar alertas de eventos geopolíticos con notificaciones vía Telegram.

## Arquitectura

```
ingestor-adsb     ──┐                                      ┌── stream:intel ──┐
ingestor-ais      ──┤                                      │                  │
ingestor-news     ──┼──► Redis + TimescaleDB ──► APScheduler (06/14/22 UTC) ──► Frontend INTEL
ingestor-social   ──┤        (8h lookback)        │                  │
ingestor-docs     ──┤                              ├─ 4 agents ──► agent_findings
ingestor-sec      ──┤                              └─ master ────► analyzed_events (cycle_id)
ingestor-sentinel ──┘                                              │
                                                                    └─► Telegram
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

## API — Endpoints INTEL

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/intel/timeline?hours=N&min_score=N&domain=all` | Timeline unificado master+findings |
| `GET /api/intel/cycle/{cycle_id}` | Master + findings del ciclo |
| `GET /api/intel/spend` | Gasto AI del día (USD) |

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
| `ingestor-polymarket` | — | Mercados de predicción Polymarket (agente de análisis desactivado, ingestor activo) |
| `ingestor-sentinel` | — | Copernicus CDSE OAuth2; monitoriza NO₂/SO₂ por zona; detecta anomalías ≥1.5x baseline (agente de análisis desactivado, ingestor activo) |
| `rsshub` | 1200 | RSSHub self-hosted para fuentes sin RSS directo (Reuters, AP, X/Twitter) |
| `agent-engine` | — | APScheduler (06/14/22 UTC): 4 agentes especialistas (adsb/maritime/news/social) + master (Haiku 4.5) con memoria 24h. Budget cap $5/día. |

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
- `CYCLE_SCHEDULE` — horas UTC de ciclos (default `6,14,22`)
- `CYCLE_HOURS_LOOKBACK` — ventana de análisis (default 8)
- `ENABLED_AGENTS` — lista de agentes activos (default `adsb,maritime,news,social`)
- `DAILY_SPEND_CAP` — cap diario en USD (default 5.00)
- `SPEND_WARN_THRESHOLD` — fracción de cap que dispara warning (default 0.80)
- `FORCE_RUN_CYCLE` — `true` dispara un ciclo al arrancar el container (dev)

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
- `agent_findings` — hypertable con outputs de agentes por ciclo (cycle_id, agent_name, anomaly_score, raw_output)
- `analyzed_events` — master analyses del ciclo (+ columna `cycle_id` desde 2026-04-23)

Redis keys:
- `stream:adsb` — stream de posiciones de aeronaves
- `stream:ais` — stream de posiciones de buques
- `stream:alerts` — stream de alertas (WebSocket lo consume)
- `stream:intel` — stream de findings+master por ciclo (maxlen=500)
- `daily_spend:YYYY-MM-DD` — contador USD gastado por día (TTL 36h)
- `current:aircraft:{icao24}` — posición actual, TTL 120s
- `current:vessel:{mmsi}` — posición actual

## Zonas configurables

`config/zones.yaml` — añadir, quitar o modificar zonas y chokepoints sin tocar código.

## Autenticación

JWT con bcrypt. En modo dev (sin `JWT_SECRET` configurado), la API acepta `carlos/12345`. En producción, configurar `AUTH_USER_N=username:bcrypt_hash` y un `JWT_SECRET` robusto.

## Flujo de inteligencia (agent_engine scheduled)

Cada 8h (06/14/22 UTC) el `agent_engine` dispara un ciclo:

1. Los 4 agentes (adsb/maritime/news/social, Haiku 4.5) hacen barrido GLOBAL de las últimas 8h.
2. Cada agente recibe sus `previous_findings` de los 3 últimos ciclos para detectar continuidad.
3. Findings con `anomaly_score ≥ 7` se notifican a Telegram.
4. Master (Haiku 4.5) sintetiza los findings + memoria de 24h de `analyzed_events`.
5. Master persiste en `analyzed_events` (con `cycle_id`) y siempre manda Telegram (silent si severity<6).

Budget cap `$5/día` con Redis `daily_spend:YYYY-MM-DD`. Al 80% → Telegram warning, al 100% → los ciclos siguientes saltan.

El viejo `alert-engine` (reglas heurísticas reactivas) ha sido retirado. El directorio `services/alert_engine/` se conserva como referencia.

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
