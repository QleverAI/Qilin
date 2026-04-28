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
| `GET /api/aircraft/history?hours=N` | Lista aeronaves vistas en las últimas N horas (máx. 72h, desde aircraft_positions) |
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

## API — Endpoints de personalización de topics

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/topics` | Catálogo público de topics (~65, desde `config/topics.yaml`). Cache TTL 3600s. |
| `GET /api/me/topics` | Topics suscritos por el usuario + límite del plan |
| `PUT /api/me/topics` | Actualiza topics del usuario (respeta límite del plan; 400 si excede) |
| `GET /api/me/telegram` | Configuración Telegram del usuario |
| `PUT /api/me/telegram` | Guarda `telegram_chat_id` |
| `POST /api/me/telegram/test` | Envía mensaje de prueba al `chat_id` configurado |

Los endpoints `/news/feed`, `/social/feed` e `/intel/timeline` aceptan `?topics_only=true` para filtrar por los topics suscritos del usuario autenticado. Cuando `topics_only=true` la respuesta **no** se cachea (es per-usuario).

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
- `DB_POOL_MIN` / `DB_POOL_MAX` — conexiones mínimas/máximas del pool asyncpg en la API (default `4`/`20`)
- `CYCLE_SCHEDULE` — horas UTC de ciclos (default `6,14,22`)
- `CYCLE_HOURS_LOOKBACK` — ventana de análisis (default 8)
- `ENABLED_AGENTS` — lista de agentes activos (default `adsb,maritime,news,social`)
- `DAILY_SPEND_CAP` — cap diario en USD (default 5.00)
- `SPEND_WARN_THRESHOLD` — fracción de cap que dispara warning (default 0.80)
- `FORCE_RUN_CYCLE` — `true` dispara un ciclo al arrancar el container (dev)
- `STRIPE_SECRET_KEY` — clave secreta Stripe (sk_test_... / sk_live_...)
- `STRIPE_PUBLISHABLE_KEY` — clave pública Stripe (pk_test_... / pk_live_...)
- `STRIPE_WEBHOOK_SECRET` — secreto de endpoint webhook Stripe (whsec_...). Vacío = sin verificación de firma (solo dev).
- `STRIPE_PRICE_ANALYST` — Price ID del plan Analyst en Stripe (price_...)
- `STRIPE_PRICE_COMMAND` — Price ID del plan Command en Stripe (price_...)
- `STRIPE_SUCCESS_URL` — URL de redirección tras pago exitoso (default: http://178.104.238.122/success?session_id={CHECKOUT_SESSION_ID})
- `STRIPE_CANCEL_URL` — URL de redirección si el usuario cancela (default: http://178.104.238.122/register)

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
- `agent_findings` — hypertable con outputs de agentes por ciclo (cycle_id, agent_name, anomaly_score, raw_output, topics TEXT[])
- `analyzed_events` — master analyses del ciclo (cycle_id, topics TEXT[])
- `news_events` — noticias (topics TEXT[] añadida 2026-04-24)
- `social_posts` — posts sociales (topics TEXT[] añadida 2026-04-24)
- `user_topics` — subscripciones de topics por usuario (PK: user_id + topic_id)
- `users.telegram_chat_id` — chat ID de Telegram del usuario (añadida 2026-04-24)
- `users.plan` — plan del usuario: free | scout | analyst | command | pro (default 'free'). `command` y `pro` son ilimitados (mismo límite de topics). `command` es el nombre actual en frontend/Stripe; `pro` es alias legacy.

Redis keys:
- `stream:adsb` — stream de posiciones de aeronaves
- `stream:ais` — stream de posiciones de buques
- `stream:alerts` — stream de alertas (WebSocket lo consume)
- `stream:intel` — stream de findings+master por ciclo (maxlen=500)
- `daily_spend:YYYY-MM-DD` — contador USD gastado por día (TTL 36h)
- `current:aircraft:{icao24}` — posición actual, TTL 120s
- `current:vessel:{mmsi}` — posición actual
- `cache:{prefix}:{hash}` — cache de respuestas de la API (ver "Capa de cache")

## Capa de cache

Tres niveles coordinados para minimizar trabajo repetido y latencia percibida:

1. **Redis API cache** (`services/api/main.py`): decorator `@cached(prefix, ttl)` sobre endpoints user-agnostic. La clave es `cache:{prefix}:{sha1(kwargs)[:16]}`. Si Redis no está disponible el decorator es transparente y el endpoint sirve sin cache. Función `invalidate_cache(prefix)` para limpiar por prefijo (no se dispara automáticamente desde los ingestores — decisión abierta).
2. **ETag + Cache-Control middleware** (mismo archivo): calcula `ETag = sha1(body)[:16]`, responde `304 Not Modified` si `If-None-Match` coincide (comparación weak que ignora prefijo `W/` añadido por nginx al gzipar). Añade `Cache-Control: private, max-age=N` a rutas cacheables y `no-store` al resto; `Vary: Authorization` siempre.
3. **Cliente** (`frontend/src/hooks/feedCache.js`): `fetchWithCache` deduplica peticiones en vuelo y mantiene cache en memoria del módulo (sobrevive al desmontar la página dentro de la SPA) + persistencia en `localStorage` con TTL de 5 minutos (sobrevive a F5). `prefetch(url)` precalienta silenciosamente. AppShell llama a `prefetchNewsFeed/Social/Docs/Markets/Polymarket/IntelTimeline` al montar.

### TTLs aplicados (prefix → TTL seg)

| Endpoint FastAPI       | Prefix            | TTL |
|------------------------|-------------------|----:|
| `/news/feed`           | `news.feed`       |  60 |
| `/news/sources`        | `news.sources`    | 300 |
| `/social/feed`         | `social.feed`     |  60 |
| `/social/accounts`     | `social.accounts` | 300 |
| `/docs/feed`           | `docs.feed`       | 120 |
| `/docs/sources`        | `docs.sources`    | 300 |
| `/sec/feed`            | `sec.feed`        | 120 |
| `/sec/sources`         | `sec.sources`     | 300 |
| `/polymarket/feed`     | `polymarket.feed` |  60 |
| `/markets/quotes`      | `markets.quotes`  |  60 |
| `/intel/timeline`      | `intel.timeline`  |  30 |
| `/intel/spend`         | `intel.spend`     |  10 |
| `/api/stats`           | `api.stats`       |  60 |
| `/aircraft/history`    | `aircraft.history`|  60 |
| `/topics`              | `topics.catalog`  |3600 |

Los TTLs del middleware `Cache-Control: max-age=N` coinciden con los del decorator por diseño (ambos se leen del mismo `CACHEABLE_PATHS`).

### Rutas explícitamente NO cacheadas

Todo lo que va por usuario o cambia segundo a segundo: `/aircraft`, `/vessels`, `/me`, `/favorites`, `/vessel-favorites`, `/source-favorites`, `/chat`, `/auth/*`, `/reports*`, `/analyzed-events*`, `/sentinel/zones`. Estas reciben `Cache-Control: no-store`.

### nginx

`/etc/nginx/sites-available/qilin` tiene `gzip on` con `gzip_min_length 1024` y tipos `application/json text/css application/javascript text/plain`. Reduce `news/feed` de ~800 KB a ~240 KB. La config vive en el repo en `deploy/nginx/qilin.conf` como referencia (el fichero en el VPS se edita a mano con `.deploy_ssh.py`).

### Invalidación

- **Reactiva desde ingestores** (activa): tras cada ciclo con ≥1 item nuevo, el ingestor publica el prefijo en el canal Redis `cache.invalidate`. La API (cualquier réplica) está suscrita y borra las claves `cache:{prefix}:*`. Mapeo actual: `ingestor_news → news.feed`, `ingestor_social → social.feed`, `ingestor_docs → docs.feed`, `ingestor_sec → sec.feed`, `ingestor_polymarket → polymarket.feed`, `agent_engine → intel.timeline` + `intel.spend` tras cada ciclo 06/14/22 UTC.
- **Manual**:
  - Desde Python con la API corriendo: `await invalidate_cache("news.feed")`.
  - Desde CLI de Redis (pub/sub): `redis-cli PUBLISH cache.invalidate news.feed`.
  - Borrado directo: `redis-cli --scan --pattern 'cache:news.feed:*' | xargs -r redis-cli DEL`.

## Zonas configurables

`config/zones.yaml` — añadir, quitar o modificar zonas y chokepoints sin tocar código.

## Topics catalog

`config/topics.yaml` — catálogo de ~65 topics predefinidos (sector/commodity/company/zone) con keywords para keyword matching. Debe estar montado en `/app/config/` en los containers `api`, `agent-engine` e `ingestor-news`. Ruta configurable con la variable de entorno `TOPICS_CONFIG_PATH` (default `/app/config/topics.yaml`).

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

## Stripe — Pagos y suscripciones

- **Modo**: test (`sk_test_` / `pk_test_`). Productos activos: Analyst (50€/mes, `price_1TRAoK6qqTx6uExBLsteLy0p`) y Command (200€/mes, `price_1TRAyP6qqTx6uExBGaTrBJl0`).
- **Flujo de checkout**: usuario se registra → API crea Checkout Session → frontend redirige a Stripe → webhook activa plan en DB. El plan queda como `free` hasta que el webhook confirma el pago.
- **Endpoints**:
  - `POST /stripe/create-checkout-session` (JWT req.) — recibe `{plan: "analyst"|"command"}`, devuelve `{url}`.
  - `POST /stripe/webhook` — sin JWT; verifica firma con `STRIPE_WEBHOOK_SECRET` si está configurado.
- **Webhook en Stripe dashboard**: registrar `http://178.104.238.122/api/stripe/webhook` con evento `checkout.session.completed`. El secreto `whsec_...` generado hay que añadirlo a `.env` como `STRIPE_WEBHOOK_SECRET`.
- **Librería**: `stripe==10.*` en `services/api/requirements.txt`.
- **Páginas**: `/success` (redirige a `/app` a los 5s) y `/cancel` (vuelve a `/register`).
- **Sentinel nav**: oculto del TopBar web hasta que el ingestor esté desplegado con credenciales CDSE.

### Mejoras planificadas
- **ENTSO-E**: ingestor de datos de generación eléctrica europea (cortes de luz como indicador geopolítico)
- **Correlación LLM avanzada**: correlación cruzada entre streams (Sentinel + AIS + noticias)
- **Frontend móvil**: app React Native (Expo) con push notifications
- **Alertas en tiempo real**: WebSocket en el frontend para alertas sin polling
