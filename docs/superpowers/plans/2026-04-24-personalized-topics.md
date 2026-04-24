# Personalized Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users subscribe to topics (oil, Nvidia, Taiwan Strait…) so that news, intel, social feeds and Telegram alerts are filtered/prioritized around those topics, with a "My feed" toggle in the UI.

**Architecture:** Post-hoc keyword matching tags every item at write-time (ingestor_news, agent_engine); a `user_topics` table stores each user's subscription; API feed endpoints accept `?topics_only=true` and filter server-side; a `TopicSelector` chip-grid component and a `TopBar` toggle drive the personalization in the frontend. A 3-step registration wizard guides new users through topic and Telegram setup.

**Tech Stack:** FastAPI + asyncpg + TimescaleDB + Redis + React 18 + pytest + FastAPI TestClient

---

## File Map

| Action  | File | Purpose |
|---------|------|---------|
| Create  | `config/topics.yaml` | ~65 topic definitions with keywords |
| Create  | `services/api/topic_utils.py` | `tag_topics()` + `load_catalog()` |
| Create  | `services/agent_engine/topic_utils.py` | identical copy for agent container |
| Create  | `services/ingestor_news/topic_utils.py` | identical copy for ingestor container |
| Create  | `migrations/2026-04-24-personalized-topics.sql` | DB schema additions |
| Create  | `services/api/test_topics.py` | API endpoint tests |
| Create  | `services/api/test_topic_utils.py` | unit tests for tag_topics |
| Create  | `frontend/src/components/TopicSelector.jsx` | chip-grid selector |
| Modify  | `services/api/main.py` | new endpoints + feed filters |
| Modify  | `services/agent_engine/orchestrator.py` | tag findings + personalized TG |
| Modify  | `services/agent_engine/tools/db_tools.py` | `topics` param in save_agent_finding |
| Modify  | `services/agent_engine/reporter.py` | personalized send method |
| Modify  | `services/ingestor_news/main.py` | tag news at ingest |
| Modify  | `frontend/src/hooks/useNewsFeed.js` | `topicsOnly` param |
| Modify  | `frontend/src/hooks/useIntelTimeline.js` | `topicsOnly` param |
| Modify  | `frontend/src/hooks/useSocialFeed.js` | `topicsOnly` param |
| Modify  | `frontend/src/components/TopBar.jsx` | "My feed" toggle |
| Modify  | `frontend/src/App.jsx` | `topicsOnly` state + wiring |
| Modify  | `frontend/src/pages/NewsPage.jsx` | consume `topicsOnly` prop |
| Modify  | `frontend/src/pages/IntelPage.jsx` | consume `topicsOnly` prop |
| Modify  | `frontend/src/pages/SocialPage.jsx` | consume `topicsOnly` prop |
| Modify  | `frontend/src/pages/ProfilePage.jsx` | Topics + Telegram sections |
| Modify  | `frontend/src/pages/RegisterPage.jsx` | 3-step wizard |
| Modify  | `CLAUDE.md` | document all new endpoints/tables |

---

### Task 1: Topic catalog — `config/topics.yaml`

**Files:**
- Create: `config/topics.yaml`

- [ ] **Step 1: Create the catalog**

```yaml
# config/topics.yaml
# ~65 predefined topics organized in four types: sector | commodity | company | zone
topics:
  # ── SECTORS ──────────────────────────────────────────────────────────────
  - id: energy
    label_es: Energía
    label_en: Energy
    type: sector
    keywords: ["energy", "energía", "power grid", "electricity", "electrica", "red eléctrica"]

  - id: defense
    label_es: Defensa
    label_en: Defense
    type: sector
    keywords: ["defense", "defensa", "military", "militar", "arms", "armas", "weapon", "NATO", "OTAN"]

  - id: technology
    label_es: Tecnología
    label_en: Technology
    type: sector
    keywords: ["technology", "tecnología", "tech", "software", "AI", "artificial intelligence", "silicon"]

  - id: finance
    label_es: Finanzas
    label_en: Finance
    type: sector
    keywords: ["finance", "finanzas", "bank", "banco", "central bank", "IMF", "World Bank", "interest rate"]

  - id: food_security
    label_es: Seguridad alimentaria
    label_en: Food security
    type: sector
    keywords: ["food security", "seguridad alimentaria", "famine", "hambre", "crop", "harvest", "cosecha"]

  - id: semiconductors
    label_es: Semiconductores
    label_en: Semiconductors
    type: sector
    keywords: ["semiconductor", "chip", "wafer", "fab", "foundry", "EUV", "lithography"]

  - id: pharma
    label_es: Farmacéutica
    label_en: Pharma
    type: sector
    keywords: ["pharma", "farmacéutica", "drug", "vaccine", "vacuna", "WHO", "OMS", "pandemic", "pandemia"]

  - id: shipping
    label_es: Transporte marítimo
    label_en: Shipping
    type: sector
    keywords: ["shipping", "container", "contenedor", "port", "puerto", "freight", "flete", "logistics"]

  - id: space
    label_es: Espacio
    label_en: Space
    type: sector
    keywords: ["space", "espacio", "satellite", "satélite", "SpaceX", "NASA", "rocket", "cohete", "orbital"]

  - id: nuclear
    label_es: Nuclear
    label_en: Nuclear
    type: sector
    keywords: ["nuclear", "uranium", "uranio", "reactor", "IAEA", "OIEA", "nonproliferation", "enrichment"]

  - id: cyber
    label_es: Ciberseguridad
    label_en: Cybersecurity
    type: sector
    keywords: ["cyber", "cyberattack", "ciberataque", "hack", "ransomware", "malware", "intrusion", "breach"]

  - id: mining
    label_es: Minería crítica
    label_en: Critical minerals
    type: sector
    keywords: ["mining", "minería", "critical mineral", "mineral crítico", "rare earth", "tierra rara", "extraction"]

  - id: telecom
    label_es: Telecomunicaciones
    label_en: Telecom
    type: sector
    keywords: ["telecom", "5G", "fiber", "fibra", "spectrum", "espectro", "broadband", "undersea cable", "cable submarino"]

  - id: water
    label_es: Recursos hídricos
    label_en: Water resources
    type: sector
    keywords: ["water", "agua", "drought", "sequía", "dam", "presa", "aquifer", "acuífero", "river dispute"]

  - id: aviation
    label_es: Aviación
    label_en: Aviation
    type: sector
    keywords: ["aviation", "aviación", "airspace", "espacio aéreo", "ICAO", "airline", "aerolínea", "aircraft", "aeronave"]

  # ── COMMODITIES ──────────────────────────────────────────────────────────
  - id: petroleo
    label_es: Petróleo
    label_en: Oil
    type: commodity
    keywords: ["crude oil", "WTI", "Brent", "OPEC", "petróleo", "crudo", "barrel", "barril", "oil price", "precio petróleo"]

  - id: gas_natural
    label_es: Gas natural
    label_en: Natural gas
    type: commodity
    keywords: ["natural gas", "gas natural", "LNG", "GNL", "pipeline", "gasoducto", "Nord Stream", "TTF", "Henry Hub"]

  - id: trigo
    label_es: Trigo
    label_en: Wheat
    type: commodity
    keywords: ["wheat", "trigo", "grain", "grano", "bread", "cereals", "CBOT", "flour", "harina"]

  - id: cobre
    label_es: Cobre
    label_en: Copper
    type: commodity
    keywords: ["copper", "cobre", "Chile", "DRC", "cathode", "cátodo", "LME", "concentrate", "concentrado"]

  - id: litio
    label_es: Litio
    label_en: Lithium
    type: commodity
    keywords: ["lithium", "litio", "battery", "batería", "EV", "electric vehicle", "vehículo eléctrico", "Atacama", "brine", "salmuera"]

  - id: oro
    label_es: Oro
    label_en: Gold
    type: commodity
    keywords: ["gold", "oro", "XAU", "bullion", "lingote", "COMEX", "safe haven", "reserva", "central bank gold"]

  - id: aluminio
    label_es: Aluminio
    label_en: Aluminum
    type: commodity
    keywords: ["aluminum", "aluminium", "aluminio", "bauxite", "bauxita", "smelter", "fundición", "Rusal"]

  - id: uranio
    label_es: Uranio
    label_en: Uranium
    type: commodity
    keywords: ["uranium", "uranio", "U3O8", "yellowcake", "enrichment", "enriquecimiento", "Kazatomprom", "Cameco"]

  - id: niquel
    label_es: Níquel
    label_en: Nickel
    type: commodity
    keywords: ["nickel", "níquel", "Indonesia", "Philippines", "LME nickel", "stainless steel", "acero inoxidable"]

  - id: cobalto
    label_es: Cobalto
    label_en: Cobalt
    type: commodity
    keywords: ["cobalt", "cobalto", "DRC", "Congo", "battery metal", "metal batería", "Glencore"]

  - id: carbon
    label_es: Carbón
    label_en: Coal
    type: commodity
    keywords: ["coal", "carbón", "thermal coal", "coking coal", "coque", "Newcastle", "API2", "mine", "mina carbón"]

  - id: soja
    label_es: Soja
    label_en: Soybeans
    type: commodity
    keywords: ["soybean", "soja", "CBOT soy", "crush", "meal", "harina soja", "Brazil soy", "Argentina soy"]

  - id: maiz
    label_es: Maíz
    label_en: Corn
    type: commodity
    keywords: ["corn", "maize", "maíz", "ethanol", "etanol", "CBOT corn", "feed grain", "grano pienso"]

  - id: cafe
    label_es: Café
    label_en: Coffee
    type: commodity
    keywords: ["coffee", "café", "arabica", "robusta", "ICE coffee", "Brazil coffee", "Colombia coffee", "frost", "helada"]

  - id: rare_earths
    label_es: Tierras raras
    label_en: Rare earths
    type: commodity
    keywords: ["rare earth", "tierra rara", "neodymium", "neodimio", "dysprosium", "praseodymium", "REE", "China rare earth", "magnet"]

  # ── COMPANIES ────────────────────────────────────────────────────────────
  - id: nvidia
    label_es: Nvidia
    label_en: Nvidia
    type: company
    keywords: ["Nvidia", "NVDA", "Jensen Huang", "GPU", "H100", "A100", "B200", "Blackwell", "CUDA"]

  - id: tsmc
    label_es: TSMC
    label_en: TSMC
    type: company
    keywords: ["TSMC", "Taiwan Semiconductor", "TSM", "foundry", "3nm", "2nm", "fab TSMC", "Morris Chang"]

  - id: lockheed
    label_es: Lockheed Martin
    label_en: Lockheed Martin
    type: company
    keywords: ["Lockheed", "LMT", "F-35", "F-22", "C-130", "Hercules", "THAAD", "PAC-3"]

  - id: boeing
    label_es: Boeing
    label_en: Boeing
    type: company
    keywords: ["Boeing", "BA", "737", "787", "F-15", "Apache", "KC-46", "Starliner"]

  - id: aramco
    label_es: Saudi Aramco
    label_en: Saudi Aramco
    type: company
    keywords: ["Aramco", "Saudi Aramco", "2222.SR", "Abqaiq", "Ghawar", "Saudi oil"]

  - id: shell
    label_es: Shell
    label_en: Shell
    type: company
    keywords: ["Shell", "SHEL", "Royal Dutch", "LNG Shell", "Prelude", "integrated gas"]

  - id: rheinmetall
    label_es: Rheinmetall
    label_en: Rheinmetall
    type: company
    keywords: ["Rheinmetall", "RHM", "Lynx", "KF51", "Panther", "ammunition", "munición", "155mm"]

  - id: asml
    label_es: ASML
    label_en: ASML
    type: company
    keywords: ["ASML", "EUV", "DUV", "lithography", "litografía", "TWINSCAN", "export control ASML"]

  - id: bae_systems
    label_es: BAE Systems
    label_en: BAE Systems
    type: company
    keywords: ["BAE Systems", "BA.L", "Challenger 2", "Typhoon", "Astute", "submarine BAE"]

  - id: raytheon
    label_es: Raytheon (RTX)
    label_en: Raytheon (RTX)
    type: company
    keywords: ["Raytheon", "RTX", "Patriot", "PAC-3", "Stinger", "AMRAAM", "Pratt Whitney"]

  - id: northrop
    label_es: Northrop Grumman
    label_en: Northrop Grumman
    type: company
    keywords: ["Northrop", "NOC", "B-21", "Raider", "Global Hawk", "GBSD", "Sentinel ICBM"]

  - id: palantir
    label_es: Palantir
    label_en: Palantir
    type: company
    keywords: ["Palantir", "PLTR", "Gotham", "Foundry", "AIP", "Maven", "data analytics defense"]

  - id: huawei
    label_es: Huawei
    label_en: Huawei
    type: company
    keywords: ["Huawei", "5G Huawei", "Kirin", "HarmonyOS", "entity list Huawei", "ban Huawei"]

  # ── ZONES ────────────────────────────────────────────────────────────────
  - id: taiwan_strait
    label_es: Estrecho de Taiwán
    label_en: Taiwan Strait
    type: zone
    keywords: ["Taiwan", "Taiwán", "PLAN", "PLA Navy", "Strait", "TSMC", "PRC Taiwan", "ROC", "reunification"]

  - id: persian_gulf
    label_es: Golfo Pérsico
    label_en: Persian Gulf
    type: zone
    keywords: ["Persian Gulf", "Golfo Pérsico", "UAE", "EAU", "Qatar", "Bahrain", "Kuwait", "Gulf states", "Hormuz"]

  - id: ucrania
    label_es: Ucrania / Rusia
    label_en: Ukraine / Russia
    type: zone
    keywords: ["Ukraine", "Ucrania", "Russia", "Rusia", "Zelensky", "Putin", "Donbas", "Crimea", "Kharkiv", "Kyiv"]

  - id: mar_rojo
    label_es: Mar Rojo / Houthi
    label_en: Red Sea / Houthi
    type: zone
    keywords: ["Red Sea", "Mar Rojo", "Houthi", "Huthi", "Yemen", "Bab al-Mandab", "Suez", "shipping attack"]

  - id: mar_negro
    label_es: Mar Negro
    label_en: Black Sea
    type: zone
    keywords: ["Black Sea", "Mar Negro", "Odesa", "Sevastopol", "Kerch", "grain corridor", "corredor cereal"]

  - id: mar_china_sur
    label_es: Mar de China Meridional
    label_en: South China Sea
    type: zone
    keywords: ["South China Sea", "Mar de China Meridional", "Spratly", "Paracel", "SCS", "Philippines sea", "UNCLOS"]

  - id: iran
    label_es: Irán
    label_en: Iran
    type: zone
    keywords: ["Iran", "Irán", "IRGC", "Khamenei", "nuclear deal", "JCPOA", "sanctions Iran", "Natanz", "Fordow"]

  - id: israel_palestina
    label_es: Israel / Gaza
    label_en: Israel / Gaza
    type: zone
    keywords: ["Israel", "Gaza", "Palestine", "Palestina", "Hamas", "IDF", "West Bank", "Hezbollah", "Lebanon", "Líbano"]

  - id: corea
    label_es: Península coreana
    label_en: Korean Peninsula
    type: zone
    keywords: ["North Korea", "Corea del Norte", "DPRK", "Kim Jong-un", "ICBM", "missile test", "South Korea", "ROK"]

  - id: sahel
    label_es: Sahel / África
    label_en: Sahel / Africa
    type: zone
    keywords: ["Sahel", "Mali", "Niger", "Burkina Faso", "Wagner", "coup", "golpe estado", "jihadist", "yihadista"]

  - id: artico
    label_es: Ártico
    label_en: Arctic
    type: zone
    keywords: ["Arctic", "Ártico", "Northwest Passage", "Paso Noroeste", "icebreaker", "rompehielos", "Svalbard", "Alaska"]

  - id: estrecho_ormuz
    label_es: Estrecho de Ormuz
    label_en: Strait of Hormuz
    type: zone
    keywords: ["Strait of Hormuz", "Estrecho de Ormuz", "tanker seizure", "incautación buque", "oil tanker Iran"]

  - id: baltico
    label_es: Mar Báltico
    label_en: Baltic Sea
    type: zone
    keywords: ["Baltic", "Báltico", "Baltic Sea", "Finland", "Finlandia", "Sweden", "Suecia", "NATO Baltic", "undersea cable Baltic"]

  - id: indo_pacifico
    label_es: Indo-Pacífico
    label_en: Indo-Pacific
    type: zone
    keywords: ["Indo-Pacific", "Indo-Pacífico", "QUAD", "AUKUS", "India Pacific", "Japan defense", "Japón defensa"]

  - id: canal_panama
    label_es: Canal de Panamá
    label_en: Panama Canal
    type: zone
    keywords: ["Panama Canal", "Canal de Panamá", "Neopanamax", "drought canal", "sequía canal", "China Panama"]
```

