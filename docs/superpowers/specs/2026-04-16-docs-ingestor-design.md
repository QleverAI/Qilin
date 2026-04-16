# Qilin — Document Ingestor Design

**Date:** 2026-04-16  
**Feature:** `ingestor_docs` — ingestión automática de documentos PDF de organismos oficiales

---

## Goal

Monitorizar ~30 portales de organismos oficiales (defensa, organismos internacionales, think tanks, energía), detectar documentos PDF nuevos, descargarlos, extraer su texto, clasificarlos por sector y relevancia, y mostrarlos en `DocumentsPage` con filtros. En el futuro, los documentos de alta relevancia alimentarán el motor de alertas.

---

## Architecture

Un nuevo servicio Python asyncio `ingestor_docs` sigue el mismo patrón que `ingestor_news`:

```
config/doc_sources.yaml
        │
        ▼
ingestor_docs (cada hora)
  ├── RSS fetch (feedparser) → enlaces a PDFs nuevos
  ├── Scraping (httpx + BeautifulSoup) → enlaces a PDFs nuevos
  ├── Dedup por URL en Redis (TTL 7 días)
  ├── Descarga PDF (httpx)
  ├── Extracción texto (pdfplumber)
  ├── Clasificación sectores/severidad/relevancia (classifier.py compartido)
  └── Persistencia → TimescaleDB `documents`
        │
        ▼
FastAPI GET /docs/feed + /docs/sources
        │
        ▼
useDocsFeed hook → DocumentsPage
```

**Fallos de fuente:** Si una fuente acumula 3 ciclos consecutivos fallidos, el ingestor publica un evento en `stream:alerts` con `rule: scrape_failure` y loguea `ERROR`. El contador de fallos consecutivos se guarda en Redis con clave `docs:failures:{slug}`.

---

## Config: `config/doc_sources.yaml`

Cada fuente define:

```yaml
sources:
  - slug: nato_hq
    name: "NATO HQ"
    country: NATO
    org_type: defense          # defense | international | think_tank | government | energy
    fetch_type: scrape         # rss | scrape
    doc_url: "https://www.nato.int/cps/en/natohq/news.htm"
    mandatory: true            # true → ingestar todo; false → filtrar por keywords del título
    sectors: [militar, diplomacia]
    priority: high
```

**Fuentes iniciales (~30):**

| Categoría | Fuentes |
|-----------|---------|
| Defensa | DoD (EEUU), UK MoD, Ministerio Defensa ES, Bundeswehr DE, Ministère des Armées FR |
| OTAN/Alianzas | NATO HQ, SHAPE, EDA |
| Internacionales | OIEA, OSCE, Consejo de Seguridad ONU, SIPRI |
| Think tanks | ISW, RAND, CSIS, Chatham House, IISS |
| Energía/Economía | AIE, FMI, Banco Mundial |

**Regla de relevancia por `mandatory`:**
- `mandatory: true` → cualquier PDF nuevo se ingesta (fuentes 100% especializadas: OIEA, RAND, ISW…)
- `mandatory: false` → solo se ingesta si el título contiene al menos una keyword de los sectores configurados para esa fuente

---

## Database Schema

Nueva tabla `documents` en TimescaleDB:

```sql
CREATE TABLE IF NOT EXISTS documents (
    id               BIGSERIAL        PRIMARY KEY,
    time             TIMESTAMPTZ      NOT NULL,         -- fecha publicación documento
    discovered_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    title            TEXT             NOT NULL,
    url              TEXT             NOT NULL,
    source           TEXT             NOT NULL,         -- nombre organismo
    source_country   TEXT,                              -- US | UK | ES | NATO | UN...
    org_type         TEXT,                              -- defense | international | think_tank | government | energy
    sectors          TEXT[],
    relevance        INT              DEFAULT 50,
    severity         TEXT             DEFAULT 'low',
    page_count       INT,
    file_size_kb     INT,
    summary          TEXT,                              -- primeros ~1500 chars del texto
    full_text        TEXT,                              -- texto completo para búsqueda/IA futura
    status           TEXT             DEFAULT 'pending', -- pending | processed | failed
    fetch_error      TEXT
);

CREATE UNIQUE INDEX ON documents (url);
CREATE INDEX ON documents (time DESC);
CREATE INDEX ON documents (severity, time DESC);
CREATE INDEX ON documents (org_type, time DESC);
CREATE INDEX ON documents (source_country, time DESC);
CREATE INDEX ON documents USING GIN (sectors);
```

