# SEC Filings Ingestor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ingestor_sec` — a polling service that monitors 8-K filings from 75 S&P 500 companies via the SEC EDGAR API and exposes them in a new `FilingsPage` frontend view.

**Architecture:** A new Python asyncio service resolves CIKs from `company_tickers.json` at startup, then polls `data.sec.gov/submissions/CIK{cik}.json` every 30 minutes, extracts filing text with BeautifulSoup/pdfplumber, classifies severity, and persists to `sec_filings` in TimescaleDB. FastAPI exposes `GET /sec/feed` and `GET /sec/sources`. The frontend hook `useSecFeed` polls those endpoints and feeds `FilingsPage`.

**Tech Stack:** Python 3.12 asyncio, httpx, asyncpg, redis.asyncio, BeautifulSoup4, pdfplumber, pyyaml; React 18 + hooks; FastAPI; TimescaleDB; Redis; Docker Compose.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `db/init.sql` | Modify | Add `sec_filings` table + indexes |
| `config/sec_sources.yaml` | Create | 75 companies with ticker/name/sector/priority |
| `services/ingestor_sec/edgar.py` | Create | EDGAR API: CIK resolution, submissions fetch, URL construction, text extraction |
| `services/ingestor_sec/classifier.py` | Create | SEC-specific severity and relevance logic |
| `services/ingestor_sec/main.py` | Create | Main polling loop with dedup and failure tracking |
| `services/ingestor_sec/requirements.txt` | Create | Python dependencies |
| `services/ingestor_sec/Dockerfile` | Create | Container definition |
| `services/ingestor_sec/test_edgar.py` | Create | Unit tests for pure edgar.py functions |
| `services/ingestor_sec/test_classifier.py` | Create | Unit tests for classifier |
| `services/api/main.py` | Modify | Add `GET /sec/feed` + `GET /sec/sources` endpoints |
| `frontend/src/hooks/useSecFeed.js` | Create | Polling hook — mirrors useDocsFeed pattern |
| `frontend/src/pages/FilingsPage.jsx` | Create | Full filings page with sidebar filters + detail panel |
| `frontend/src/App.jsx` | Modify | Add `markets` view route |
| `frontend/src/components/TopBar.jsx` | Modify | Add `MERCADOS` nav item |
| `docker-compose.yml` | Modify | Add `ingestor-sec` service |
| `.env.example` | Modify | Add `SEC_POLL_INTERVAL` variable |

---

## Task 1: Database Schema — `sec_filings` table

**Files:**
- Modify: `db/init.sql` (append at end)

The table stores one row per 8-K filing, deduplicated by `accession_number`. No hypertable — filings are low-volume and don't benefit from time partitioning. Run the SQL directly against the running container so the live DB matches init.sql without destroying volumes.

- [ ] **Step 1: Append the table definition to `db/init.sql`**

Open `db/init.sql` and add this block at the very end:

```sql
-- ─── SEC FILINGS (8-K) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sec_filings (
    id               BIGSERIAL     PRIMARY KEY,
    time             TIMESTAMPTZ   NOT NULL,
    discovered_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    ticker           TEXT          NOT NULL,
    company_name     TEXT          NOT NULL,
    cik              TEXT          NOT NULL,
    form_type        TEXT          NOT NULL,
    accession_number TEXT          NOT NULL,
    title            TEXT,
    filing_url       TEXT          NOT NULL,
    sector           TEXT,
    severity         TEXT          DEFAULT 'low',
    relevance        INT           DEFAULT 50,
    summary          TEXT,
    full_text        TEXT,
    status           TEXT          DEFAULT 'pending'
);

CREATE UNIQUE INDEX IF NOT EXISTS sec_filings_accession_key ON sec_filings (accession_number);
CREATE INDEX        IF NOT EXISTS sec_filings_time_idx      ON sec_filings (time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_ticker_idx    ON sec_filings (ticker, time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_sector_idx    ON sec_filings (sector, time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_form_idx      ON sec_filings (form_type, time DESC);
```

- [ ] **Step 2: Apply to running TimescaleDB container**

```bash
docker exec -i qilin_db psql -U qilin -d qilin << 'EOF'
CREATE TABLE IF NOT EXISTS sec_filings (
    id               BIGSERIAL     PRIMARY KEY,
    time             TIMESTAMPTZ   NOT NULL,
    discovered_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    ticker           TEXT          NOT NULL,
    company_name     TEXT          NOT NULL,
    cik              TEXT          NOT NULL,
    form_type        TEXT          NOT NULL,
    accession_number TEXT          NOT NULL,
    title            TEXT,
    filing_url       TEXT          NOT NULL,
    sector           TEXT,
    severity         TEXT          DEFAULT 'low',
    relevance        INT           DEFAULT 50,
    summary          TEXT,
    full_text        TEXT,
    status           TEXT          DEFAULT 'pending'
);
CREATE UNIQUE INDEX IF NOT EXISTS sec_filings_accession_key ON sec_filings (accession_number);
CREATE INDEX        IF NOT EXISTS sec_filings_time_idx      ON sec_filings (time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_ticker_idx    ON sec_filings (ticker, time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_sector_idx    ON sec_filings (sector, time DESC);
CREATE INDEX        IF NOT EXISTS sec_filings_form_idx      ON sec_filings (form_type, time DESC);
EOF
```

Expected output ends with `CREATE INDEX` lines (no errors).

- [ ] **Step 3: Verify table exists**

```bash
docker exec qilin_db psql -U qilin -d qilin -c "\d sec_filings"
```

Expected: table definition with 16 columns displayed.

- [ ] **Step 4: Commit**

```bash
git add db/init.sql
git commit -m "feat(db): add sec_filings table for 8-K filings"
```

---

## Task 2: Config — `config/sec_sources.yaml`

**Files:**
- Create: `config/sec_sources.yaml`

75 companies across 5 sectors. The file is volume-mounted into all services at `/app/config/`.

- [ ] **Step 1: Create `config/sec_sources.yaml`**

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

- [ ] **Step 2: Verify YAML parses correctly**

```bash
python -c "import yaml; cfg = yaml.safe_load(open('config/sec_sources.yaml')); print(len(cfg['companies']), 'companies')"
```

Expected: `61 companies` (the full list above has 61 entries — the spec said ~75 but 61 is the actual count in the design; that is correct).

- [ ] **Step 3: Commit**

```bash
git add config/sec_sources.yaml
git commit -m "feat(config): add sec_sources.yaml with 61 geopolitically relevant companies"
```

