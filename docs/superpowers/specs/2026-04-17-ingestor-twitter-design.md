# Spec: ingestor_twitter — Ingesta de tweets geopolíticos

**Fecha:** 2026-04-17  
**Estado:** Aprobado

---

## 1. Objetivo

Añadir un nuevo servicio `ingestor_twitter` que ingesta tweets de 20 cuentas geopolíticas prioritarias vía API de X (Twitter), los almacena en TimescaleDB y los expone en la `SocialPage` del frontend con un modal de detalle similar al de noticias.

---

## 2. Arquitectura y flujo de datos

```
ingestor_twitter
  └── polling cada 1h (GET /2/users/:id/tweets)
  └── quota counter en Redis (cap: 300 tweets/día)
  └── dedup por tweet_id en Redis (TTL 48h)
        │
        ▼
  stream:twitter  (Redis Stream, maxlen=1000)
        │
        ▼
  tweets (TimescaleDB hypertable)
        │
        ▼
  FastAPI  →  GET /api/twitter  →  SocialPage (useTwitterData hook)
```

Servicio Docker independiente siguiendo el patrón de `ingestor_news`. No comparte stream ni tabla con noticias — dominios separados.

---

## 3. Cuentas monitorizadas

Archivo de configuración: `config/twitter_accounts.yaml`

20 cuentas iniciales:

| Handle | Categoría |
|--------|-----------|
| @ISWonline | think_tank |
| @OSINTdefender | osint |
| @GeoConfirmed | osint |
| @IntelCrab | osint |
| @DefMon3 | osint |
| @RALee85 | osint |
| @Osinttechnical | osint |
| @Bellingcat | osint |
| @christogrozev | journalist |
| @KofmanMichael | analyst |
| @IanBremmer | analyst |
| @AtlanticCouncil | think_tank |
| @CSIS | think_tank |
| @IISS_org | think_tank |
| @RUSIorg | think_tank |
| @NATO | institutional |
| @StateDept | institutional |
| @CENTCOM | institutional |
| @KyivIndependent | media |
| @RFE_RL | media |

La lista se amplía cambiando solo el YAML, sin tocar código.

---

## 4. Modelo de datos

### Tabla `tweets` (TimescaleDB hypertable, partition por `time`)

```sql
CREATE TABLE tweets (
    tweet_id        TEXT        PRIMARY KEY,
    time            TIMESTAMPTZ NOT NULL,
    author_handle   TEXT        NOT NULL,
    author_name     TEXT,
    category        TEXT,
    content         TEXT        NOT NULL,
    lang            TEXT,
    retweet_count   INT         DEFAULT 0,
    like_count      INT         DEFAULT 0,
    url             TEXT,
    media_urls      JSONB       DEFAULT '[]'
);
SELECT create_hypertable('tweets', 'time');
```

### `media_urls` — estructura de cada elemento JSONB

```json
{ "type": "photo|video|gif", "url": "...", "preview_url": "..." }
```

- `photo`: `url` es la imagen directa
- `video`/`gif`: `url` es null (API Basic no da stream), `preview_url` es el thumbnail

### Redis

- `twitter:seen:{tweet_id}` — dedup, TTL 48h
- `twitter:quota:{YYYY-MM-DD}` — contador diario, TTL 25h
- `stream:twitter` — stream de eventos, maxlen=1000

---

## 5. Ingestor (`services/ingestor_twitter/`)

### Archivos

```
services/ingestor_twitter/
  main.py
  Dockerfile
  requirements.txt
```

### Lógica de `main.py`

1. Carga `config/twitter_accounts.yaml` al arrancar
2. Resuelve handles → user IDs vía `GET /2/users/by` (una sola vez al inicio, cachea en memoria)
3. Cada `TWITTER_POLL_INTERVAL` segundos (default 3600):
   a. Comprueba quota diaria en Redis — si ≥ 300, espera al día siguiente
   b. Por cada cuenta: `GET /2/users/:id/tweets?max_results=10&expansions=attachments.media_keys&media.fields=url,preview_image_url,type&tweet.fields=created_at,public_metrics,lang`
   c. Dedup por `tweet_id` en Redis
   d. Publica en `stream:twitter` + persiste en `tweets`
   e. Incrementa contador de quota
4. Intervalo de cortesía de 2s entre cuentas para respetar rate limits