---

## Service: `services/ingestor_docs/`

**Ficheros:**
- `main.py` — loop principal, orquesta RSS y scraping
- `fetcher.py` — lógica de RSS (`feedparser`) y scraping (`httpx` + `BeautifulSoup`)
- `extractor.py` — descarga PDF + extracción de texto (`pdfplumber`) + metadatos (páginas, tamaño)
- `classifier.py` — symlink o copia de `ingestor_news/classifier.py` (mismas funciones `classify_sectors`, `classify_severity`, `compute_relevance`)
- `Dockerfile`, `requirements.txt`

**Loop principal (`main.py`):**
```
while True:
    para cada fuente en doc_sources.yaml (high priority primero):
        entries = fetch_rss(source) | scrape_page(source)
        para cada entry:
            if dedup_redis(url): continue
            if not mandatory and not classify_sectors(title, ""): continue  # solo ingesta si el clasificador detecta al menos un sector
            pdf_bytes, metadata = download_and_extract(url)
            sectors   = classify_sectors(title, summary)
            severity  = classify_severity(title, sectors)
            relevance = compute_relevance(source, sectors, severity)
            persist(db, article)
            redis.setex(f"current:doc:{url_hash}", 7*86400, "1")
        on_source_error: increment_failure_counter(slug)
        if failures >= 3: publish_scrape_alert(slug)
    await asyncio.sleep(POLL_INTERVAL)  # default 3600s
```

**Extractor (`extractor.py`):**
- Descarga el PDF con `httpx` (timeout 60s, max 50 MB)
- Extrae texto con `pdfplumber`: itera páginas, concatena, limpia espacios
- `summary` = primeros 1500 caracteres del texto limpio
- `full_text` = texto completo (hasta 500 KB — documentos mayores se truncan)
- Si `pdfplumber` falla (PDF escaneado/protegido): `status = 'failed'`, `fetch_error = 'text_extraction_failed'`

---

## API Endpoints

Añadir a `services/api/main.py`:

**`GET /docs/feed`**
```
Params: limit, org_type, country, sector, severity, since, q
Returns: list[document] ordenado por time DESC
Fallback: stream:docs en Redis si DB no disponible
```

**`GET /docs/sources`**
```
Returns: list[source] desde doc_sources.yaml
```

---

## Frontend

**`frontend/src/hooks/useDocsFeed.js`**
Mismo patrón que `useNewsFeed`: polling 60s, valores derivados `orgTypes`, `countries`, `sectors`.

**`frontend/src/pages/DocumentsPage.jsx`** — sustituir mocks por datos reales:

- Eliminar `DropZone` (ya no se suben documentos manualmente)
- Sidebar con filtros: severidad, org_type, sector, país
- Lista: título, badge de severidad, país, org_type, fecha, páginas
- Panel detalle: organismo + país + tipo, fechas, tamaño, páginas, sectores, relevancia, summary, botón "ABRIR PDF ↗"
- Banner de alerta rojo en la parte superior si alguna fuente tiene `status: scrape_failure` (consultado desde `stream:alerts`)

---

## Error Handling

| Situación | Acción |
|-----------|--------|
| Fuente HTTP 4xx/5xx | Log warning, incrementar contador fallos |
| 3+ ciclos fallidos | Log ERROR + evento `stream:alerts` con `rule: scrape_failure` |
| PDF > 50 MB | Saltar, log warning |
| PDF sin texto extraíble (escaneado) | `status: failed`, `fetch_error: text_extraction_failed` |
| DB no disponible | Publicar en `stream:docs` Redis, continuar sin persistencia |
| pdfplumber crash | Capturar excepción, marcar `status: failed` |

---

## Docker

Nuevo servicio en `docker-compose.yml`:
```yaml
ingestor-docs:
  build: ./services/ingestor_docs
  environment:
    REDIS_URL: redis://redis:6379
    DB_URL: postgresql://...
    DOCS_POLL_INTERVAL: ${DOCS_POLL_INTERVAL:-3600}
  volumes:
    - ./config:/app/config
  depends_on: [redis, timescaledb]
```

Variable en `.env.example`: `DOCS_POLL_INTERVAL=3600`

---

## What's Out of Scope

- Análisis LLM del contenido (futuro)
- OCR para PDFs escaneados (futuro)
- Correlación documentos ↔ alertas ADS-B/noticias (futuro)
- Subida manual de documentos (eliminada — todo es automático)
