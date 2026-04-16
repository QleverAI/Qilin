# Qilin — SEC Filings Ingestor Design

**Date:** 2026-04-16  
**Feature:** `ingestor_sec` — monitorización de filings 8-K de ~75 empresas del S&P 500 geopolíticamente relevantes

---

## Goal

Monitorizar los filings 8-K presentados ante la SEC por ~75 empresas de sectores geopolíticamente relevantes (defensa, energía, semiconductores, finanzas, ciberseguridad/infraestructura). Detectar nuevos filings, extraer su texto, clasificarlos por severidad/relevancia y mostrarlos en `FilingsPage` con filtros por sector, empresa y tipo de formulario. En el futuro, alimentarán el motor de alertas para correlacionar eventos geopolíticos con movimientos corporativos.

---

## Architecture

```
config/sec_sources.yaml (~75 empresas: ticker + nombre + sector)
        │
        ▼
ingestor_sec (cada 30 minutos)
  ├── Al arrancar: descarga company_tickers.json de SEC → resuelve CIKs
  ├── Por cada empresa: GET data.sec.gov/submissions/CIK{cik}.json
  ├── Filtra form_type = "8-K", filings no vistos (dedup por accession_number en Redis)
  ├── Descarga documento principal del filing (HTML o PDF)
  ├── Extrae texto (BeautifulSoup para HTML, pdfplumber para PDF)
  ├── Clasifica severidad/relevancia vía classifier.py
  └── Persiste en TimescaleDB `sec_filings`
        │
        ▼
FastAPI GET /sec/feed + /sec/sources
        │
        ▼
useSecFeed hook → FilingsPage
```

**Por qué EDGAR submissions API:**  
`data.sec.gov/submissions/CIK{cik}.json` devuelve los últimos filings en JSON limpio sin scraping ni Playwright. Es la API oficial de la SEC, gratuita, rate limit de 10 req/seg con User-Agent identificado.

**Poll de 30 minutos:** los 8-K se publican durante horario bursátil (9:30–16:00 ET). 30 min de latencia es suficiente para señales de inversión sin saturar la API.

---

## Config: `config/sec_sources.yaml`