- [ ] **Step 2: Verify file**

```bash
python -c "import yaml; data=yaml.safe_load(open('config/topics.yaml')); print(len(data['topics']), 'topics')"
```
Expected: `65 topics`

- [ ] **Step 3: Commit**

```bash
git add config/topics.yaml
git commit -m "feat(topics): add topic catalog with 65 topics and keywords"
```

---

### Task 2: `tag_topics()` utility — 3 service copies + unit tests

**Files:**
- Create: `services/api/topic_utils.py`
- Create: `services/agent_engine/topic_utils.py`
- Create: `services/ingestor_news/topic_utils.py`
- Create: `services/api/test_topic_utils.py`

- [ ] **Step 1: Write failing unit tests**

Create `services/api/test_topic_utils.py`:

```python
"""Unit tests for tag_topics() and load_catalog()."""
import pytest
from topic_utils import tag_topics, load_catalog


CATALOG = [
    {"id": "petroleo", "keywords": ["crude oil", "WTI", "petróleo"]},
    {"id": "nvidia",   "keywords": ["Nvidia", "NVDA", "H100"]},
    {"id": "ucrania",  "keywords": ["Ukraine", "Ucrania", "Putin"]},
]


def test_tag_topics_single_match():
    tags = tag_topics("WTI prices fall as OPEC meets", CATALOG)
    assert tags == ["petroleo"]


def test_tag_topics_multiple_matches():
    tags = tag_topics("Nvidia H100 chips banned from Ukraine export", CATALOG)
    assert set(tags) == {"nvidia", "ucrania"}


def test_tag_topics_case_insensitive():
    tags = tag_topics("nvidia nvda reports earnings", CATALOG)
    assert "nvidia" in tags


def test_tag_topics_no_match():
    tags = tag_topics("The weather in Paris is sunny", CATALOG)
    assert tags == []


def test_tag_topics_empty_text():
    tags = tag_topics("", CATALOG)
    assert tags == []


def test_load_catalog_returns_list():
    catalog = load_catalog("/app/config/topics.yaml")
    # When file doesn't exist, returns []
    assert isinstance(catalog, list)


def test_tag_topics_partial_keyword_match():
    # "petróleo" keyword appears as substring → should match
    tags = tag_topics("El precio del petróleo baja hoy", CATALOG)
    assert "petroleo" in tags
```

- [ ] **Step 2: Run tests — expect ImportError**

```bash
cd services/api && python -m pytest test_topic_utils.py -v 2>&1 | head -20
```
Expected: `ImportError: No module named 'topic_utils'`

- [ ] **Step 3: Create `services/api/topic_utils.py`**