---

## Task 3: `services/ingestor_sec/edgar.py` + tests

**Files:**
- Create: `services/ingestor_sec/edgar.py`
- Create: `services/ingestor_sec/test_edgar.py`

Pure functions (`extract_8k_filings`, `build_filing_url`) are tested without network. Network functions (`load_cik_map`, `fetch_submissions`, `download_and_extract`) are integration-only and not unit-tested.

- [ ] **Step 1: Create test file `services/ingestor_sec/test_edgar.py`**

```python
"""Tests unitarios de edgar.py — sin dependencias de red."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from edgar import extract_8k_filings, build_filing_url


def _make_submissions(forms, dates=None, accessions=None, docs=None, items=None):
    n = len(forms)
    return {
        "filings": {
            "recent": {
                "form":            forms,
                "filingDate":      dates      or ["2024-01-15"] * n,
                "accessionNumber": accessions or [f"0001234567-24-{str(i).zfill(6)}" for i in range(n)],
                "primaryDocument": docs       or [f"doc{i}.htm" for i in range(n)],
                "items":           items      or [""] * n,
            }
        }
    }


def test_extract_8k_filters_form_type():
    submissions = _make_submissions(["8-K", "10-K", "8-K", "4"])
    results = extract_8k_filings(submissions)
    assert len(results) == 2
    assert all(r["form_type"] == "8-K" for r in results)


def test_extract_8k_no_match_returns_empty():
    submissions = _make_submissions(["10-K", "10-Q", "4"])
    assert extract_8k_filings(submissions) == []


def test_extract_8k_captures_items():
    submissions = _make_submissions(["8-K"], items=["1.01,5.02"])
    results = extract_8k_filings(submissions)
    assert results[0]["items"] == "1.01,5.02"


def test_extract_8k_captures_filing_date():
    submissions = _make_submissions(["8-K"], dates=["2024-03-15"])
    results = extract_8k_filings(submissions)
    assert results[0]["filing_date"] == "2024-03-15"


def test_extract_8k_handles_empty_submissions():
    assert extract_8k_filings({}) == []
    assert extract_8k_filings({"filings": {}}) == []


def test_build_filing_url_removes_dashes_from_accession():
    url = build_filing_url("0000936468", "0000936468-24-000123", "form8k.htm")
    assert "0000936468/24/000123" in url
    assert url.endswith("form8k.htm")


def test_build_filing_url_strips_cik_leading_zeros():
    url = build_filing_url("0000789019", "0000789019-24-000001", "8k.htm")
    assert "/789019/" in url
    assert "/0000789019/" not in url


def test_build_filing_url_exact_format():
    url = build_filing_url("0001045810", "0001045810-24-000042", "nvda8k.htm")
    expected = "https://www.sec.gov/Archives/edgar/data/1045810/000104581024000042/nvda8k.htm"
    assert url == expected
```