```yaml
# Qilin — Empresas S&P 500 monitorizadas para filings SEC
# Sectores: defense | energy | semiconductors | financials | cyber_infra

companies:

  # ── DEFENSA & AEROESPACIAL ─────────────────────────────────────────────────
  - ticker: LMT
    name: "Lockheed Martin"
    sector: defense
    priority: high

  - ticker: RTX
    name: "RTX Corporation"
    sector: defense
    priority: high

  - ticker: NOC
    name: "Northrop Grumman"
    sector: defense
    priority: high

  - ticker: GD
    name: "General Dynamics"
    sector: defense
    priority: high

  - ticker: BA
    name: "Boeing"
    sector: defense
    priority: high

  - ticker: LHX
    name: "L3Harris Technologies"
    sector: defense
    priority: high

  - ticker: LDOS
    name: "Leidos Holdings"
    sector: defense
    priority: medium

  - ticker: HII
    name: "Huntington Ingalls Industries"
    sector: defense
    priority: medium

  - ticker: TDG
    name: "TransDigm Group"
    sector: defense
    priority: medium

  - ticker: HEI
    name: "HEICO Corporation"
    sector: defense
    priority: medium

  - ticker: CW
    name: "Curtiss-Wright"
    sector: defense
    priority: medium

  - ticker: AXON
    name: "Axon Enterprise"
    sector: defense
    priority: medium

  - ticker: CACI
    name: "CACI International"
    sector: defense
    priority: medium

  # ── ENERGÍA ───────────────────────────────────────────────────────────────
  - ticker: XOM
    name: "ExxonMobil"
    sector: energy
    priority: high

  - ticker: CVX
    name: "Chevron"
    sector: energy
    priority: high

  - ticker: COP
    name: "ConocoPhillips"
    sector: energy
    priority: high

  - ticker: OXY
    name: "Occidental Petroleum"
    sector: energy
    priority: high

  - ticker: SLB
    name: "SLB (Schlumberger)"
    sector: energy
    priority: high

  - ticker: HAL
    name: "Halliburton"
    sector: energy
    priority: medium

  - ticker: BKR
    name: "Baker Hughes"
    sector: energy
    priority: medium

  - ticker: MRO
    name: "Marathon Oil"
    sector: energy
    priority: medium

  - ticker: EOG
    name: "EOG Resources"
    sector: energy
    priority: medium

  - ticker: DVN
    name: "Devon Energy"
    sector: energy
    priority: medium

  - ticker: VLO
    name: "Valero Energy"
    sector: energy
    priority: medium

  - ticker: PSX
    name: "Phillips 66"
    sector: energy
    priority: medium

  - ticker: APA
    name: "APA Corporation"
    sector: energy
    priority: medium

  - ticker: HES
    name: "Hess Corporation"
    sector: energy
    priority: medium

  # ── SEMICONDUCTORES ───────────────────────────────────────────────────────
  - ticker: NVDA
    name: "NVIDIA"
    sector: semiconductors
    priority: high

  - ticker: INTC
    name: "Intel"
    sector: semiconductors
    priority: high

  - ticker: QCOM
    name: "Qualcomm"
    sector: semiconductors
    priority: high

  - ticker: AMD
    name: "Advanced Micro Devices"
    sector: semiconductors
    priority: high

  - ticker: AMAT
    name: "Applied Materials"
    sector: semiconductors
    priority: high

  - ticker: LRCX
    name: "Lam Research"
    sector: semiconductors
    priority: medium

  - ticker: KLAC
    name: "KLA Corporation"
    sector: semiconductors
    priority: medium

  - ticker: MU
    name: "Micron Technology"
    sector: semiconductors
    priority: medium

  - ticker: TXN
    name: "Texas Instruments"
    sector: semiconductors
    priority: medium

  - ticker: MRVL
    name: "Marvell Technology"
    sector: semiconductors
    priority: medium

  - ticker: ON
    name: "ON Semiconductor"
    sector: semiconductors
    priority: medium

  - ticker: NXPI
    name: "NXP Semiconductors"
    sector: semiconductors
    priority: medium

  # ── FINANCIALS ────────────────────────────────────────────────────────────
  - ticker: JPM
    name: "JPMorgan Chase"
    sector: financials
    priority: high

  - ticker: GS
    name: "Goldman Sachs"
    sector: financials
    priority: high

  - ticker: MS
    name: "Morgan Stanley"
    sector: financials
    priority: high

  - ticker: C
    name: "Citigroup"
    sector: financials
    priority: high

  - ticker: BAC
    name: "Bank of America"
    sector: financials
    priority: high

  - ticker: WFC
    name: "Wells Fargo"
    sector: financials
    priority: medium

  - ticker: BLK
    name: "BlackRock"
    sector: financials
    priority: medium

  - ticker: BX
    name: "Blackstone"
    sector: financials
    priority: medium

  - ticker: KKR
    name: "KKR & Co"
    sector: financials
    priority: medium

  - ticker: AXP
    name: "American Express"
    sector: financials
    priority: medium

  - ticker: SCHW
    name: "Charles Schwab"
    sector: financials
    priority: medium

  # ── CIBERSEGURIDAD & INFRAESTRUCTURA ──────────────────────────────────────
  - ticker: MSFT
    name: "Microsoft"
    sector: cyber_infra
    priority: high

  - ticker: PLTR
    name: "Palantir Technologies"
    sector: cyber_infra
    priority: high

  - ticker: CRWD
    name: "CrowdStrike"
    sector: cyber_infra
    priority: high

  - ticker: PANW
    name: "Palo Alto Networks"
    sector: cyber_infra
    priority: high

  - ticker: BAH
    name: "Booz Allen Hamilton"
    sector: cyber_infra
    priority: high

  - ticker: SAIC
    name: "SAIC"
    sector: cyber_infra
    priority: medium

  - ticker: NEE
    name: "NextEra Energy"
    sector: cyber_infra
    priority: medium

  - ticker: DUK
    name: "Duke Energy"
    sector: cyber_infra
    priority: medium

  - ticker: SO
    name: "Southern Company"
    sector: cyber_infra
    priority: medium

  - ticker: D
    name: "Dominion Energy"
    sector: cyber_infra
    priority: medium

  - ticker: AEP
    name: "American Electric Power"
    sector: cyber_infra
    priority: medium
```

---

## Database Schema

Nueva tabla `sec_filings` en TimescaleDB:

```sql
CREATE TABLE IF NOT EXISTS sec_filings (
    id               BIGSERIAL     PRIMARY KEY,
    time             TIMESTAMPTZ   NOT NULL,         -- fecha del filing en SEC
    discovered_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    ticker           TEXT          NOT NULL,
    company_name     TEXT          NOT NULL,
    cik              TEXT          NOT NULL,
    form_type        TEXT          NOT NULL,          -- 8-K, 10-K, 10-Q...
    accession_number TEXT          NOT NULL,          -- ID único del filing
    title            TEXT,                            -- descripción del evento (items reportados)
    filing_url       TEXT          NOT NULL,          -- enlace directo al filing en EDGAR
    sector           TEXT,                            -- del config
    severity         TEXT          DEFAULT 'low',
    relevance        INT           DEFAULT 50,
    summary          TEXT,                            -- primeros ~1500 chars del texto
    full_text        TEXT,                            -- texto completo (hasta 500 KB)
    status           TEXT          DEFAULT 'pending'  -- pending | processed | failed
);

CREATE UNIQUE INDEX IF NOT EXISTS sec_filings_accession_key ON sec_filings (accession_number);
CREATE INDEX        IF NOT EXISTS sec_filings_time_idx      ON sec_filings (time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_ticker_idx    ON sec_filings (ticker, time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_sector_idx    ON sec_filings (sector, time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_form_idx      ON sec_filings (form_type, time DESC);
```