```python
import logging
import yaml

log = logging.getLogger(__name__)

_CATALOG_CACHE: list[dict] | None = None


def load_catalog(path: str = "/app/config/topics.yaml") -> list[dict]:
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None:
        return _CATALOG_CACHE
    try:
        with open(path) as f:
            data = yaml.safe_load(f)
        _CATALOG_CACHE = data.get("topics", [])
        log.info("[topic_utils] Loaded %d topics from %s", len(_CATALOG_CACHE), path)
    except FileNotFoundError:
        log.warning("[topic_utils] %s not found, topic tagging disabled", path)
        _CATALOG_CACHE = []
    except Exception as exc:
        log.warning("[topic_utils] Error loading catalog: %s", exc)
        _CATALOG_CACHE = []
    return _CATALOG_CACHE


def tag_topics(text: str, catalog: list[dict]) -> list[str]:
    """Return list of topic IDs whose keywords appear in text (case-insensitive)."""
    if not text or not catalog:
        return []
    text_lower = text.lower()
    return [
        t["id"] for t in catalog
        if any(kw.lower() in text_lower for kw in t.get("keywords", []))
    ]
```

- [ ] **Step 4: Run tests — all pass**

```bash
cd services/api && python -m pytest test_topic_utils.py -v
```
Expected: `7 passed`

- [ ] **Step 5: Copy to the other two services**

The file is identical — each service is a separate Docker container so modules cannot be shared.

```bash
cp services/api/topic_utils.py services/agent_engine/topic_utils.py
cp services/api/topic_utils.py services/ingestor_news/topic_utils.py
```

- [ ] **Step 6: Commit**

```bash
git add services/api/topic_utils.py services/agent_engine/topic_utils.py \
        services/ingestor_news/topic_utils.py services/api/test_topic_utils.py
git commit -m "feat(topics): add tag_topics() utility + unit tests (3 service copies)"
```

---

### Task 3: DB migration

**Files:**
- Create: `migrations/2026-04-24-personalized-topics.sql`

- [ ] **Step 1: Write migration**

Create `migrations/2026-04-24-personalized-topics.sql`:

```sql
-- 2026-04-24: Personalized topics feature
-- Adds user_topics table, telegram_chat_id on users,
-- and topics TEXT[] column on news_events, agent_findings, analyzed_events.

-- User subscriptions
CREATE TABLE IF NOT EXISTS user_topics (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id   TEXT    NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, topic_id)
);
CREATE INDEX IF NOT EXISTS user_topics_user_idx ON user_topics (user_id);

-- Telegram chat ID per user
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Topics arrays on content tables
ALTER TABLE news_events
    ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS news_events_topics_gin ON news_events USING GIN (topics);

ALTER TABLE agent_findings
    ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS agent_findings_topics_gin ON agent_findings USING GIN (topics);

ALTER TABLE analyzed_events
    ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS analyzed_events_topics_gin ON analyzed_events USING GIN (topics);
```

- [ ] **Step 2: Apply migration locally (if DB is running)**

```bash
docker compose exec timescaledb psql -U qilin -d qilin \
  -f /migrations/2026-04-24-personalized-topics.sql
```
Expected: `CREATE TABLE`, `ALTER TABLE` messages — no errors.

- [ ] **Step 3: Verify**

```bash
docker compose exec timescaledb psql -U qilin -d qilin \
  -c "\d user_topics"
```
Expected: table with `user_id`, `topic_id`, `created_at` columns.

- [ ] **Step 4: Commit**

```bash
git add migrations/2026-04-24-personalized-topics.sql
git commit -m "feat(topics): DB migration — user_topics, telegram_chat_id, topics[] columns"
```

---

### Task 4: API — new topic & Telegram endpoints + extend `/me`

**Files:**
- Modify: `services/api/main.py`
- Create: `services/api/test_topics.py`

- [ ] **Step 1: Write failing API tests**

Create `services/api/test_topics.py`:

```python
"""Tests for /topics, /me/topics, /me/telegram endpoints."""
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app, get_current_user
    mock_db = AsyncMock()
    app.state.db = mock_db
    app.state.redis = AsyncMock()
    app.state.redis.get = AsyncMock(return_value=None)
    app.dependency_overrides[get_current_user] = lambda: "testuser"
    return TestClient(app), mock_db


def test_get_topics_catalog(client):
    tc, _ = client
    resp = tc.get("/topics")
    assert resp.status_code == 200
    data = resp.json()
    assert "topics" in data
    assert len(data["topics"]) > 0
    assert all("id" in t and "type" in t for t in data["topics"])


def test_get_my_topics_empty(client):
    tc, mock_db = client
    # user row
    mock_db.fetchrow = AsyncMock(return_value={"id": 1, "plan": "free"})
    # topics rows
    mock_db.fetch = AsyncMock(return_value=[])
    resp = tc.get("/me/topics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["topics"] == []
    assert data["limit"] == 2
    assert data["plan"] == "free"


def test_put_my_topics_valid(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1, "plan": "scout"})
    mock_db.execute = AsyncMock(return_value=None)
    resp = tc.put("/me/topics", json={"topics": ["petroleo", "nvidia"]})
    assert resp.status_code == 200


def test_put_my_topics_exceeds_limit(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1, "plan": "free"})
    resp = tc.put("/me/topics", json={"topics": ["petroleo", "nvidia", "oro"]})
    assert resp.status_code == 400
    assert "exceeds_plan_limit" in resp.json()["detail"]


def test_get_telegram(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"telegram_chat_id": "123456"})
    resp = tc.get("/me/telegram")
    assert resp.status_code == 200
    data = resp.json()
    assert data["chat_id"] == "123456"
    assert data["configured"] is True


def test_put_telegram(client):
    tc, mock_db = client
    mock_db.execute = AsyncMock(return_value=None)
    resp = tc.put("/me/telegram", json={"chat_id": "987654"})
    assert resp.status_code == 200


def test_telegram_test_no_chat_id(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"telegram_chat_id": None})
    resp = tc.post("/me/telegram/test")
    assert resp.status_code == 400
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd services/api && python -m pytest test_topics.py -v 2>&1 | head -30
```
Expected: `404` errors on new endpoints.

- [ ] **Step 3: Add Pydantic models to `main.py`**

After the existing `PasswordChangeRequest` model (around line 480), add:

```python
class TopicsUpdateRequest(BaseModel):
    topics: list[str]

class TelegramUpdateRequest(BaseModel):
    chat_id: str
```

- [ ] **Step 4: Add `PLAN_LIMITS` constant and `_get_user_topic_ids` helper to `main.py`**

After the `USERS = _load_users()` line, add:

```python
PLAN_LIMITS: dict[str, int | None] = {
    "free":     2,
    "scout":    5,
    "analyst":  20,
    "pro":      None,  # unlimited
}
```

After the `invalidate_cache` function, add:

```python
async def _get_user_topic_ids(username: str) -> list[str]:
    """Return topic IDs subscribed by a user. Returns [] if DB unavailable."""
    db = app.state.db
    if not db:
        return []
    try:
        row = await db.fetchrow("SELECT id FROM users WHERE username=$1", username)
        if not row:
            return []
        rows = await db.fetch(
            "SELECT topic_id FROM user_topics WHERE user_id=$1", row["id"]
        )
        return [r["topic_id"] for r in rows]
    except Exception as exc:
        log.warning("[topics] _get_user_topic_ids error: %s", exc)
        return []
```

- [ ] **Step 5: Add `GET /topics` endpoint to `main.py`**

Add after the `/stats` endpoint:

```python
# ── TOPIC CATALOG ─────────────────────────────────────────────────────────────

@app.get("/topics")
@cached("topics.catalog", ttl=3600)
async def get_topics_catalog(request: Request):
    """Public topic catalog from config/topics.yaml."""
    from topic_utils import load_catalog
    catalog = load_catalog("/app/config/topics.yaml")
    return {"topics": [
        {"id": t["id"], "label_es": t.get("label_es", t["id"]),
         "label_en": t.get("label_en", t["id"]), "type": t.get("type", "sector")}
        for t in catalog
    ]}
```

Also add `"/topics": 3600` to `CACHEABLE_PATHS`.

- [ ] **Step 6: Add `/me/topics` and `/me/telegram` endpoints**

Add after the existing `@app.get("/me")` endpoint:

```python
@app.get("/me/topics")
async def get_my_topics(user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"topics": [], "limit": 2, "plan": "free"}
    try:
        row = await app.state.db.fetchrow(
            "SELECT id, plan FROM users WHERE username=$1", user
        )
        if not row:
            return {"topics": [], "limit": 2, "plan": "free"}
        rows = await app.state.db.fetch(
            "SELECT topic_id FROM user_topics WHERE user_id=$1 ORDER BY created_at ASC",
            row["id"],
        )
        plan = row["plan"] or "free"
        limit = PLAN_LIMITS.get(plan, 2)
        return {"topics": [r["topic_id"] for r in rows], "limit": limit, "plan": plan}
    except Exception as exc:
        log.error("[me/topics] get error: %s", exc)
        return {"topics": [], "limit": 2, "plan": "free"}


@app.put("/me/topics")
async def put_my_topics(req: TopicsUpdateRequest, user: str = Depends(get_current_user)):
    if not app.state.db:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    row = await app.state.db.fetchrow(
        "SELECT id, plan FROM users WHERE username=$1", user
    )
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    plan = row["plan"] or "free"
    limit = PLAN_LIMITS.get(plan, 2)
    if limit is not None and len(req.topics) > limit:
        raise HTTPException(
            status_code=400,
            detail=f"exceeds_plan_limit:{limit}",
        )
    user_id = row["id"]
    try:
        await app.state.db.execute(
            "DELETE FROM user_topics WHERE user_id=$1", user_id
        )
        for topic_id in req.topics:
            await app.state.db.execute(
                "INSERT INTO user_topics (user_id, topic_id) VALUES ($1, $2) "
                "ON CONFLICT DO NOTHING",
                user_id, topic_id,
            )
    except Exception as exc:
        log.error("[me/topics] put error: %s", exc)
        raise HTTPException(status_code=500, detail="Error guardando topics")
    return {"ok": True}


@app.get("/me/telegram")
async def get_my_telegram(user: str = Depends(get_current_user)):
    if not app.state.db:
        return {"chat_id": None, "configured": False}
    try:
        row = await app.state.db.fetchrow(
            "SELECT telegram_chat_id FROM users WHERE username=$1", user
        )
        chat_id = row["telegram_chat_id"] if row else None
        return {"chat_id": chat_id, "configured": bool(chat_id)}
    except Exception as exc:
        log.error("[me/telegram] get error: %s", exc)
        return {"chat_id": None, "configured": False}


@app.put("/me/telegram")
async def put_my_telegram(req: TelegramUpdateRequest, user: str = Depends(get_current_user)):
    if not app.state.db:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    try:
        await app.state.db.execute(
            "UPDATE users SET telegram_chat_id=$1 WHERE username=$2",
            req.chat_id.strip() or None, user,
        )
    except Exception as exc:
        log.error("[me/telegram] put error: %s", exc)
        raise HTTPException(status_code=500, detail="Error guardando Telegram")
    return {"ok": True}


@app.post("/me/telegram/test")
async def test_my_telegram(user: str = Depends(get_current_user)):
    if not app.state.db:
        raise HTTPException(status_code=503, detail="Base de datos no disponible")
    row = await app.state.db.fetchrow(
        "SELECT telegram_chat_id FROM users WHERE username=$1", user
    )
    chat_id = row["telegram_chat_id"] if row else None
    if not chat_id:
        raise HTTPException(status_code=400, detail="no_chat_id")

    token = os.getenv("TELEGRAM_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="Telegram no configurado en el servidor")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": "✅ Qilin alert test — your notifications are working."},
                timeout=10,
            )
            resp.raise_for_status()
    except Exception as exc:
        log.warning("[me/telegram/test] error: %s", exc)
        raise HTTPException(status_code=502, detail="No se pudo enviar el mensaje")
    return {"ok": True}
```