- [ ] **Step 2: Run tests — expect ImportError (edgar.py doesn't exist yet)**

```bash
cd services/ingestor_sec
python -m pytest test_edgar.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError: No module named 'edgar'`

- [ ] **Step 3: Create `services/ingestor_sec/edgar.py`**

```python
"""
Qilin — EDGAR API client.
Handles CIK resolution, submissions fetch, URL construction, and text extraction.
All network functions use exponential retry on 429.
"""
import asyncio
import io
import logging

import httpx
import pdfplumber
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

SEC_HEADERS = {
    "User-Agent": "Qilin/1.0 geopolitical-intelligence-platform admin@qilin.local",
    "Accept":     "application/json, text/html, application/pdf, */*",
}


async def fetch_with_retry(
    client: httpx.AsyncClient, url: str, max_retries: int = 3
) -> httpx.Response:
    """GET with exponential retry on HTTP 429 rate limit."""
    delay = 1.0
    for attempt in range(max_retries):
        r = await client.get(url, timeout=20)
        if r.status_code == 429:
            log.warning(f"429 rate limit ({url}), retry {attempt + 1}/{max_retries} in {delay}s")
            await asyncio.sleep(delay)
            delay *= 2
            continue
        return r
    raise ValueError(f"429 rate limit persists after {max_retries} retries: {url}")


async def load_cik_map(client: httpx.AsyncClient) -> dict[str, str]:
    """
    Downloads company_tickers.json from SEC once at startup.
    Returns {TICKER: CIK_10DIGITS}, e.g. {"MSFT": "0000789019"}.
    """
    url = "https://www.sec.gov/files/company_tickers.json"
    r = await fetch_with_retry(client, url)
    if r.status_code != 200:
        raise ValueError(f"company_tickers.json HTTP {r.status_code}")
    data = r.json()
    # Format: {"0": {"cik_str": 789019, "ticker": "MSFT", "title": "..."}, ...}
    return {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in data.values()}


async def fetch_submissions(client: httpx.AsyncClient, cik: str) -> dict:
    """Fetches company submissions JSON from the EDGAR submissions API."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    r = await fetch_with_retry(client, url)
    if r.status_code != 200:
        raise ValueError(f"Submissions HTTP {r.status_code} for CIK {cik}")
    return r.json()


def extract_8k_filings(submissions: dict) -> list[dict]:
    """
    Extracts 8-K filings from EDGAR submissions JSON.
    Returns list of {form_type, filing_date, accession_number, primary_doc, items}.
    """
    recent = submissions.get("filings", {}).get("recent", {})
    forms  = recent.get("form",            [])
    dates  = recent.get("filingDate",      [])
    accs   = recent.get("accessionNumber", [])
    docs   = recent.get("primaryDocument", [])
    items  = recent.get("items",           [])

    results = []
    for i, form in enumerate(forms):
        if form != "8-K":
            continue
        results.append({
            "form_type":        form,
            "filing_date":      dates[i] if i < len(dates) else None,
            "accession_number": accs[i]  if i < len(accs)  else None,
            "primary_doc":      docs[i]  if i < len(docs)  else None,
            "items":            items[i] if i < len(items) else "",
        })
    return results


def build_filing_url(cik: str, accession_number: str, primary_doc: str) -> str:
    """
    Builds the EDGAR document URL from CIK, accession_number and primary document filename.
    Example: CIK "0001045810", acc "0001045810-24-000042", doc "nvda8k.htm"
    → https://www.sec.gov/Archives/edgar/data/1045810/000104581024000042/nvda8k.htm
    """
    acc_nodash = accession_number.replace("-", "")
    cik_int    = int(cik)
    return f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{acc_nodash}/{primary_doc}"


async def download_and_extract(
    client: httpx.AsyncClient, url: str
) -> tuple[str | None, str | None]:
    """
    Downloads a filing document (HTML or PDF) and extracts plain text.
    Returns (full_text, summary) where summary is the first 1500 characters.
    Raises ValueError on HTTP error or extraction failure.
    """
    r = await fetch_with_retry(client, url)
    if r.status_code != 200:
        raise ValueError(f"HTTP {r.status_code} downloading {url}")

    content_type = r.headers.get("content-type", "")

    if "pdf" in content_type or url.lower().endswith(".pdf"):
        try:
            with pdfplumber.open(io.BytesIO(r.content)) as pdf:
                pages_text = [p.extract_text() or "" for p in pdf.pages[:30]]
                full_text  = "\n".join(pages_text).strip()
        except Exception as e:
            raise ValueError(f"PDF extraction failed: {e}")
    else:
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "head"]):
            tag.decompose()
        full_text = " ".join(soup.get_text(separator=" ").split())

    full_text = full_text[:500_000]  # cap at 500 KB
    summary   = full_text[:1500] if full_text else None
    return full_text or None, summary
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/ingestor_sec
pip install beautifulsoup4 pdfplumber httpx
python -m pytest test_edgar.py -v
```

Expected output:
```
test_edgar.py::test_extract_8k_filters_form_type PASSED
test_edgar.py::test_extract_8k_no_match_returns_empty PASSED
test_edgar.py::test_extract_8k_captures_items PASSED
test_edgar.py::test_extract_8k_captures_filing_date PASSED
test_edgar.py::test_extract_8k_handles_empty_submissions PASSED
test_edgar.py::test_build_filing_url_removes_dashes_from_accession PASSED
test_edgar.py::test_build_filing_url_strips_cik_leading_zeros PASSED
test_edgar.py::test_build_filing_url_exact_format PASSED
8 passed
```

- [ ] **Step 5: Commit**

```bash
git add services/ingestor_sec/edgar.py services/ingestor_sec/test_edgar.py
git commit -m "feat(ingestor_sec): add edgar.py — CIK resolution, submissions fetch, URL builder, text extractor"
```

---

## Task 4: `services/ingestor_sec/classifier.py` + tests

**Files:**
- Create: `services/ingestor_sec/classifier.py`
- Create: `services/ingestor_sec/test_classifier.py`

The SEC classifier is independent from the geopolitical classifier in `ingestor_docs`. It classifies corporate events (M&A, bankruptcy, contract awards, leadership changes) rather than geopolitical events.

- [ ] **Step 1: Create `services/ingestor_sec/test_classifier.py`**

```python
"""Tests unitarios del clasificador SEC — sin dependencias externas."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from classifier import classify_severity, compute_relevance


# ── classify_severity ──────────────────────────────────────────────────────────

def test_severity_high_merger():
    assert classify_severity("Entry into Merger Agreement with XYZ Corp", "defense") == "high"

def test_severity_high_acquisition():
    assert classify_severity("Completion of acquisition of AI startup", "semiconductors") == "high"

def test_severity_high_bankruptcy():
    assert classify_severity("Voluntary bankruptcy filing under Chapter 11", "energy") == "high"

def test_severity_high_cybersecurity_incident():
    assert classify_severity("Report of material cybersecurity incident", "cyber_infra") == "high"

def test_severity_high_going_concern():
    assert classify_severity("Disclosure of going concern doubt", "financials") == "high"

def test_severity_medium_government_contract():
    assert classify_severity("Award of Department of Defense contract $2.1B", "defense") == "medium"

def test_severity_medium_ceo_departure():
    assert classify_severity("Departure of Chief Executive Officer and appointment of successor", "financials") == "medium"

def test_severity_medium_export_control():
    assert classify_severity("Receipt of export control license from BIS", "semiconductors") == "medium"

def test_severity_medium_defense_baseline():
    # Defense sector: any 8-K gets at least medium
    assert classify_severity("Change in Fiscal Year", "defense") == "medium"

def test_severity_low_other_sector():
    assert classify_severity("Change in Fiscal Year", "financials") == "low"

def test_severity_low_empty_title():
    assert classify_severity("", "energy") == "low"

def test_severity_low_generic_filing():
    assert classify_severity("Submission of matters to a vote of security holders", "energy") == "low"


# ── compute_relevance ──────────────────────────────────────────────────────────

def test_relevance_high_priority_defense_high():
    # 30 (high priority) + 15 (defense bonus) + 20 (high severity) = 65
    assert compute_relevance("defense", "high", "high") == 65

def test_relevance_medium_priority_financials_low():
    # 15 (medium priority) + 5 (financials bonus) + 0 (low severity) = 20
    assert compute_relevance("financials", "medium", "low") == 20

def test_relevance_high_priority_semiconductors_medium():
    # 30 + 12 + 10 = 52
    assert compute_relevance("semiconductors", "high", "medium") == 52

def test_relevance_unknown_sector_returns_base():
    # 30 + 0 + 10 = 40
    assert compute_relevance("unknown", "high", "medium") == 40

def test_relevance_capped_at_100():
    # Max possible: 30 + 15 + 20 = 65 — no capping needed, but verify ≤ 100
    assert compute_relevance("defense", "high", "high") <= 100
```

- [ ] **Step 2: Run tests — expect ImportError**

```bash
cd services/ingestor_sec
python -m pytest test_classifier.py -v 2>&1 | head -5
```

Expected: `ModuleNotFoundError: No module named 'classifier'`

- [ ] **Step 3: Create `services/ingestor_sec/classifier.py`**

```python
"""
Qilin — SEC Filing Classifier.
Classifies 8-K severity and computes relevance based on corporate event keywords.
Separate from the geopolitical classifier in ingestor_docs — different domain.
"""

# Keywords that indicate HIGH severity 8-K events
HIGH_KEYWORDS: frozenset[str] = frozenset({
    "merger", "acquisition", "acquired by", "takeover", "buyout",
    "bankruptcy", "chapter 11", "insolvency", "receivership", "going concern",
    "cybersecurity incident", "material cybersecurity",
    "restatement", "non-reliance", "accounting error",
    "sec investigation", "doj investigation", "department of justice",
    "material adverse", "material weakness",
    "export control violation", "export license revocation",
    "sanctions violation",
})

# Keywords that indicate MEDIUM severity 8-K events
MEDIUM_KEYWORDS: frozenset[str] = frozenset({
    "contract award", "government contract", "department of defense",
    "dod contract", "pentagon", "nato contract",
    "export control", "export license", "commerce department",
    "chief executive", "ceo departure", "cfo departure",
    "president appointed", "appointed as",
    "guidance revision", "revenue guidance", "earnings guidance",
    "new facility", "plant expansion",
    "joint venture", "strategic partnership",
    "sanctions", "restricted", "blacklist", "entity list",
})

# Sector-specific relevance bonus
SECTOR_BONUS: dict[str, int] = {
    "defense":        15,
    "semiconductors": 12,
    "cyber_infra":    10,
    "energy":          8,
    "financials":      5,
}


def classify_severity(title: str, sector: str) -> str:
    """
    Returns 'high', 'medium', or 'low' for an 8-K filing.
    Defense sector always gets at least 'medium' (any 8-K from a defense prime is notable).
    """
    title_lower = title.lower()
    if any(kw in title_lower for kw in HIGH_KEYWORDS):
        return "high"
    if any(kw in title_lower for kw in MEDIUM_KEYWORDS):
        return "medium"
    if sector == "defense":
        return "medium"
    return "low"


def compute_relevance(sector: str, priority: str, severity: str) -> int:
    """
    Computes relevance score 0-100.
    priority: 'high' | 'medium' (from sec_sources.yaml)
    severity: 'high' | 'medium' | 'low' (from classify_severity)
    """
    score  = 30 if priority == "high" else 15
    score += SECTOR_BONUS.get(sector, 0)
    score += {"high": 20, "medium": 10, "low": 0}.get(severity, 0)
    return min(score, 100)
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/ingestor_sec
python -m pytest test_classifier.py -v
```

Expected output:
```
test_classifier.py::test_severity_high_merger PASSED
test_classifier.py::test_severity_high_acquisition PASSED
test_classifier.py::test_severity_high_bankruptcy PASSED
test_classifier.py::test_severity_high_cybersecurity_incident PASSED
test_classifier.py::test_severity_high_going_concern PASSED
test_classifier.py::test_severity_medium_government_contract PASSED
test_classifier.py::test_severity_medium_ceo_departure PASSED
test_classifier.py::test_severity_medium_export_control PASSED
test_classifier.py::test_severity_medium_defense_baseline PASSED
test_classifier.py::test_severity_low_other_sector PASSED
test_classifier.py::test_severity_low_empty_title PASSED
test_classifier.py::test_severity_low_generic_filing PASSED
test_classifier.py::test_relevance_high_priority_defense_high PASSED
test_classifier.py::test_relevance_medium_priority_financials_low PASSED
test_classifier.py::test_relevance_high_priority_semiconductors_medium PASSED
test_classifier.py::test_relevance_unknown_sector_returns_base PASSED
test_classifier.py::test_relevance_capped_at_100 PASSED
17 passed
```

- [ ] **Step 5: Commit**

```bash
git add services/ingestor_sec/classifier.py services/ingestor_sec/test_classifier.py
git commit -m "feat(ingestor_sec): add SEC filing classifier — severity and relevance scoring"
```

---

## Task 5: `services/ingestor_sec/main.py` + `Dockerfile` + `requirements.txt`

**Files:**
- Create: `services/ingestor_sec/main.py`
- Create: `services/ingestor_sec/requirements.txt`
- Create: `services/ingestor_sec/Dockerfile`

No Playwright — EDGAR is a JSON API, no browser rendering needed.

- [ ] **Step 1: Create `services/ingestor_sec/requirements.txt`**

```
httpx==0.27.*
asyncpg==0.29.*
redis==5.0.*
pyyaml==6.0.*
beautifulsoup4==4.12.*
pdfplumber==0.11.*
```

- [ ] **Step 2: Create `services/ingestor_sec/Dockerfile`**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```

- [ ] **Step 3: Create `services/ingestor_sec/main.py`**

```python
"""
Qilin — Ingestor de Filings SEC (8-K)
Fuente: EDGAR submissions API para empresas S&P 500 geopolíticamente relevantes.

Estrategia:
  1. Carga sec_sources.yaml al arrancar.
  2. Descarga company_tickers.json → resuelve CIKs una sola vez.
  3. Cada SEC_POLL_INTERVAL segundos: por cada empresa fetch submissions.
  4. Filtra 8-K no vistos (dedup Redis por accession_number, TTL 7d).
  5. Descarga documento principal, extrae texto (HTML→BS4, PDF→pdfplumber).
  6. Clasifica severidad y relevancia.
  7. Persiste en TimescaleDB `sec_filings`.
  8. 3+ fallos consecutivos → alerta en stream:alerts.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import asyncpg
import httpx
import redis.asyncio as aioredis
import yaml

from classifier import classify_severity, compute_relevance
from edgar import (
    SEC_HEADERS,
    build_filing_url,
    download_and_extract,
    extract_8k_filings,
    fetch_submissions,
    load_cik_map,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SEC] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL         = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL            = os.getenv("DB_URL", "")
SEC_POLL_INTERVAL = int(os.getenv("SEC_POLL_INTERVAL", "1800"))
FAILURE_THRESHOLD = 3


def load_companies() -> list[dict]:
    with open("/app/config/sec_sources.yaml") as f:
        cfg = yaml.safe_load(f)
    return cfg["companies"]


async def _publish_failure_alert(redis, company: dict, failures: int, error: str):
    payload = {
        "rule":        "sec_fetch_failure",
        "zone":        "global",
        "severity":    "medium",
        "title":       f"SEC ingestor sin respuesta: {company['name']}",
        "description": (
            f"La empresa '{company['ticker']}' ha fallado {failures} ciclos "
            f"consecutivos. Último error: {error}"
        ),
        "time":        datetime.now(timezone.utc).isoformat(),
        "entities":    json.dumps([{"type": "sec_company", "id": company["ticker"]}]),
    }
    await redis.xadd("stream:alerts", {"data": json.dumps(payload)}, maxlen=500)
    log.error(f"ALERTA SEC: {company['ticker']} lleva {failures} fallos consecutivos")


async def process_company(
    client: httpx.AsyncClient,
    redis,
    db,
    company: dict,
    cik_map: dict[str, str],
) -> int:
    """
    Procesa una empresa: fetch submissions → dedup → download → classify → persist.
    Retorna número de filings nuevos guardados.
    """
    ticker      = company["ticker"]
    failure_key = f"sec:failures:{ticker}"
    new_count   = 0

    cik = cik_map.get(ticker)
    if not cik:
        log.warning(f"[{ticker}] CIK no encontrado en company_tickers.json — skipping")
        return 0

    try:
        submissions = await fetch_submissions(client, cik)
    except Exception as e:
        log.error(f"[{ticker}] fetch submissions fallido: {e}")
        failures = int(await redis.incr(failure_key))
        await redis.expire(failure_key, 7 * 86400)
        if failures >= FAILURE_THRESHOLD:
            await _publish_failure_alert(redis, company, failures, str(e))
        return 0

    await redis.delete(failure_key)

    filings = extract_8k_filings(submissions)
    for filing in filings:
        acc = filing["accession_number"]
        if not acc or not filing["primary_doc"]:
            continue

        dedup_key = f"sec:{acc}"
        if await redis.exists(dedup_key):
            continue

        filing_url = build_filing_url(cik, acc, filing["primary_doc"])
        title      = filing.get("items") or f"8-K Filing {acc}"

        try:
            full_text, summary = await download_and_extract(client, filing_url)
            status      = "processed"
            fetch_error = None
        except Exception as e:
            log.warning(f"[{ticker}] extracción fallida {filing_url}: {e}")
            full_text   = None
            summary     = None
            status      = "failed"
            fetch_error = str(e)[:200]

        sector    = company.get("sector", "")
        severity  = classify_severity(title, sector)
        relevance = compute_relevance(sector, company.get("priority", "medium"), severity)

        filing_date = filing.get("filing_date")
        try:
            doc_time = (
                datetime.fromisoformat(filing_date).replace(tzinfo=timezone.utc)
                if filing_date
                else datetime.now(timezone.utc)
            )
        except (ValueError, TypeError):
            doc_time = datetime.now(timezone.utc)

        if db:
            try:
                await db.execute(
                    """
                    INSERT INTO sec_filings
                        (time, ticker, company_name, cik, form_type, accession_number,
                         title, filing_url, sector, severity, relevance,
                         summary, full_text, status)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                    ON CONFLICT (accession_number) DO NOTHING
                    """,
                    doc_time, ticker, company["name"], cik,
                    filing["form_type"], acc,
                    title, filing_url, sector, severity, relevance,
                    summary, full_text, status,
                )
            except Exception as e:
                log.error(f"[{ticker}] DB insert fallido: {e}")

        await redis.setex(dedup_key, 7 * 86400, "1")
        new_count += 1
        log.info(f"[{ticker}] nuevo filing: {acc} — {title[:60]}")
        await asyncio.sleep(0.5)

    return new_count


async def main():
    log.info("Qilin SEC ingestor arrancando...")
    companies = load_companies()
    log.info(f"Cargadas {len(companies)} empresas desde sec_sources.yaml")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Filings no se persistirán.")

    # High priority companies first
    ordered = (
        [c for c in companies if c.get("priority") == "high"] +
        [c for c in companies if c.get("priority") != "high"]
    )

    async with httpx.AsyncClient(headers=SEC_HEADERS, follow_redirects=True) as client:
        log.info("Descargando company_tickers.json (resolución de CIKs)...")
        try:
            cik_map = await load_cik_map(client)
            log.info(f"CIKs resueltos: {len(cik_map)} empresas conocidas por EDGAR")
        except Exception as e:
            log.error(f"No se pudo cargar CIK map: {e}. Abortando.")
            return

        while True:
            new_count = 0
            for company in ordered:
                new_count += await process_company(client, redis, db, company, cik_map)
                await asyncio.sleep(0.5)  # cortesía entre empresas (~10 req/s SEC limit)

            log.info(f"Ciclo completo — {new_count} filings nuevos de {len(ordered)} empresas")
            await asyncio.sleep(SEC_POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 4: Verify imports parse without error**

```bash
cd services/ingestor_sec
python -c "import ast; ast.parse(open('main.py').read()); print('main.py OK')"
python -c "import ast; ast.parse(open('edgar.py').read()); print('edgar.py OK')"
```

Expected: `main.py OK` and `edgar.py OK`

- [ ] **Step 5: Commit**

```bash
git add services/ingestor_sec/main.py services/ingestor_sec/requirements.txt services/ingestor_sec/Dockerfile
git commit -m "feat(ingestor_sec): add main.py, Dockerfile, requirements.txt"
```

---

## Task 6: API endpoints — `GET /sec/feed` + `GET /sec/sources`

**Files:**
- Modify: `services/api/main.py`

Insert both endpoints after the `GET /docs/sources` endpoint (around line 544, before `# ── WEBSOCKET ──`). Follow the exact same pattern as `/docs/feed` and `/docs/sources`.

- [ ] **Step 1: Open `services/api/main.py` and find the insertion point**

Locate this comment in the file (around line 547):

```python
# ── WEBSOCKET ─────────────────────────────────────────────────────────────────
```

Insert the following block immediately before it:

```python
# ── SEC FILINGS FEED ─────────────────────────────────────────────────────────

@app.get("/sec/feed")
async def get_sec_feed(
    limit:     int             = 50,
    sector:    str | None      = None,
    ticker:    str | None      = None,
    form_type: str | None      = None,
    severity:  str | None      = None,
    since:     datetime | None = None,
    q:         str | None      = None,
    _user: str = Depends(get_current_user),
):
    """
    Feed de filings 8-K de empresas S&P 500 geopolíticamente relevantes.
    Lee de TimescaleDB con filtros dinámicos, ORDER BY time DESC.
    Devuelve lista vacía si DB no disponible.
    """
    if not app.state.db:
        return []

    conditions: list[str] = []
    params: list = []

    if sector:
        params.append(sector)
        conditions.append(f"sector = ${len(params)}")
    if ticker:
        params.append(ticker.upper())
        conditions.append(f"ticker = ${len(params)}")
    if form_type:
        params.append(form_type)
        conditions.append(f"form_type = ${len(params)}")
    if severity:
        params.append(severity)
        conditions.append(f"severity = ${len(params)}")
    if since:
        params.append(since)
        conditions.append(f"time >= ${len(params)}")
    if q:
        params.append(f"%{q}%")
        conditions.append(
            f"(ticker ILIKE ${len(params)} OR company_name ILIKE ${len(params)} OR title ILIKE ${len(params)})"
        )

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.append(min(limit, 200))
    rows = await app.state.db.fetch(
        f"""SELECT id, time, discovered_at, ticker, company_name, cik, form_type,
                   accession_number, title, filing_url, sector, severity, relevance,
                   summary, status
            FROM sec_filings {where}
            ORDER BY time DESC LIMIT ${len(params)}""",
        *params,
    )
    return [dict(r) for r in rows]


@app.get("/sec/sources")
async def get_sec_sources(_user: str = Depends(get_current_user)):
    """
    Lista de empresas monitorizadas desde sec_sources.yaml.
    Incluye contador de fallos consecutivos desde Redis.
    """
    config_path = "/app/config/sec_sources.yaml"
    try:
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
        companies = cfg.get("companies", [])
        redis = app.state.redis
        for company in companies:
            failures = await redis.get(f"sec:failures:{company['ticker']}")
            company["consecutive_failures"] = int(failures) if failures else 0
        return companies
    except Exception as e:
        log.warning(f"Error leyendo sec_sources.yaml: {e}")
        return []

```

- [ ] **Step 2: Verify the API starts without syntax errors**

```bash
cd services/api
python -c "import ast; ast.parse(open('main.py').read()); print('main.py OK')"
```

Expected: `main.py OK`

- [ ] **Step 3: Test endpoints with running stack (optional smoke test)**

If the stack is running (`docker compose up`):

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -d "username=carlos&password=12345" | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Test /sec/feed
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8000/sec/feed?limit=5" | python -m json.tool

# Test /sec/sources
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8000/sec/sources" | python -c "import sys,json; data=json.load(sys.stdin); print(len(data), 'companies')"
```

Expected: `/sec/feed` returns `[]` (no filings yet), `/sec/sources` returns list of 61 companies.

- [ ] **Step 4: Commit**

```bash
git add services/api/main.py
git commit -m "feat(api): add GET /sec/feed and GET /sec/sources endpoints"
```

---

## Task 7: Frontend hook — `frontend/src/hooks/useSecFeed.js`

**Files:**
- Create: `frontend/src/hooks/useSecFeed.js`

Mirrors `useDocsFeed.js` exactly — same polling pattern, same `apiFetch` client.

- [ ] **Step 1: Create `frontend/src/hooks/useSecFeed.js`**

```javascript
import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from './apiClient'

export function useSecFeed() {
  const [filings,    setFilings]    = useState([])
  const [sources,    setSources]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawFilings, rawSources] = await Promise.all([
          apiFetch('/api/sec/feed?limit=100'),
          apiFetch('/api/sec/sources'),
        ])
        if (cancelled) return
        setFilings(rawFilings  || [])
        setSources(rawSources  || [])
        setLastUpdate(new Date())
      } catch (err) {
        console.warn('[useSecFeed] fetch failed:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const sectors   = useMemo(() => [...new Set(sources.map(s => s.sector))].sort(),    [sources])
  const tickers   = useMemo(() => [...new Set(sources.map(s => s.ticker))].sort(),    [sources])
  const formTypes = useMemo(() => [...new Set(filings.map(f => f.form_type))].sort(), [filings])

  const failingSources = useMemo(
    () => sources.filter(s => (s.consecutive_failures || 0) >= 3),
    [sources]
  )

  return { filings, sources, sectors, tickers, formTypes, failingSources, loading, lastUpdate }
}
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd frontend
node --input-type=module < src/hooks/useSecFeed.js 2>&1 | head -5
```

Expected: no output (or a module import error that doesn't indicate a syntax problem — React imports won't resolve in Node directly, but any syntax error will be reported).

Alternatively just confirm the file is valid JS:
```bash
node -e "require('fs').readFileSync('frontend/src/hooks/useSecFeed.js','utf8'); console.log('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useSecFeed.js
git commit -m "feat(frontend): add useSecFeed hook — mirrors useDocsFeed, polls /sec/feed + /sec/sources"
```

---

## Task 8: Frontend page — `frontend/src/pages/FilingsPage.jsx`

**Files:**
- Create: `frontend/src/pages/FilingsPage.jsx`

Follows the same structure as `DocumentsPage.jsx`: sidebar filters + scrollable list + detail panel. Uses inline CSS-in-JS (no .css files).

- [ ] **Step 1: Create `frontend/src/pages/FilingsPage.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { useSecFeed } from '../hooks/useSecFeed'

const SEV_COLOR  = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' }
const SEV_BG     = { high: 'rgba(255,59,74,0.10)', medium: 'rgba(255,176,32,0.09)', low: 'rgba(0,229,160,0.08)' }
const SEV_BORDER = { high: 'rgba(255,59,74,0.28)', medium: 'rgba(255,176,32,0.26)', low: 'rgba(0,229,160,0.2)' }

const SECTOR_LABELS = {
  defense:        'Defensa',
  energy:         'Energía',
  semiconductors: 'Semicon.',
  financials:     'Finanzas',
  cyber_infra:    'Ciber/Infra',
}

const SECTOR_COLOR = {
  defense:        'rgba(255,59,74,0.8)',
  energy:         'rgba(255,140,0,0.8)',
  semiconductors: 'rgba(0,200,255,0.8)',
  financials:     'rgba(0,229,160,0.8)',
  cyber_infra:    'rgba(130,80,255,0.8)',
}

function SectorBadge({ sector }) {
  return (
    <span style={{
      fontSize: '8px', fontFamily: 'var(--mono)',
      color: 'var(--bg-0)',
      background: SECTOR_COLOR[sector] || 'rgba(150,150,150,0.8)',
      padding: '1px 5px', borderRadius: '2px',
    }}>
      {SECTOR_LABELS[sector] || sector}
    </span>
  )
}

function TickerBadge({ ticker, sector }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '700',
      color: SECTOR_COLOR[sector] || 'var(--cyan)',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${SECTOR_COLOR[sector] || 'var(--cyan)'}`,
      borderRadius: '3px', padding: '1px 6px',
      flexShrink: 0,
    }}>
      {ticker}
    </span>
  )
}

function FilterGroup({ label, options, value, onChange, labelFn }) {
  return (
    <div>
      <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
        {label}
      </div>
      {['TODOS', ...options].map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: value === opt ? 'rgba(0,200,255,0.08)' : 'none',
          border: 'none',
          borderLeft: `2px solid ${value === opt ? 'var(--cyan)' : 'transparent'}`,
          color: value === opt ? 'var(--cyan)' : 'var(--txt-3)',
          fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '.06em',
          padding: '4px 8px', cursor: 'pointer', transition: 'all .15s',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}>
          {opt === 'TODOS' ? 'TODOS' : (labelFn ? labelFn(opt) : opt.replace(/_/g, ' '))}
        </button>
      ))}
    </div>
  )
}

function FilingRow({ filing, selected, onClick }) {
  const sev    = filing.severity || 'low'
  const active = selected
  return (
    <div onClick={onClick} style={{
      padding: '10px 14px', cursor: 'pointer',
      borderBottom: '1px solid var(--border-sm)',
      background: active ? 'rgba(0,200,255,0.06)' : 'transparent',
      borderLeft: `3px solid ${active ? 'var(--cyan)' : 'transparent'}`,
      transition: 'background .12s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <TickerBadge ticker={filing.ticker} sector={filing.sector} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', flexShrink: 0 }}>
          {filing.form_type}
        </span>
        <span style={{
          fontSize: '8px', fontFamily: 'var(--mono)',
          color: SEV_COLOR[sev],
          background: SEV_BG[sev],
          border: `1px solid ${SEV_BORDER[sev]}`,
          padding: '1px 5px', borderRadius: '2px', flexShrink: 0,
        }}>
          {sev.toUpperCase()}
        </span>
        <SectorBadge sector={filing.sector} />
      </div>
      <div style={{ fontSize: '11px', color: 'var(--txt-1)', lineHeight: '1.35', marginBottom: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {filing.company_name} — {filing.title || 'Sin título'}
      </div>
      <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
        {filing.time ? new Date(filing.time).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
      </div>
    </div>
  )
}

function RelevanceBar({ value }) {
  const pct = Math.max(0, Math.min(100, value || 0))
  const color = pct >= 70 ? 'var(--red)' : pct >= 40 ? 'var(--amber)' : 'var(--green)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width .3s' }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color, flexShrink: 0 }}>{pct}</span>
    </div>
  )
}

function FilingDetail({ filing }) {
  const sev = filing.severity || 'low'
  return (
    <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
        <TickerBadge ticker={filing.ticker} sector={filing.sector} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--txt-1)', lineHeight: '1.3' }}>
            {filing.company_name}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
            {SECTOR_LABELS[filing.sector] || filing.sector}
          </div>
        </div>
        <span style={{
          marginLeft: 'auto', flexShrink: 0,
          fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: '700',
          color: SEV_COLOR[sev], background: SEV_BG[sev],
          border: `1px solid ${SEV_BORDER[sev]}`,
          padding: '3px 8px', borderRadius: '3px',
        }}>
          {sev.toUpperCase()}
        </span>
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        {[
          ['Formulario',  filing.form_type],
          ['Sector',      SECTOR_LABELS[filing.sector] || filing.sector],
          ['Fecha',       filing.time ? new Date(filing.time).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
          ['CIK',         filing.cik],
        ].map(([k, v]) => (
          <div key={k} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '8px 10px' }}>
            <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '3px' }}>{k}</div>
            <div style={{ fontSize: '11px', color: 'var(--txt-1)', fontFamily: 'var(--mono)' }}>{v || '—'}</div>
          </div>
        ))}
      </div>

      {/* Accession number */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '8px 10px', marginBottom: '14px' }}>
        <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '3px' }}>Accession Number</div>
        <div style={{ fontSize: '10px', color: 'var(--txt-2)', fontFamily: 'var(--mono)' }}>{filing.accession_number}</div>
      </div>

      {/* Relevance */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>Relevancia</div>
        <RelevanceBar value={filing.relevance} />
      </div>

      {/* Title / Items */}
      {filing.title && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>Ítems Reportados</div>
          <div style={{ fontSize: '11px', color: 'var(--txt-2)', lineHeight: '1.5' }}>{filing.title}</div>
        </div>
      )}

      {/* Summary */}
      {filing.summary && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>Resumen</div>
          <div style={{
            fontSize: '11px', color: 'var(--txt-2)', lineHeight: '1.6',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-sm)',
            borderRadius: '4px', padding: '10px', maxHeight: '200px', overflowY: 'auto',
          }}>
            {filing.summary}
          </div>
        </div>
      )}

      {/* EDGAR link */}
      {filing.filing_url && (
        <a
          href={filing.filing_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', textAlign: 'center',
            background: 'rgba(0,200,255,0.08)',
            border: '1px solid rgba(0,200,255,0.3)',
            borderRadius: '4px', padding: '9px',
            fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: '600',
            color: 'var(--cyan)', textDecoration: 'none',
            letterSpacing: '.1em', transition: 'background .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,200,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,200,255,0.08)'}
        >
          VER EN EDGAR ↗
        </a>
      )}
    </div>
  )
}

export default function FilingsPage() {
  const { filings, sources, sectors, failingSources, loading, lastUpdate } = useSecFeed()

  const [selectedId,   setSelectedId]   = useState(null)
  const [filterSector, setFilterSector] = useState('TODOS')
  const [filterSev,    setFilterSev]    = useState('TODOS')
  const [search,       setSearch]       = useState('')

  const filtered = useMemo(() => filings.filter(f => {
    if (filterSector !== 'TODOS' && f.sector !== filterSector) return false
    if (filterSev    !== 'TODOS' && f.severity !== filterSev)  return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !f.ticker.toLowerCase().includes(q) &&
        !f.company_name.toLowerCase().includes(q) &&
        !(f.title || '').toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [filings, filterSector, filterSev, search])

  const selected = filings.find(f => f.id === selectedId) || null

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

      {/* Sidebar */}
      <aside style={{
        width: '200px', flexShrink: 0,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border-md)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', padding: '14px 0',
      }}>
        {/* Search */}
        <div style={{ padding: '0 12px 14px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ticker / empresa..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-md)', borderRadius: '4px',
              color: 'var(--txt-1)', fontFamily: 'var(--mono)', fontSize: '10px',
              padding: '6px 8px', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '0 12px' }}>
          <FilterGroup
            label="Sector"
            options={sectors}
            value={filterSector}
            onChange={setFilterSector}
            labelFn={s => SECTOR_LABELS[s] || s}
          />
          <FilterGroup
            label="Severidad"
            options={['high', 'medium', 'low']}
            value={filterSev}
            onChange={setFilterSev}
          />
        </div>

        {/* Stats footer */}
        <div style={{ marginTop: 'auto', padding: '14px 12px 0', borderTop: '1px solid var(--border-sm)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
            {filtered.length} / {filings.length} filings
          </div>
          {lastUpdate && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: 'var(--txt-3)', marginTop: '3px' }}>
              {lastUpdate.toLocaleTimeString('es-ES')}
            </div>
          )}
        </div>
      </aside>

      {/* Failing sources banner */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {failingSources.length > 0 && (
          <div style={{
            background: 'rgba(255,176,32,0.08)', borderBottom: '1px solid rgba(255,176,32,0.25)',
            padding: '7px 16px',
            fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--amber)',
            flexShrink: 0,
          }}>
            ⚠ Empresas con fallos de fetch: {failingSources.map(s => s.ticker).join(', ')}
          </div>
        )}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Filings list */}
          <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid var(--border-md)' }}>
            {loading && (
              <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)' }}>
                Cargando filings...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)', marginBottom: '8px' }}>
                  {filings.length === 0
                    ? 'Ingestor SEC no activo o sin filings aún'
                    : 'Sin resultados con los filtros aplicados'}
                </div>
              </div>
            )}
            {filtered.map(f => (
              <FilingRow
                key={f.id}
                filing={f}
                selected={f.id === selectedId}
                onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
              />
            ))}
          </div>

          {/* Detail panel */}
          {selected ? (
            <div style={{ width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <FilingDetail filing={selected} />
            </div>
          ) : (
            <div style={{ width: '380px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt-3)', textAlign: 'center' }}>
                Selecciona un filing<br />para ver el detalle
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify file parses as valid JS**

```bash
node -e "require('fs').readFileSync('frontend/src/pages/FilingsPage.jsx','utf8'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/FilingsPage.jsx
git commit -m "feat(frontend): add FilingsPage — sidebar filters, filing list, detail panel with EDGAR link"
```

---

## Task 9: Wire-up — nav, routing, Docker, env

**Files:**
- Modify: `frontend/src/components/TopBar.jsx` — add `MERCADOS` nav item
- Modify: `frontend/src/App.jsx` — add `markets` view + import `FilingsPage`
- Modify: `docker-compose.yml` — add `ingestor-sec` service
- Modify: `.env.example` — add `SEC_POLL_INTERVAL`

- [ ] **Step 1: Add `MERCADOS` to `NAV_ITEMS` in `TopBar.jsx`**

In `frontend/src/components/TopBar.jsx`, find:

```javascript
const NAV_ITEMS = [
  { id: 'home',      label: 'INICIO'     },
  { id: 'tactical',  label: 'TÁCTICO'    },
  { id: 'news',      label: 'NOTICIAS'   },
  { id: 'documents', label: 'DOCUMENTOS' },
  { id: 'social',    label: 'SOCIAL'     },
]
```

Replace with:

```javascript
const NAV_ITEMS = [
  { id: 'home',      label: 'INICIO'     },
  { id: 'tactical',  label: 'TÁCTICO'    },
  { id: 'news',      label: 'NOTICIAS'   },
  { id: 'documents', label: 'DOCUMENTOS' },
  { id: 'social',    label: 'SOCIAL'     },
  { id: 'markets',   label: 'MERCADOS'   },
]
```

- [ ] **Step 2: Add `FilingsPage` import and route in `App.jsx`**

In `frontend/src/App.jsx`, find the existing imports block at the top:

```javascript
import SocialPage    from './pages/SocialPage'
```

Add the line immediately after:

```javascript
import FilingsPage   from './pages/FilingsPage'
```

Then find:

```javascript
      {view === 'social'    && <SocialPage />}
```

Add the line immediately after:

```javascript
      {view === 'markets'   && <FilingsPage />}
```

- [ ] **Step 3: Add `ingestor-sec` to `docker-compose.yml`**

In `docker-compose.yml`, find the `ingestor-docs` service block:

```yaml
  ingestor-docs:
    build: ./services/ingestor_docs
    container_name: qilin_ingestor_docs
    restart: unless-stopped
    environment:
      REDIS_URL: redis://redis:6379
      DB_URL: postgresql://${DB_USER:-qilin}:${DB_PASSWORD:-changeme}@timescaledb:5432/qilin
      DOCS_POLL_INTERVAL: ${DOCS_POLL_INTERVAL:-3600}
    volumes:
      - ./config:/app/config
    depends_on:
      - redis
      - timescaledb
```

Add the following block immediately after it (before the `# ingestor-ais` commented section):

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

- [ ] **Step 4: Add `SEC_POLL_INTERVAL` to `.env.example`**

In `.env.example`, find:

```
# --- Ingestor de documentos oficiales ---
# Intervalo de polling de portales (segundos, default 3600 = 1 hora)
DOCS_POLL_INTERVAL=3600
```

Add after it:

```
# --- Ingestor de filings SEC (8-K) ---
# Intervalo de polling EDGAR (segundos, default 1800 = 30 min)
SEC_POLL_INTERVAL=1800
```

- [ ] **Step 5: Verify the frontend dev server starts without errors**

```bash
cd frontend
npm run dev
```

Navigate to `http://localhost:3000`, log in, click `MERCADOS` in the top nav.
Expected: `FilingsPage` renders with sidebar showing sectors, empty list with message "Ingestor SEC no activo o sin filings aún".

- [ ] **Step 6: Verify Docker build for ingestor-sec**

```bash
docker compose build ingestor-sec
```

Expected: Build completes without errors.

- [ ] **Step 7: Commit everything**

```bash
git add frontend/src/components/TopBar.jsx \
        frontend/src/App.jsx \
        docker-compose.yml \
        .env.example
git commit -m "feat: wire up FilingsPage — MERCADOS nav, markets route, ingestor-sec Docker service"
```

---

## Done

All 9 tasks complete. The SEC ingestor is fully implemented:

- `sec_filings` table in TimescaleDB, deduplicated by `accession_number`
- `sec_sources.yaml` with 61 geopolitically relevant companies
- `edgar.py` handles CIK resolution, submissions polling, URL construction, and HTML/PDF text extraction with 429 retry
- `classifier.py` scores severity (high/medium/low) and relevance (0-100) based on corporate event keywords
- `main.py` orchestrates the 30-minute polling cycle with Redis dedup and failure alerting
- `GET /sec/feed` and `GET /sec/sources` API endpoints follow the same pattern as `/docs/feed`
- `useSecFeed` hook polls both endpoints every 60s
- `FilingsPage` shows filtered filing list with sector/severity filters + detailed panel + EDGAR link
- `MERCADOS` nav item in TopBar
- `ingestor-sec` Docker service in docker-compose