---

## Service: `services/ingestor_sec/`

**Ficheros:**
- `main.py` — loop principal
- `edgar.py` — lógica de EDGAR API: resolución de CIKs, fetch de submissions, download de documentos
- `classifier.py` — copia de `ingestor_news/classifier.py`
- `requirements.txt`
- `Dockerfile`

**Resolución de CIKs al arrancar:**

```python
# Descarga https://www.sec.gov/files/company_tickers.json una vez
# Construye dict {ticker: cik_padded_10_digits}
# Ejemplo: {"LMT": "0000936468", "NVDA": "0001045810", ...}
```

**Loop principal (`main.py`):**

```
while True:
    para cada empresa en sec_sources.yaml (high priority primero):
        data = GET data.sec.gov/submissions/CIK{cik}.json
        filings = data["filings"]["recent"]
        para cada filing donde form_type == "8-K":
            if dedup_redis(accession_number): continue
            doc_url = construir URL del documento principal
            text = download_and_extract(doc_url)  # HTML → BS4, PDF → pdfplumber
            severity = classify_severity(title, sectors=[sector])
            relevance = compute_relevance(company, sector, severity)
            persist(db, filing)
            redis.setex(f"sec:{accession_number}", 7*86400, "1")
        await asyncio.sleep(0.5)  # cortesía entre empresas
    log("Ciclo completo")
    await asyncio.sleep(SEC_POLL_INTERVAL)  # default 1800s
```

**Construcción de URL del documento principal:**

```python
# accession_number: "0000936468-24-000123" → "0000936468/24/000123"
# URL: https://www.sec.gov/Archives/edgar/data/{cik}/{acc_nodash}/{primary_doc}
# El fichero principal suele ser el .htm listado en el índice del filing
```

**Headers SEC obligatorios:**

```
User-Agent: Qilin/1.0 geopolitical-intelligence-platform admin@qilin.local
```
(SEC requiere User-Agent identificado — sin él devuelve 403)

---

## API Endpoints

Añadir a `services/api/main.py`:

**`GET /sec/feed`**
```
Params: limit, sector, ticker, form_type, severity, since, q
Returns: list[filing] ORDER BY time DESC
```

**`GET /sec/sources`**
```
Returns: list[company] desde sec_sources.yaml con consecutive_failures desde Redis
```

---

## Frontend

**`frontend/src/hooks/useSecFeed.js`**  
Mismo patrón que `useDocsFeed`: polling 60s, derivados `sectors`, `tickers`, `formTypes`.

**`frontend/src/pages/FilingsPage.jsx`**

- Sidebar: filtros sector, form_type, búsqueda por ticker/nombre
- Lista (`FilingRow`): ticker badge, nombre empresa, título del filing, sector, fecha
- Panel detalle: ticker + nombre + sector, form_type, fecha, accession number, relevancia, resumen, botón "VER EN EDGAR ↗"
- Empty state: "Ingestor SEC no activo o sin filings aún"

**`App.jsx`**: añadir ruta "markets" → `FilingsPage` en el menú lateral

---

## Docker

```yaml
ingestor-sec:
  build: ./services/ingestor_sec
  container_name: qilin_ingestor_sec
  restart: unless-stopped
  environment:
    REDIS_URL: redis://redis:6379
    DB_URL: postgresql://${DB_USER:-qilin}:${DB_PASSWORD:-changeme}@timescaledb:5432/qilin
    SEC_POLL_INTERVAL: ${SEC_POLL_INTERVAL:-1800}
  volumes:
    - ./config:/app/config
  depends_on:
    - redis
    - timescaledb
```

Variable en `.env.example`: `SEC_POLL_INTERVAL=1800`

---

## Error Handling

| Situación | Acción |
|-----------|--------|
| EDGAR API 429 (rate limit) | Retry con backoff exponencial (1s → 2s → 4s, max 3 reintentos) |
| Empresa no encontrada en company_tickers.json | Log warning, saltar empresa |
| Documento principal no descargable | `status: failed`, `fetch_error: str(e)[:200]` |
| DB no disponible | Continuar sin persistencia, log warning |
| 3+ ciclos fallidos por empresa | Publicar en `stream:alerts` con `rule: sec_fetch_failure` |

---

## What's Out of Scope

- Datos de precio en tiempo real (requiere proveedor externo — proyecto separado)
- Índices bursátiles extranjeros (LSE, DAX, etc.) — futuro
- 10-K y 10-Q (el schema los soporta, añadir al config cuando sea necesario)
- Análisis LLM del contenido del filing — futuro
- Correlación automática filing ↔ evento geopolítico — futuro