- [ ] **Step 7: Extend `/me` response with `topics` and `telegram_configured`**

Find the existing `@app.get("/me")` endpoint (around line 1962). Replace its return statement:

```python
# OLD:
return {
    "username": row["username"],
    "email": row["email"],
    "plan": row["plan"] or "free",
    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
}

# NEW:
topic_rows = await app.state.db.fetch(
    "SELECT topic_id FROM user_topics WHERE user_id=$1", row["id"]
)
return {
    "username": row["username"],
    "email": row["email"],
    "plan": row["plan"] or "free",
    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    "topics": [r["topic_id"] for r in topic_rows],
    "telegram_configured": bool(row["telegram_chat_id"]),
}
```

Also update the `SELECT` query in `/me` to include `id` and `telegram_chat_id`:
```python
# OLD:
"SELECT username, email, plan, created_at FROM users WHERE username=$1"
# NEW:
"SELECT id, username, email, plan, created_at, telegram_chat_id FROM users WHERE username=$1"
```

- [ ] **Step 8: Run tests — all pass**

```bash
cd services/api && python -m pytest test_topics.py -v
```
Expected: `7 passed`

- [ ] **Step 9: Commit**

```bash
git add services/api/main.py services/api/test_topics.py
git commit -m "feat(topics): API endpoints /topics /me/topics /me/telegram + extend /me"
```

---

### Task 5: API — `topics_only` filter on feed endpoints

**Files:**
- Modify: `services/api/main.py`
- Modify: `services/api/test_topics.py`

- [ ] **Step 1: Add tests for the filtered feeds**

Append to `services/api/test_topics.py`:

```python
def test_news_feed_topics_only_returns_filtered(client):
    tc, mock_db = client
    # user has topic "petroleo"
    mock_db.fetchrow = AsyncMock(return_value={"id": 1})
    mock_db.fetch = AsyncMock(side_effect=[
        # user_topics query
        [{"topic_id": "petroleo"}],
        # news_events query
        [{"id": 1, "title": "WTI falls", "topics": ["petroleo"], "time": "2026-01-01T00:00:00"}],
    ])
    resp = tc.get("/news/feed?topics_only=true")
    assert resp.status_code == 200


def test_news_feed_topics_only_empty_when_no_topics(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1})
    mock_db.fetch = AsyncMock(return_value=[])  # no user_topics
    resp = tc.get("/news/feed?topics_only=true")
    assert resp.status_code == 200
    assert resp.json() == []


def test_intel_timeline_topics_only(client):
    tc, mock_db = client
    mock_db.fetchrow = AsyncMock(return_value={"id": 1})
    mock_db.fetch = AsyncMock(side_effect=[
        [{"topic_id": "nvidia"}],   # user_topics
        [],                          # agent_findings
        [],                          # analyzed_events
    ])
    resp = tc.get("/intel/timeline?topics_only=true")
    assert resp.status_code == 200
```

- [ ] **Step 2: Run new tests — expect failures**

```bash
cd services/api && python -m pytest test_topics.py::test_news_feed_topics_only_returns_filtered -v
```
Expected: `FAILED` (400 or 422 — `topics_only` not accepted yet).

- [ ] **Step 3: Modify `get_news_feed` in `main.py`**

Change the function signature to accept `topics_only` and add the filtered path. The `@cached` decorator stays for the non-filtered path; when `topics_only=True` the function returns early with per-user results (the decorator will attempt to cache, but the cache key would include `topics_only=True` — to prevent cross-user contamination, rename `_user` to `user` only in these endpoints so it becomes part of the cache key):

```python
@app.get("/news/feed")
@cached("news.feed", ttl=60)
async def get_news_feed(
    limit: int = 50,
    zone: str | None = None,
    country: str | None = None,
    source_type: str | None = None,
    sector: str | None = None,
    severity: str | None = None,
    q: str | None = None,
    since: datetime | None = None,
    topics_only: bool = False,
    user: str = Depends(get_current_user),   # note: no underscore — included in cache key
):
    if topics_only:
        topic_ids = await _get_user_topic_ids(user)
        if not topic_ids or not app.state.db:
            return []
        rows = await app.state.db.fetch(
            "SELECT * FROM news_events WHERE topics && $1 ORDER BY time DESC LIMIT $2",
            topic_ids, min(limit, 1000),
        )
        return [dict(r) for r in rows]

    if app.state.db:
        conditions: list[str] = []
        params: list = []
        if zone:
            params.append(zone); conditions.append(f"${len(params)} = ANY(zones)")
        if country:
            params.append(country); conditions.append(f"source_country = ${len(params)}")
        if source_type:
            params.append(source_type); conditions.append(f"source_type = ${len(params)}")
        if sector:
            params.append(sector); conditions.append(f"${len(params)} = ANY(sectors)")
        if severity:
            params.append(severity); conditions.append(f"severity = ${len(params)}")
        if q:
            params.append(f"%{q}%")
            conditions.append(f"(title ILIKE ${len(params)} OR summary ILIKE ${len(params)})")
        if since:
            params.append(since); conditions.append(f"time >= ${len(params)}")
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(min(limit, 1000))
        rows = await app.state.db.fetch(
            f"SELECT * FROM news_events {where} ORDER BY time DESC LIMIT ${len(params)}",
            *params,
        )
        return [dict(r) for r in rows]

    entries = await app.state.redis.xrevrange("stream:news", count=min(limit, 1000))
    return [json.loads(msg["data"]) for _, msg in entries]
```

- [ ] **Step 4: Modify `get_social_feed` in `main.py`**

Same pattern — add `topics_only: bool = False` and `user: str = Depends(get_current_user)`. Add the early return at the top of the function:

```python
@app.get("/social/feed")
@cached("social.feed", ttl=60)
async def get_social_feed(
    limit: int = 50,
    category: str | None = None,
    zone: str | None = None,
    handle: str | None = None,
    topics_only: bool = False,
    user: str = Depends(get_current_user),
):
    if topics_only:
        topic_ids = await _get_user_topic_ids(user)
        if not topic_ids or not app.state.db:
            return []
        rows = await app.state.db.fetch(
            "SELECT * FROM social_posts WHERE topics && $1 ORDER BY time DESC LIMIT $2",
            topic_ids, min(limit, 1000),
        )
        return [dict(r) for r in rows]
    # ... rest of existing implementation unchanged
```

- [ ] **Step 5: Modify `intel_timeline` in `main.py`**

The `intel_timeline` endpoint builds a unified list from both `agent_findings` and `analyzed_events`. Add `topics_only` support:

```python
@app.get("/intel/timeline")
@cached("intel.timeline", ttl=30)
async def intel_timeline(
    hours: int = 48,
    min_score: int = 0,
    domain: str = "all",
    topics_only: bool = False,
    user: str = Depends(get_current_user),
):
    # Personalized path
    if topics_only:
        topic_ids = await _get_user_topic_ids(user)
        if not topic_ids or not app.state.db:
            return {"items": []}
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        items = []
        if domain in ("all", "findings"):
            rows = await app.state.db.fetch(
                """SELECT time, cycle_id, agent_name, anomaly_score, summary, topics
                   FROM agent_findings
                   WHERE topics && $1 AND time >= $2 AND anomaly_score >= $3
                   ORDER BY time DESC LIMIT 200""",
                topic_ids, cutoff, min_score,
            )
            for r in rows:
                items.append({"type": "finding", **{k: r[k] for k in r.keys()}})
        if domain in ("all", "master"):
            rows = await app.state.db.fetch(
                """SELECT time, cycle_id, severity, headline, summary, zone, topics
                   FROM analyzed_events
                   WHERE topics && $1 AND time >= $2 AND severity >= $3
                   ORDER BY time DESC LIMIT 100""",
                topic_ids, cutoff, min_score,
            )
            for r in rows:
                items.append({"type": "master", **{k: r[k] for k in r.keys()}})
        items.sort(key=lambda x: x.get("time") or "", reverse=True)
        return {"items": items[:300]}

    # Existing non-personalized path follows here (unchanged)
    ...
```

- [ ] **Step 6: Run all topic tests**

```bash
cd services/api && python -m pytest test_topics.py -v
```
Expected: `10 passed`

- [ ] **Step 7: Commit**

```bash
git add services/api/main.py services/api/test_topics.py
git commit -m "feat(topics): topics_only filter on /news/feed /social/feed /intel/timeline"
```

---

### Task 6: `ingestor_news` — tag topics at ingest time

**Files:**
- Modify: `services/ingestor_news/main.py`

The ingestor writes to `news_events` around line 207. We need to compute `topics` before the INSERT.

- [ ] **Step 1: Locate the INSERT statement**