### Variables de entorno

```
TWITTER_BEARER_TOKEN   — requerido
TWITTER_POLL_INTERVAL  — default 3600 (segundos)
REDIS_URL              — default redis://localhost:6379
DB_URL                 — opcional, si vacío no persiste en DB
```

---

## 6. API (`services/api/`)

Nuevo endpoint en `main.py`:

```
GET /api/twitter?limit=50&offset=0&category=osint
```

- Requiere JWT (`Depends(get_current_user)`)
- Lee de tabla `tweets` ordenado por `time DESC`
- Filtra por `category` si se proporciona
- Responde JSON: `{ tweets: [...], total: N }`

---

## 7. Frontend

### Hook: `src/hooks/useTwitterData.js`

- Fetch a `GET /api/twitter?limit=50` cada 5 minutos
- Devuelve `{ tweets, categories, loading, lastUpdate }`
- Mismo patrón que `useNewsFeed.js`

### `SocialPage` — cambios

- Importa `useTwitterData`
- Feed tipo timeline (lista vertical, no grid) ordenado por fecha
- Sidebar con filtro por categoría: `osint | think_tank | institutional | analyst | journalist | media | todos`
- Buscador por contenido del tweet

### `TweetCard`

- Avatar con inicial del handle + color por categoría
- Handle + nombre + badge de categoría
- Texto del tweet (truncado a 3 líneas)
- Thumbnail del primer media si existe
- Timestamp relativo + likes + RTs
- Click → abre `TweetModal`

### `TweetModal`

Mismo patrón que `NewsModal` (backdrop blur, Escape para cerrar, click fuera cierra):

- Cabecera: avatar + handle + nombre + categoría badge + botón ×
- Media:
  - `photo`: `<img>` a ancho completo (igual que imagen en NewsModal)
  - `video`/`gif`: thumbnail con overlay ▶ — click abre tweet en X
- Texto completo del tweet
- Métricas: ❤ likes · 🔁 RTs
- Timestamp formateado
- Botón "VER EN X ↗" → `https://x.com/{handle}/status/{tweet_id}`

---

## 8. Gestión de quota

- Redis key `twitter:quota:YYYY-MM-DD` se incrementa por cada tweet almacenado
- Cap diario: **300 tweets** (margen seguro con Basic 10k/mes)
- Si se alcanza el cap: el ingestor loguea warning y duerme hasta las 00:00 UTC
- El cap es configurable vía `TWITTER_DAILY_CAP` (default 300)

---

## 9. Docker Compose

Añadir servicio `ingestor_twitter` en `docker-compose.yml`:

```yaml
ingestor_twitter:
  build: ./services/ingestor_twitter
  restart: unless-stopped
  environment:
    - REDIS_URL=redis://redis:6379
    - DB_URL=postgresql://${DB_USER}:${DB_PASSWORD}@timescaledb:5432/qilin
    - TWITTER_BEARER_TOKEN=${TWITTER_BEARER_TOKEN}
    - TWITTER_POLL_INTERVAL=3600
    - TWITTER_DAILY_CAP=300
  volumes:
    - ./config:/app/config
  depends_on:
    - redis
    - timescaledb
```

---

## 10. Base de datos — migración

Añadir en `db/init.sql` (o script de migración):

```sql
CREATE TABLE IF NOT EXISTS tweets (
    tweet_id        TEXT        PRIMARY KEY,
    time            TIMESTAMPTZ NOT NULL,
    author_handle   TEXT        NOT NULL,
    author_name     TEXT,
    category        TEXT,
    content         TEXT        NOT NULL,
    lang            TEXT,
    retweet_count   INT         DEFAULT 0,
    like_count      INT         DEFAULT 0,
    url             TEXT,
    media_urls      JSONB       DEFAULT '[]'
);
SELECT create_hypertable('tweets', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS tweets_author_idx ON tweets (author_handle, time DESC);
CREATE INDEX IF NOT EXISTS tweets_category_idx ON tweets (category, time DESC);
```

---

## 11. Fuera de alcance (futuro)

- Alertas geopolíticas basadas en tweets
- Búsqueda por keywords/hashtags (requiere endpoint diferente)
- Ampliación de cuentas (solo cambia `twitter_accounts.yaml`)
- Upgrade a plan Pro para mayor volumen