```bash
grep -n "INSERT INTO news_events" services/ingestor_news/main.py
```
Note the line number.

- [ ] **Step 2: Read the ingestor module top and startup section**

Read lines 1–50 of `services/ingestor_news/main.py` to understand how to load the catalog at startup.

- [ ] **Step 3: Add catalog loading at module level**

Near the top of `services/ingestor_news/main.py`, after the imports, add:

```python
from topic_utils import load_catalog, tag_topics

_TOPIC_CATALOG: list[dict] = []


def _init_topics() -> None:
    global _TOPIC_CATALOG
    _TOPIC_CATALOG = load_catalog("/app/config/topics.yaml")
```

Then call `_init_topics()` inside the `main()` or startup function (look for where the ingestor initializes — likely a `run()` or `main()` async function).

- [ ] **Step 4: Tag topics before INSERT**

Find the INSERT statement. The ingestor builds a dict or passes variables. Before the INSERT, add:

```python
# Tag topics using title + summary
_text_for_tagging = f"{title or ''} {summary or ''}"
item_topics = tag_topics(_text_for_tagging, _TOPIC_CATALOG)
```

Then include `item_topics` in the INSERT. The current INSERT (around line 210) is:
```sql
INSERT INTO news_events
    (time, source, title, url, summary, image_url, zones, keywords,
     severity, relevance, source_country, source_type, sectors)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
```

Change to:
```sql
INSERT INTO news_events
    (time, source, title, url, summary, image_url, zones, keywords,
     severity, relevance, source_country, source_type, sectors, topics)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
ON CONFLICT (url) DO UPDATE SET topics = EXCLUDED.topics
```

And pass `item_topics` as the 14th parameter. Look for the `ON CONFLICT` clause if it already exists and extend it accordingly.

- [ ] **Step 5: Verify by running ingestor test**

```bash
cd services/ingestor_news && python -m pytest test_classifier.py -v
```
Expected: all existing tests pass (we only added to the INSERT path, not the classifier).

- [ ] **Step 6: Commit**

```bash
git add services/ingestor_news/main.py
git commit -m "feat(topics): tag news_events.topics at ingest time via keyword matching"
```

---

### Task 7: `agent_engine` — tag findings + personalized Telegram

**Files:**
- Modify: `services/agent_engine/tools/db_tools.py`
- Modify: `services/agent_engine/orchestrator.py`
- Modify: `services/agent_engine/reporter.py`

- [ ] **Step 1: Update `save_agent_finding` in `db_tools.py`**

Find the `save_agent_finding` function (line ~256). Add `topics` to the INSERT:

```python
async def save_agent_finding(pool: asyncpg.Pool, finding: dict) -> int:
    ts = finding.get("time") or datetime.now(timezone.utc)
    row = await pool.fetchrow(
        """
        INSERT INTO agent_findings (
            time, cycle_id, agent_name, anomaly_score, summary,
            raw_output, tools_called, duration_ms, telegram_sent, topics
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
        """,
        ts,
        finding["cycle_id"],
        finding["agent_name"],
        int(finding.get("anomaly_score") or 0),
        finding.get("summary") or "",
        json.dumps(finding.get("raw_output") or {}),
        finding.get("tools_called") or [],
        finding.get("duration_ms"),
        bool(finding.get("telegram_sent", False)),
        finding.get("topics") or [],
    )
    return row["id"]
```

Also update `save_analyzed_event` similarly — find that function and add `topics` to the INSERT:

```python
# In save_analyzed_event, add topics to the INSERT:
# ...existing columns..., topics
# ...existing values..., $N
# Pass: event.get("topics") or []
```

- [ ] **Step 2: Add `send_finding_telegram_personal` to `reporter.py`**

Append to `reporter.py`:

```python
async def send_finding_telegram_personal(
    self,
    cycle_id: str,
    agent_name: str,
    payload: dict,
    chat_id: str,
    matched_topics: list[str],
) -> bool:
    icon = _DOMAIN_ICON.get(agent_name, "🔵")
    score = int(payload.get("anomaly_score") or 0)
    summary = (payload.get("summary") or "")[:600]
    short_cycle = cycle_id[:8]
    topics_str = ", ".join(matched_topics[:5])
    text = (
        f"{icon} <b>[{agent_name}] score={score}</b>\n"
        f"cycle <code>{short_cycle}</code>\n\n"
        f"{summary}\n\n"
        f"🎯 <i>Topics: {topics_str}</i>"
    )
    payload_body = {
        "chat_id": chat_id,
        "text": text if len(text) <= _MAX_TEXT else text[: _MAX_TEXT - len(_TRUNCATION_SUFFIX)] + _TRUNCATION_SUFFIX,
        "parse_mode": "HTML",
        "disable_notification": False,
    }
    try:
        resp = await self._http.post(
            _TELEGRAM_API.format(token=self.token), json=payload_body, timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        log.warning("[REPORTER] personal Telegram error chat_id=%s: %s", chat_id, exc)
        return False
```

- [ ] **Step 3: Update `orchestrator.py` to tag findings and send personal Telegram**

At the top of `orchestrator.py`, add:

```python
from topic_utils import load_catalog, tag_topics
```

In `__init__`, after `self.reporter = reporter`, add:

```python
self._topic_catalog = load_catalog("/app/config/topics.yaml")
```

In `run_scheduled_cycle`, after each finding is processed and before `save_agent_finding`, add topic tagging:

```python
# Tag topics from raw_output text
raw_text = json.dumps(payload, default=str)
topics = tag_topics(raw_text, self._topic_catalog)

# Include topics in the finding save
if self.pool:
    try:
        await db_tools.save_agent_finding(self.pool, {
            ...existing fields...,
            "topics": topics,   # ADD THIS
        })
    except Exception as exc:
        ...
```

After the global Telegram message for high-score findings (after the `send_finding_telegram` call), add the personalized loop:

```python
# Personalized Telegram to users with matching topics
if score >= 7 and topics and self.pool:
    try:
        user_rows = await self.pool.fetch(
            """
            SELECT u.telegram_chat_id, array_agg(ut.topic_id) AS user_topics
            FROM users u
            JOIN user_topics ut ON ut.user_id = u.id
            WHERE u.telegram_chat_id IS NOT NULL
            GROUP BY u.telegram_chat_id
            """
        )
        for row in user_rows:
            matched = [t for t in topics if t in (row["user_topics"] or [])]
            if matched:
                await self.reporter.send_finding_telegram_personal(
                    cycle_id=cycle_id,
                    agent_name=f["agent_name"],
                    payload=payload,
                    chat_id=row["telegram_chat_id"],
                    matched_topics=matched,
                )
    except Exception as exc:
        log.warning("[CYCLE] personalized Telegram error: %s", exc)
```

Also tag the master analysis before saving:

```python
# Tag master analysis
master_text = json.dumps(analysis, default=str)
analysis["topics"] = tag_topics(master_text, self._topic_catalog)
# Then save_analyzed_event will include analysis["topics"]
```

- [ ] **Step 4: Run existing agent_engine tests**

```bash
cd services/agent_engine && python -m pytest tests/ -v
```
Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/agent_engine/tools/db_tools.py \
        services/agent_engine/orchestrator.py \
        services/agent_engine/reporter.py
git commit -m "feat(topics): tag agent findings + send personalized Telegram alerts"
```

---

### Task 8: `TopicSelector` React component

**Files:**
- Create: `frontend/src/components/TopicSelector.jsx`

- [ ] **Step 1: Create the component**

```jsx
// frontend/src/components/TopicSelector.jsx
import { useMemo } from 'react'
import { useLang } from '../hooks/useLanguage'

const TYPE_ORDER = ['sector', 'commodity', 'company', 'zone']
const TYPE_LABELS = {
  sector:    { es: 'Sectores',         en: 'Sectors'    },
  commodity: { es: 'Materias primas',  en: 'Commodities' },
  company:   { es: 'Empresas',         en: 'Companies'  },
  zone:      { es: 'Zonas',            en: 'Zones'      },
}

export default function TopicSelector({ selected = [], limit, onChange, catalog = [] }) {
  const { lang } = useLang()

  const grouped = useMemo(() => {
    const groups = {}
    for (const t of catalog) {
      const type = t.type || 'sector'
      if (!groups[type]) groups[type] = []
      groups[type].push(t)
    }
    return groups
  }, [catalog])

  function toggle(id) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      if (limit != null && selected.length >= limit) return
      onChange([...selected, id])
    }
  }

  const atLimit = limit != null && selected.length >= limit

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {TYPE_ORDER.filter(type => grouped[type]?.length).map(type => (
        <div key={type}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
            fontWeight: '700', letterSpacing: '.14em',
            color: 'var(--txt-3)', textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            {TYPE_LABELS[type][lang] || type}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {grouped[type].map(topic => {
              const isSelected = selected.includes(topic.id)
              const isDisabled = atLimit && !isSelected
              const label = lang === 'en' ? topic.label_en : topic.label_es
              return (
                <button
                  key={topic.id}
                  onClick={() => toggle(topic.id)}
                  disabled={isDisabled}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '3px',
                    border: isSelected
                      ? '1px solid var(--cyan)'
                      : '1px solid var(--border-md)',
                    background: isSelected
                      ? 'rgba(0,200,255,0.15)'
                      : 'transparent',
                    color: isSelected ? 'var(--cyan)'
                          : isDisabled ? 'var(--txt-3)'
                          : 'var(--txt-2)',
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--label-sm)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.45 : 1,
                    transition: 'all .12s',
                    letterSpacing: '.06em',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected && !isDisabled)
                      e.currentTarget.style.color = 'var(--txt-1)'
                  }}
                  onMouseLeave={e => {
                    if (!isSelected && !isDisabled)
                      e.currentTarget.style.color = 'var(--txt-2)'
                  }}
                >
                  {isSelected && <span style={{ marginRight: '4px' }}>✓</span>}
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {limit != null && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
          color: atLimit ? 'var(--amber)' : 'var(--txt-3)',
          letterSpacing: '.06em',
        }}>
          {selected.length} / {limit === null ? '∞' : limit} topics selected
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify component renders (manual)**

Start dev server: `cd frontend && npm run dev`
Open `http://localhost:3000/app` and navigate to Profile. The new TopicSelector sections won't show yet but there should be no import errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TopicSelector.jsx
git commit -m "feat(topics): TopicSelector chip-grid component"
```

---

### Task 9: Frontend hooks — add `topicsOnly` param

**Files:**
- Modify: `frontend/src/hooks/useNewsFeed.js`
- Modify: `frontend/src/hooks/useIntelTimeline.js`
- Modify: `frontend/src/hooks/useSocialFeed.js`

- [ ] **Step 1: Update `useNewsFeed.js`**

Replace the entire file:

```js
import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, prefetch } from './feedCache'

const SOURCES_URL = '/api/news/sources'

function buildFeedUrl(topicsOnly) {
  return topicsOnly
    ? '/api/news/feed?limit=1000&topics_only=true'
    : '/api/news/feed?limit=1000'
}

export function useNewsFeed({ topicsOnly = false } = {}) {
  const feedUrl    = buildFeedUrl(topicsOnly)
  const cachedArticles = getCached(feedUrl)
  const cachedSources  = getCached(SOURCES_URL)

  const [articles,   setArticles]   = useState(cachedArticles || [])
  const [sources,    setSources]    = useState(cachedSources  || [])
  const [loading,    setLoading]    = useState(!(cachedArticles && cachedSources))
  const [lastUpdate, setLastUpdate] = useState(cachedArticles ? new Date() : null)

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      try {
        const [rawArticles, rawSources] = await Promise.all([
          fetchWithCache(feedUrl),
          fetchWithCache(SOURCES_URL),
        ])
        if (cancelled) return
        setArticles(rawArticles || [])
        setSources(rawSources  || [])
        setLastUpdate(new Date())
      } catch (err) {
        console.warn('[useNewsFeed] fetch failed:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [feedUrl])

  const countries   = useMemo(() => [...new Set(sources.map(s => s.country))].sort(),   [sources])
  const sourceTypes = useMemo(() => [...new Set(sources.map(s => s.type))].sort(),      [sources])
  const zones       = useMemo(() => [...new Set(sources.map(s => s.zone).filter(z => z !== 'global'))].sort(), [sources])
  const sectors     = useMemo(() => {
    const all = sources.flatMap(s => s.sectors || [])
    return [...new Set(all)].sort()
  }, [sources])

  return { articles, sources, countries, sourceTypes, zones, sectors, loading, lastUpdate }
}

export function prefetchNewsFeed() {
  prefetch(buildFeedUrl(false))
  prefetch(SOURCES_URL)
}
```

- [ ] **Step 2: Update `useIntelTimeline.js`**

Add `topicsOnly` to the params and URL builder:

```js
function buildTimelineUrl({ hours, minScore, domain, topicsOnly }) {
  const base = `/api/intel/timeline?hours=${hours}&min_score=${minScore}&domain=${domain}`
  return topicsOnly ? `${base}&topics_only=true` : base
}

export function useIntelTimeline({ hours = 48, minScore = 0, domain = 'all', topicsOnly = false } = {}) {
  const timelineUrl = useMemo(
    () => buildTimelineUrl({ hours, minScore, domain, topicsOnly }),
    [hours, minScore, domain, topicsOnly]
  )
  // ... rest of existing logic unchanged
```

- [ ] **Step 3: Update `useSocialFeed.js`**

Replace the entire file:

```js
import { useState, useEffect } from 'react'
import { fetchWithCache, getCached, prefetch } from './feedCache'

const ACCOUNTS_URL = '/api/social/accounts'

function buildFeedUrl(topicsOnly) {
  return topicsOnly
    ? '/api/social/feed?limit=1000&topics_only=true'
    : '/api/social/feed?limit=1000'
}

export function useSocialFeed({ topicsOnly = false } = {}) {
  const feedUrl     = buildFeedUrl(topicsOnly)
  const cachedPosts    = getCached(feedUrl)
  const cachedAccounts = getCached(ACCOUNTS_URL)

  const [posts,      setPosts]      = useState(cachedPosts    || [])
  const [accounts,   setAccounts]   = useState(cachedAccounts || [])
  const [loading,    setLoading]    = useState(!(cachedPosts && cachedAccounts))
  const [lastUpdate, setLastUpdate] = useState(cachedPosts ? new Date() : null)

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      try {
        const [rawPosts, rawAccounts] = await Promise.all([
          fetchWithCache(feedUrl),
          fetchWithCache(ACCOUNTS_URL),
        ])
        if (cancelled) return
        setPosts(rawPosts || [])
        setAccounts(rawAccounts || [])
        setLastUpdate(new Date())
      } catch (err) {
        console.warn('[useSocialFeed] fetch failed:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [feedUrl])

  const categories = [...new Set(accounts.map(a => a.category))].sort()
  const zones      = [...new Set(accounts.map(a => a.zone))].sort()

  return { posts, accounts, categories, zones, loading, lastUpdate }
}

export function prefetchSocialFeed() {
  prefetch(buildFeedUrl(false))
  prefetch(ACCOUNTS_URL)
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useNewsFeed.js \
        frontend/src/hooks/useIntelTimeline.js \
        frontend/src/hooks/useSocialFeed.js
git commit -m "feat(topics): add topicsOnly param to useNewsFeed/useIntelTimeline/useSocialFeed"
```

---

### Task 10: TopBar — "My feed" toggle

**Files:**
- Modify: `frontend/src/components/TopBar.jsx`

The toggle is only visible when `hasTopics` is true (user has ≥1 topic configured). Props needed: `topicsOnly: bool`, `onToggleTopics: fn`, `hasTopics: bool`.

- [ ] **Step 1: Update TopBar signature and add toggle widget**

```jsx
// Change signature from:
export default function TopBar({ alertsTotal, wsStatus, currentView, onNavigate, onLogout })
// To:
export default function TopBar({ alertsTotal, wsStatus, currentView, onNavigate, onLogout,
                                  topicsOnly, onToggleTopics, hasTopics })
```

In the right-side section, before the ES|EN toggle, add:

```jsx
{/* My feed toggle — only shown when user has topics */}
{hasTopics && (
  <button
    onClick={onToggleTopics}
    style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      background: topicsOnly ? 'rgba(0,200,255,0.12)' : 'transparent',
      border: topicsOnly
        ? '1px solid rgba(0,200,255,0.35)'
        : '1px solid var(--border-md)',
      borderRadius: '3px',
      color: topicsOnly ? 'var(--cyan)' : 'var(--txt-3)',
      fontFamily: 'var(--mono)',
      fontSize: 'var(--label-sm)',
      fontWeight: '600',
      letterSpacing: '.08em',
      padding: '4px 10px',
      cursor: 'pointer',
      transition: 'all .15s',
    }}
    onMouseEnter={e => { if (!topicsOnly) e.currentTarget.style.color = 'var(--txt-1)' }}
    onMouseLeave={e => { if (!topicsOnly) e.currentTarget.style.color = 'var(--txt-3)' }}
    title={topicsOnly ? 'Showing your topics — click for all' : 'Click to filter by your topics'}
  >
    {topicsOnly ? '◉' : '○'} MY FEED
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TopBar.jsx
git commit -m "feat(topics): My feed toggle in TopBar"
```

---

### Task 11: `App.jsx` — `topicsOnly` state + wiring

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add `topicsOnly` state and `hasTopics` derived value**

In `AppShell`, add:

```jsx
const [topicsOnly, setTopicsOnly] = useState(false)
```

After the `prefetchXxx` calls in `useEffect`, add logic to initialize `topicsOnly` from the `/api/me` response. Import `useProfile` hook:

```jsx
import { useProfile } from './hooks/useProfile'
```

Inside `AppShell`, after the existing hooks:

```jsx
const { profile } = useProfile()
const hasTopics = (profile?.topics?.length || 0) > 0

// Initialize topicsOnly to true when user first loads and has topics
useEffect(() => {
  if (hasTopics && !topicsOnly) setTopicsOnly(true)
}, [hasTopics])   // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Pass new props to TopBar in both views (tactical + all-other)**

In both `<TopBar .../>` calls:

```jsx
<TopBar
  alertsTotal={stats.alertsTotal}
  wsStatus={wsStatus}
  currentView={view}
  onNavigate={setView}
  onLogout={handleLogout}
  topicsOnly={topicsOnly}
  onToggleTopics={() => setTopicsOnly(v => !v)}
  hasTopics={hasTopics}
/>
```

- [ ] **Step 3: Pass `topicsOnly` prop to pages that support it**

In the non-tactical view section:

```jsx
{view === 'news'    && <NewsPage   topicsOnly={topicsOnly} />}
{view === 'intel'   && <IntelPage  topicsOnly={topicsOnly} />}
{view === 'social'  && <SocialPage topicsOnly={topicsOnly} />}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(topics): topicsOnly state + wiring in App.jsx"
```

---

### Task 12: Feed pages — consume `topicsOnly`

**Files:**
- Modify: `frontend/src/pages/NewsPage.jsx`
- Modify: `frontend/src/pages/IntelPage.jsx`
- Modify: `frontend/src/pages/SocialPage.jsx`

For each page, the change is minimal: accept `topicsOnly` as a prop, pass it to the hook, and show an empty state when `topicsOnly=true` and results are empty.

- [ ] **Step 1: Update `NewsPage.jsx`**

Find the function signature:
```jsx
// OLD:
export default function NewsPage() {
  const { articles, ... } = useNewsFeed()

// NEW:
export default function NewsPage({ topicsOnly = false }) {
  const { articles, ... } = useNewsFeed({ topicsOnly })
```

Find the empty state (where it shows "no articles" or a loading state). Add above it:

```jsx
{topicsOnly && articles.length === 0 && !loading && (
  <div style={{
    textAlign: 'center', padding: '48px 24px',
    fontFamily: 'var(--mono)', color: 'var(--txt-3)', fontSize: '13px',
  }}>
    No content matches your topics.{' '}
    <span style={{ color: 'var(--txt-2)' }}>Toggle off MY FEED to see everything.</span>
  </div>
)}
```

- [ ] **Step 2: Update `IntelPage.jsx`**

```jsx
// OLD:
export default function IntelPage() {
  const { items, ... } = useIntelTimeline()

// NEW:
export default function IntelPage({ topicsOnly = false }) {
  const { items, ... } = useIntelTimeline({ topicsOnly })
```

Add the same empty state div.

- [ ] **Step 3: Update `SocialPage.jsx`**

```jsx
// OLD:
export default function SocialPage() {
  const { posts, ... } = useSocialFeed()

// NEW:
export default function SocialPage({ topicsOnly = false }) {
  const { posts, ... } = useSocialFeed({ topicsOnly })
```

Add the same empty state div.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`, log in, navigate to News/Intel/Social. The toggle should appear in TopBar if the user has topics configured. Toggling it should change the URL param and refetch.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/NewsPage.jsx \
        frontend/src/pages/IntelPage.jsx \
        frontend/src/pages/SocialPage.jsx
git commit -m "feat(topics): feed pages consume topicsOnly prop + empty state"
```

---

### Task 13: `ProfilePage` — Topics + Telegram sections

**Files:**
- Modify: `frontend/src/pages/ProfilePage.jsx`

- [ ] **Step 1: Add topic state + catalog fetch to ProfilePage**

At the top of `ProfilePage`, after existing imports:

```jsx
import TopicSelector from '../components/TopicSelector'
```

Inside the component, add state:

```jsx
const [catalog,      setCatalog]      = useState([])
const [myTopics,     setMyTopics]     = useState([])
const [topicLimit,   setTopicLimit]   = useState(2)
const [topicPlan,    setTopicPlan]    = useState('free')
const [topicSaving,  setTopicSaving]  = useState(false)
const [topicMsg,     setTopicMsg]     = useState('')

const [chatId,       setChatId]       = useState('')
const [tgSaving,     setTgSaving]     = useState(false)
const [tgMsg,        setTgMsg]        = useState('')
const [tgTesting,    setTgTesting]    = useState(false)
const [tgTestMsg,    setTgTestMsg]    = useState('')
```

Add a useEffect to load catalog + current topics:

```jsx
useEffect(() => {
  async function load() {
    try {
      const [catRes, topRes, tgRes] = await Promise.all([
        fetch('/api/topics'),
        fetch('/api/me/topics',   { headers: authHeaders() }),
        fetch('/api/me/telegram', { headers: authHeaders() }),
      ])
      const cat = await catRes.json()
      const top = await topRes.json()
      const tg  = await tgRes.json()
      setCatalog(cat.topics || [])
      setMyTopics(top.topics || [])
      setTopicLimit(top.limit ?? 2)
      setTopicPlan(top.plan || 'free')
      setChatId(tg.chat_id || '')
    } catch (_) {}
  }
  load()
}, [])
```

- [ ] **Step 2: Add topic save handler**

```jsx
async function handleSaveTopics() {
  setTopicSaving(true); setTopicMsg('')
  try {
    const res = await fetch('/api/me/topics', {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: myTopics }),
    })
    const data = await res.json()
    if (!res.ok) { setTopicMsg(data.detail || 'Error saving topics'); return }
    setTopicMsg('Topics saved ✓')
  } catch (_) { setTopicMsg('Connection error') }
  finally { setTopicSaving(false) }
}
```

- [ ] **Step 3: Add Telegram save + test handlers**

```jsx
async function handleSaveTelegram() {
  setTgSaving(true); setTgMsg('')
  try {
    const res = await fetch('/api/me/telegram', {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId }),
    })
    if (!res.ok) { setTgMsg('Error saving Telegram'); return }
    setTgMsg('Saved ✓')
  } catch (_) { setTgMsg('Connection error') }
  finally { setTgSaving(false) }
}

async function handleTestTelegram() {
  setTgTesting(true); setTgTestMsg('')
  try {
    const res = await fetch('/api/me/telegram/test', {
      method: 'POST', headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) { setTgTestMsg(data.detail === 'no_chat_id' ? 'Save a chat ID first' : 'Send failed'); return }
    setTgTestMsg('Test message sent ✓')
  } catch (_) { setTgTestMsg('Connection error') }
  finally { setTgTesting(false) }
}
```

- [ ] **Step 4: Add JSX sections to the return**

In the return statement, after the existing "Cambiar contraseña" `<Section>`, add:

```jsx
{/* ── My Topics ── */}
<Section label="My Topics">
  <div style={{ marginBottom: '10px', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
    Plan: <span style={{ color: 'var(--accent)', textTransform: 'uppercase' }}>{topicPlan}</span>
    {' · '}{topicLimit == null ? '∞' : topicLimit} topics max
  </div>
  <TopicSelector
    selected={myTopics}
    limit={topicLimit}
    onChange={setMyTopics}
    catalog={catalog}
  />
  <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
    <button
      onClick={handleSaveTopics}
      disabled={topicSaving}
      style={{
        padding: '8px 20px', background: 'rgba(0,200,255,0.1)',
        border: '1px solid rgba(0,200,255,0.3)', borderRadius: '3px',
        color: 'var(--cyan)', fontFamily: 'var(--mono)',
        fontSize: 'var(--label-sm)', cursor: topicSaving ? 'default' : 'pointer',
        opacity: topicSaving ? 0.7 : 1,
      }}
    >
      {topicSaving ? 'SAVING…' : 'SAVE TOPICS'}
    </button>
    {topicMsg && (
      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
        color: topicMsg.includes('✓') ? 'var(--green)' : 'var(--red)' }}>
        {topicMsg}
      </span>
    )}
  </div>
</Section>

{/* ── Telegram Notifications ── */}
<Section label="Telegram Alerts">
  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', marginBottom: '12px', lineHeight: '1.6' }}>
    1. Open Telegram · 2. Search <span style={{ color: 'var(--txt-2)' }}>@QilinAlertBot</span> · 3. Send <span style={{ color: 'var(--txt-2)' }}>/start</span> · 4. Copy your chat ID below
  </div>
  <input
    value={chatId}
    onChange={e => setChatId(e.target.value)}
    placeholder="Your Telegram chat ID (e.g. 123456789)"
    style={{ ...FIELD, marginBottom: '10px' }}
  />
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
    <button onClick={handleSaveTelegram} disabled={tgSaving} style={{
      padding: '8px 16px', background: 'rgba(0,200,255,0.1)',
      border: '1px solid rgba(0,200,255,0.3)', borderRadius: '3px',
      color: 'var(--cyan)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
      cursor: tgSaving ? 'default' : 'pointer', opacity: tgSaving ? 0.7 : 1,
    }}>
      {tgSaving ? 'SAVING…' : 'SAVE'}
    </button>
    <button onClick={handleTestTelegram} disabled={tgTesting} style={{
      padding: '8px 16px', background: 'transparent',
      border: '1px solid var(--border-md)', borderRadius: '3px',
      color: 'var(--txt-2)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
      cursor: tgTesting ? 'default' : 'pointer', opacity: tgTesting ? 0.7 : 1,
    }}>
      {tgTesting ? 'SENDING…' : 'SEND TEST'}
    </button>
    {tgMsg && <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: tgMsg.includes('✓') ? 'var(--green)' : 'var(--red)' }}>{tgMsg}</span>}
    {tgTestMsg && <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: tgTestMsg.includes('✓') ? 'var(--green)' : 'var(--red)' }}>{tgTestMsg}</span>}
  </div>
</Section>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProfilePage.jsx
git commit -m "feat(topics): ProfilePage — My Topics + Telegram Alerts sections"
```

---

### Task 14: `RegisterPage` — 3-step wizard

**Files:**
- Modify: `frontend/src/pages/RegisterPage.jsx`

The wizard has 3 steps: Account → Topics → Telegram. Each step is a separate render based on `step` state. The account creation happens at Step 1 completion (POST /auth/register); topics and Telegram are saved after login token is obtained.

- [ ] **Step 1: Rewrite `RegisterPage.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import TopicSelector from '../components/TopicSelector'

const PLAN_LABELS = { scout: 'Scout — Free', analyst: 'Analyst — $49/mo', command: 'Command — $199/mo' }

const inputStyle = {
  background: 'rgba(200,160,60,0.05)', border: '1px solid rgba(200,160,60,0.18)',
  borderRadius: '6px', padding: '12px 14px', color: '#f0f4f8',
  fontSize: '14px', fontFamily: 'inherit', outline: 'none', width: '100%',
  boxSizing: 'border-box',
}

const stepBtn = {
  marginTop: '4px', padding: '14px',
  background: 'rgba(200,160,60,0.15)', border: '1px solid #c8a03c',
  borderRadius: '8px', color: '#e8c060', fontSize: '14px', fontWeight: '600',
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s', width: '100%',
}

const skipStyle = {
  textAlign: 'center', marginTop: '14px', fontSize: '13px',
  color: 'rgba(220,230,245,0.4)', cursor: 'pointer', fontFamily: 'inherit',
  background: 'none', border: 'none', width: '100%',
}

function StepIndicator({ step }) {
  const steps = ['Account', 'Topics', 'Telegram']
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
      {steps.map((label, i) => {
        const idx = i + 1
        const done = step > idx
        const active = step === idx
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? '#c8a03c' : active ? 'rgba(200,160,60,0.2)' : 'transparent',
              border: `1px solid ${done || active ? '#c8a03c' : 'rgba(200,160,60,0.2)'}`,
              fontSize: '11px', color: done ? '#02060e' : '#c8a03c', fontWeight: '700',
            }}>
              {done ? '✓' : idx}
            </div>
            <span style={{ fontSize: '12px', color: active ? '#c8a03c' : 'rgba(220,230,245,0.35)' }}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div style={{ width: '20px', height: '1px', background: 'rgba(200,160,60,0.2)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function RegisterPage() {
  const [step,      setStep]      = useState(1)
  const [username,  setUsername]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  // Step 2 — Topics
  const [catalog,   setCatalog]   = useState([])
  const [myTopics,  setMyTopics]  = useState([])

  // Step 3 — Telegram
  const [chatId,    setChatId]    = useState('')

  // Auth token obtained after step 1
  const [token,     setToken]     = useState('')

  const navigate = useNavigate()
  const [params]  = useSearchParams()
  const plan      = params.get('plan') || 'scout'

  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(d => setCatalog(d.topics || []))
      .catch(() => {})
  }, [])

  async function handleStep1(e) {
    e.preventDefault()
    setError('')
    if (password !== password2) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.toLowerCase(), email, password }),
      })
      if (res.status === 409) { setError('Username or email already registered'); return }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || 'Error creating account'); return
      }
      const { access_token } = await res.json()
      sessionStorage.setItem('qilin_token', access_token)
      sessionStorage.setItem('qilin_user', username.toLowerCase())
      setToken(access_token)
      setStep(2)
    } catch (_) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2Continue() {
    if (myTopics.length > 0) {
      try {
        await fetch('/api/me/topics', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ topics: myTopics }),
        })
      } catch (_) {}
    }
    setStep(3)
  }

  async function handleStep3Finish() {
    if (chatId.trim()) {
      try {
        await fetch('/api/me/telegram', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId.trim() }),
        })
      } catch (_) {}
    }
    navigate('/app', { replace: true })
  }

  const PLAN_TOPIC_LIMIT = { scout: 5, analyst: 20, command: null, free: 2 }
  const topicLimit = PLAN_TOPIC_LIMIT[plan] ?? 5

  return (
    <div style={{ minHeight: '100vh', background: '#02060e', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: step === 2 ? '640px' : '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '.3em',
              color: '#c8a03c', textTransform: 'uppercase',
              fontFamily: "'IBM Plex Mono',monospace", marginBottom: '8px' }}>◈ QILIN</div>
          </Link>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
            Create account
          </div>
          {plan !== 'scout' && (
            <div style={{ display: 'inline-block', padding: '4px 14px',
              background: 'rgba(200,160,60,0.1)', border: '1px solid rgba(200,160,60,0.3)',
              borderRadius: '20px', fontSize: '12px', color: '#c8a03c' }}>
              Plan: {PLAN_LABELS[plan] || plan}
            </div>
          )}
        </div>

        <StepIndicator step={step} />

        {/* ── Step 1: Account ── */}
        {step === 1 && (
          <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(220,230,245,0.5)', marginBottom: '6px' }}>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" required autoFocus style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(220,230,245,0.5)', marginBottom: '6px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(220,230,245,0.5)', marginBottom: '6px' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 8 characters" required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(220,230,245,0.5)', marginBottom: '6px' }}>Confirm password</label>
              <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} placeholder="repeat password" required style={inputStyle} />
            </div>
            {error && (
              <div style={{ fontSize: '13px', color: '#ff453a', background: 'rgba(255,69,58,0.08)',
                border: '1px solid rgba(255,69,58,0.2)', borderRadius: '6px', padding: '10px 14px', textAlign: 'center' }}>{error}</div>
            )}
            <button type="submit" disabled={loading} style={{ ...stepBtn, opacity: loading ? 0.7 : 1, cursor: loading ? 'default' : 'pointer' }}>
              {loading ? 'Creating account…' : 'Continue →'}
            </button>
          </form>
        )}

        {/* ── Step 2: Topics ── */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: '16px', fontSize: '14px', color: 'rgba(220,230,245,0.6)', textAlign: 'center' }}>
              Choose up to <strong style={{ color: '#c8a03c' }}>{topicLimit === null ? '∞' : topicLimit}</strong> topics to personalize your feed and alerts.
            </div>
            <div style={{ maxHeight: '55vh', overflowY: 'auto', padding: '2px 0' }}>
              <TopicSelector
                selected={myTopics}
                limit={topicLimit}
                onChange={setMyTopics}
                catalog={catalog}
              />
            </div>
            <button onClick={handleStep2Continue} style={{ ...stepBtn, marginTop: '20px' }}>
              {myTopics.length > 0 ? `Continue with ${myTopics.length} topic${myTopics.length !== 1 ? 's' : ''} →` : 'Continue →'}
            </button>
            <button onClick={() => setStep(3)} style={skipStyle}>Skip for now</button>
          </div>
        )}

        {/* ── Step 3: Telegram ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: 'rgba(220,230,245,0.5)', lineHeight: '1.7' }}>
              Get personalized Telegram alerts for your topics:
              <ol style={{ margin: '10px 0 0 18px', padding: 0, color: 'rgba(220,230,245,0.6)' }}>
                <li>Open Telegram</li>
                <li>Search for <strong style={{ color: '#c8a03c' }}>@QilinAlertBot</strong></li>
                <li>Send <strong style={{ color: '#c8a03c' }}>/start</strong></li>
                <li>Copy the chat ID it replies with</li>
              </ol>
            </div>
            <input
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="Your chat ID (e.g. 123456789)"
              style={inputStyle}
            />
            <button onClick={handleStep3Finish} style={stepBtn}>
              {chatId.trim() ? 'Finish & go to app →' : 'Go to app →'}
            </button>
            <button onClick={() => navigate('/app', { replace: true })} style={skipStyle}>Skip for now</button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'rgba(220,230,245,0.35)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'rgba(200,160,60,0.7)', textDecoration: 'none' }}>Sign in</Link>
          {' '}·{' '}
          <Link to="/" style={{ color: 'rgba(220,230,245,0.25)', textDecoration: 'none' }}>Back to home</Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify wizard flow manually**

Navigate to `http://localhost:3000/register`. Walk through all 3 steps. Verify:
- Step 1: account creation works and moves to Step 2
- Step 2: TopicSelector shows catalog, limit enforced, "Skip for now" works
- Step 3: chat ID input + "Finish" navigates to /app

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RegisterPage.jsx
git commit -m "feat(topics): RegisterPage 3-step wizard (account → topics → telegram)"
```

---

### Task 15: CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add new API endpoints to the endpoints table**

In the "API — Endpoints de posicionamiento" section and after it, add a new "API — Endpoints de personalización" section:

```markdown
## API — Endpoints de personalización de topics

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/topics` | Catálogo público de topics (~65, desde config/topics.yaml) |
| `GET /api/me/topics` | Topics suscritos por el usuario + límite del plan |
| `PUT /api/me/topics` | Actualiza topics del usuario (respeta límite del plan) |
| `GET /api/me/telegram` | Configuración Telegram del usuario |
| `PUT /api/me/telegram` | Guarda `telegram_chat_id` |
| `POST /api/me/telegram/test` | Envía mensaje de prueba al chat_id configurado |
```

- [ ] **Step 2: Add `topics_only` query param note to feed endpoints**

In the existing feed endpoint descriptions or in a note below them, add:
> Los endpoints `/news/feed`, `/social/feed` e `/intel/timeline` aceptan `?topics_only=true` para filtrar por los topics suscritos del usuario autenticado. Cuando `topics_only=true` la respuesta NO se cachea (es per-usuario).

- [ ] **Step 3: Update Base de datos section**

Add to the database tables list:
- `user_topics` — subscripciones de topics por usuario (user_id + topic_id)
- Nueva columna `users.telegram_chat_id` — chat ID de Telegram del usuario
- Nueva columna `news_events.topics`, `agent_findings.topics`, `analyzed_events.topics` — topics detectados por keyword matching

- [ ] **Step 4: Update Cache TTLs table**

Add:
```
| `/topics`            | `topics.catalog` | 3600 |
```

- [ ] **Step 5: Add topics.yaml to configuration files section**

Note that `config/topics.yaml` contains the topic catalog and must be mounted in `api`, `agent_engine`, and `ingestor_news` containers.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with personalized topics endpoints, tables, and cache entries"
```

---

### Task 16: Deployment

**Files:**
- VPS: `178.104.238.122`

- [ ] **Step 1: Push all commits to git remote**

```bash
git push origin main
```

- [ ] **Step 2: Connect to VPS and pull**

```bash
ssh deploy@178.104.238.122
cd /path/to/qilin
git pull origin main
```

- [ ] **Step 3: Run DB migration**

```bash
docker compose exec timescaledb psql -U qilin -d qilin \
  -f /migrations/2026-04-24-personalized-topics.sql
```

Verify:
```bash
docker compose exec timescaledb psql -U qilin -d qilin \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='user_topics';"
```
Expected: `user_id`, `topic_id`, `created_at`

- [ ] **Step 4: Copy topics.yaml to the running containers**

The `config/` volume is already mounted in all relevant services (per CLAUDE.md). Verify:
```bash
docker compose exec api ls /app/config/topics.yaml
```
If missing, restart containers to pick up the new config mount (no rebuild needed — the file is volume-mounted).

- [ ] **Step 5: Rebuild and redeploy API + agent_engine + ingestor_news**

```bash
docker compose build api agent-engine ingestor-news
docker compose up -d api agent-engine ingestor-news
```

- [ ] **Step 6: Verify new API endpoints**

```bash
# Get a token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -d "username=carlos&password=12345" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Test /topics catalog
curl -s http://localhost:8000/topics | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['topics']), 'topics')"
# Expected: 65 topics

# Test /me/topics
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/me/topics
# Expected: {"topics":[],"limit":5,"plan":"scout"}
```

- [ ] **Step 7: Build and deploy frontend**

```bash
cd frontend && npm run build
# Then push dist/ to VPS via scp or git-tracked build
```

Use the existing deployment workflow (paramiko script or direct scp):
```bash
python3 .deploy_ssh.py  # or the equivalent deploy script used in the project
```

- [ ] **Step 8: Smoke test production**

Navigate to `https://qilin.example.com/app`:
- Profile page shows "My Topics" and "Telegram Alerts" sections
- Topic selector loads the catalog
- Save topics, then toggle "MY FEED" in TopBar appears
- Toggle ON → news/intel/social filter by selected topics
- Registration wizard has 3 steps

- [ ] **Step 9: Final commit (if any prod tweaks made)**

```bash
git add -A
git commit -m "fix(topics): production tweaks post-deploy"
git push origin main
```
