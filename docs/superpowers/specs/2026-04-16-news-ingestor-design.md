# News Ingestor Design

## Objetivo

Ingestar artículos de 104 fuentes geopolíticas vía RSS, clasificarlos automáticamente por sector y severidad mediante reglas de keywords, persistirlos en TimescaleDB, y mostrarlos en la NewsPage del dashboard Qilin con filtros por zona, país, tipo de medio y sector.

## Arquitectura

```
config/news_sources.yaml (104 fuentes)
        │
        ▼
services/ingestor_news/main.py
  - feedparser: polling RSS cada NEWS_POLL_INTERVAL s (default 900)
  - Clasificador keyword → severity (high/medium/low) + sectors[]
  - Relevance score 0-100
  - Dedup por URL en Redis (TTL 24h)
  - Publica en stream:news + persiste en news_events (TimescaleDB)
        │
        ▼
services/api/main.py
  GET /news/feed   — filtros: zone, country, source_type, sector, severity, q, since, limit
  GET /news/sources — lista de fuentes desde news_sources.yaml
        │
        ▼
frontend/src/hooks/useNewsFeed.js  — polling REST cada 60s
frontend/src/pages/NewsPage.jsx    — datos reales + filtros nuevos
```

## Tech Stack

Python 3.12 asyncio + feedparser + httpx · FastAPI + asyncpg · Redis 7 Streams · TimescaleDB (PostgreSQL 16) · React 18 + Vite

---

## Fuentes — config/news_sources.yaml

Campos por fuente: `slug`, `name`, `rss_url`, `country`, `type`, `zone`, `sectors[]`, `priority`.

**Tipos:** `agency` · `newspaper` · `magazine` · `think_tank` · `government` · `defense_media`

**Sectores:** `militar` · `diplomacia` · `economia` · `energia` · `ciberseguridad` · `crisis_humanitaria` · `nuclear`

### Lista completa (104 fuentes)

**Agencias wire**
1. Reuters — UK — agency — global — todos — high
2. Associated Press — US — agency — global — todos — high
3. AFP — FR — agency — global — todos — high
4. DPA — DE — agency — europe — todos — medium
5. EFE — ES — agency — europe — todos — medium
6. TASS — RU — agency — ukraine_black_sea — militar, diplomacia — medium
7. Xinhua — CN — agency — china — todos — medium
8. Kyodo News — JP — agency — korea — todos — medium
9. Yonhap — KR — agency — korea — todos — medium

**Medios internacionales**
10. BBC World — UK — newspaper — europe — todos — high
11. Al Jazeera EN — QA — newspaper — levante — todos — high
12. France 24 EN — FR — newspaper — europe — todos — high
13. Deutsche Welle — DE — newspaper — europe — todos — medium
14. Euronews — EU — newspaper — europe — todos — medium
15. RT EN — RU — newspaper — ukraine_black_sea — diplomacia, militar — medium
16. CGTN — CN — newspaper — china — diplomacia — medium
17. NHK World — JP — newspaper — korea — todos — medium

**Defensa y militar**
18. Defense News — US — defense_media — global — militar — high
19. Defense One — US — defense_media — global — militar — high
20. The War Zone — US — defense_media — global — militar — high
21. Breaking Defense — US — defense_media — global — militar — high
22. Military Times — US — defense_media — north_america — militar — medium
23. Stars and Stripes — US — defense_media — global — militar — medium
24. Jane's (free feed) — UK — defense_media — global — militar — medium
25. Naval News — FR — defense_media — global — militar — medium
26. Alert5 — US — defense_media — global — militar — medium

**Think tanks / OSINT**
27. ISW — US — think_tank — ukraine_black_sea — militar — high
28. IISS — UK — think_tank — global — militar, diplomacia — high
29. RAND Corporation — US — think_tank — global — todos — medium
30. Brookings — US — think_tank — global — diplomacia, economia — medium
31. Atlantic Council — US — think_tank — europe — diplomacia — medium
32. CSIS — US — think_tank — global — militar, diplomacia — medium
33. CNAS — US — think_tank — global — militar — medium
34. Carnegie Endowment — US — think_tank — global — diplomacia, nuclear — medium
35. Stimson Center — US — think_tank — global — nuclear — medium
36. Chatham House — UK — think_tank — europe — diplomacia — medium
37. ECFR — EU — think_tank — europe — diplomacia — medium
38. Bellingcat — NL — think_tank — ukraine_black_sea — militar — high

**Política exterior / geopolítica**
39. Foreign Policy — US — magazine — global — todos — high
40. Foreign Affairs — US — magazine — global — todos — medium
41. The Diplomat — US — magazine — south_china_sea — todos — medium
42. War on the Rocks — US — magazine — global — militar, diplomacia — high
43. Lawfare — US — magazine — global — diplomacia, ciberseguridad — medium
44. The Economist — UK — magazine — global — todos — medium
45. The National Interest — US — magazine — global — militar, diplomacia — medium
46. Responsible Statecraft — US — magazine — global — diplomacia — medium

**Oriente Medio**
47. Middle East Eye — UK — newspaper — levante — todos — high
48. Al-Monitor — US — newspaper — levante — todos — high
49. Haaretz EN — IL — newspaper — levante — todos — medium
50. Jerusalem Post — IL — newspaper — levante — todos — medium
51. Times of Israel — IL — newspaper — levante — todos — medium
52. Arab News — SA — newspaper — gulf_ormuz — todos — medium
53. Gulf News — AE — newspaper — gulf_ormuz — todos — medium
54. Iran International — UK — newspaper — iran — todos — high
55. Al-Arabiya EN — SA — newspaper — levante — todos — medium
56. Turkish Minute — TR — newspaper — south_caucasus — todos — medium

**Europa del Este / Rusia / Ucrania**
57. Kyiv Independent — UA — newspaper — ukraine_black_sea — todos — high
58. Ukrainska Pravda EN — UA — newspaper — ukraine_black_sea — todos — high
59. Meduza EN — LV — newspaper — ukraine_black_sea — todos — medium
60. Moscow Times — NL — newspaper — ukraine_black_sea — todos — medium
61. RFE/RL — US — newspaper — ukraine_black_sea — todos — high
62. Euromaidan Press — UA — newspaper — ukraine_black_sea — militar — medium
63. Politico Europe — EU — newspaper — europe — diplomacia — medium
64. EUobserver — EU — newspaper — europe — diplomacia — medium

**Asia-Pacífico**
65. South China Morning Post — HK — newspaper — china — todos — high
66. The Straits Times — SG — newspaper — south_china_sea — todos — medium
67. Japan Times — JP — newspaper — korea — todos — medium
68. Korea Herald — KR — newspaper — korea — todos — medium
69. Dawn — PK — newspaper — india_pakistan — todos — medium
70. The Hindu — IN — newspaper — india_pakistan — todos — medium
71. NDTV — IN — newspaper — india_pakistan — todos — medium
72. Asia Times — HK — newspaper — south_china_sea — todos — medium
73. Taiwan News — TW — newspaper — china — todos — medium
74. NK News — US — newspaper — korea — militar — high
75. 38 North — US — think_tank — korea — nuclear, militar — high

**África / Sahel**
76. AllAfrica — ZA — newspaper — sahel — todos — medium
77. The Africa Report — FR — newspaper — sahel — todos — medium
78. Premium Times — NG — newspaper — sahel — todos — medium
79. Daily Maverick — ZA — newspaper — sahel — todos — medium

**LATAM**
80. Mercopress — UY — newspaper — venezuela — todos — medium
81. Infobae — AR — newspaper — venezuela — todos — medium
82. El País — ES — newspaper — venezuela — todos — medium
83. Insight Crime — CO — think_tank — venezuela — todos — medium

**Gobierno / Oficial**
84. NATO Newsroom — NATO — government — europe — militar, diplomacia — high
85. EU External Action — EU — government — europe — diplomacia — high
86. US DoD News — US — government — global — militar — high
87. UK MoD — UK — government — europe — militar — high
88. IAEA Newscenter — IAEA — government — iran — nuclear — high
89. UN News — UN — government — global — todos — high
90. OFAC (sanciones) — US — government — global — economia — high

**Economía / Sanciones**
91. Reuters Business — UK — agency — global — economia — high
92. Bloomberg Markets — US — newspaper — global — economia — medium
93. Financial Times — UK — newspaper — global — economia — medium
94. Politico DC — US — newspaper — north_america — diplomacia — medium
95. Axios — US — newspaper — north_america — todos — medium

**Ciberseguridad**
96. Recorded Future News — US — defense_media — global — ciberseguridad — high
97. Wired Security — US — magazine — global — ciberseguridad — medium
98. Krebs on Security — US — magazine — global — ciberseguridad — medium
99. Bleeping Computer — RO — magazine — global — ciberseguridad — medium

**Nuclear / CBRN**
100. Bulletin of Atomic Scientists — US — think_tank — global — nuclear — high
101. Arms Control Association — US — think_tank — global — nuclear — high
102. Nuclear Threat Initiative — US — think_tank — global — nuclear — high

**Energía**
103. Oil Price — UK — magazine — gulf_ormuz — energia — medium
104. S&P Global Platts — US — agency — gulf_ormuz — energia — medium

---

## Clasificador de keywords

### Sectores

Cada artículo recibe un array `sectors[]` con todos los sectores cuyos keywords aparecen en `title + summary`.

```python
SECTOR_KEYWORDS = {
    "militar": [
        "strike", "airstrike", "missile", "troops", "warship", "drone",
        "offensive", "ceasefire", "shelling", "bombardment", "tank",
        "fighter jet", "naval", "military operation", "armed forces",
        "artillery", "infantry", "battalion", "combat", "casualties",
        "frontline", "ammunition", "weapons", "air defense",
    ],
    "diplomacia": [
        "sanctions", "treaty", "negotiations", "summit", "ambassador",
        "ultimatum", "veto", "resolution", "un security council",
        "bilateral", "diplomatic", "envoy", "foreign minister",
        "secretary of state", "communique", "nato", "g7", "g20",
        "talks", "agreement", "deal", "accord", "expel", "recall",
    ],
    "economia": [
        "tariff", "embargo", "export ban", "swift", "imf", "default",
        "currency", "oil price", "gas pipeline", "trade war", "gdp",
        "inflation", "recession", "debt", "bond", "reserve",
        "world bank", "wto", "supply chain", "semiconductor",
    ],
    "energia": [
        "pipeline", "lng", "oil", "gas", "opec", "nuclear plant",
        "blackout", "energy deal", "power grid", "refinery",
        "nord stream", "electricity", "fuel", "petrol", "barrel",
    ],
    "ciberseguridad": [
        "cyberattack", "ransomware", "data breach", "hack", "malware",
        "critical infrastructure", "apt", "phishing", "zero-day",
        "cyber espionage", "ddos", "intrusion", "cyber operation",
    ],
    "crisis_humanitaria": [
        "refugees", "famine", "displacement", "civilian casualties",
        "aid convoy", "hospital", "evacuation", "humanitarian",
        "displaced", "starvation", "siege", "blockade", "war crimes",
        "icc", "genocide", "exodus",
    ],
    "nuclear": [
        "nuclear", "warhead", "icbm", "uranium", "plutonium", "iaea",
        "enrichment", "ballistic missile", "deterrence", "nonproliferation",
        "dirty bomb", "radiation", "nuclear deal", "npt",
    ],
}
```

### Severidad

```python
CRITICAL_KEYWORDS = {
    "nuclear strike", "nuclear attack", "invasion", "war declared",
    "coup", "airstrike kills", "missile strike", "ceasefire broken",
    "martial law", "state of emergency", "genocide", "war crimes",
    "nuclear test", "icbm launched", "aircraft carrier deployed",
}

def classify_severity(text: str, sectors: list[str]) -> str:
    text_lower = text.lower()
    # Cualquier keyword crítico → high
    if any(kw in text_lower for kw in CRITICAL_KEYWORDS):
        return "high"
    # Combinación de sectores activos o energía/economía con sanción
    active = {"militar", "nuclear", "ciberseguridad"}
    if len(set(sectors) & active) >= 1 and "diplomacia" in sectors:
        return "medium"
    if len(sectors) >= 2:
        return "medium"
    return "low"
```

### Relevance score (0-100)

```python
def compute_relevance(source: dict, sectors: list[str], severity: str) -> int:
    score = 0
    score += 30 if source["priority"] == "high" else 15
    score += min(len(sectors) * 8, 40)
    score += {"high": 20, "medium": 10, "low": 0}[severity]
    return min(score, 100)
```

---

## Esquema de base de datos

### Extensión de news_events

```sql
ALTER TABLE news_events
    ADD COLUMN IF NOT EXISTS severity       TEXT DEFAULT 'low',
    ADD COLUMN IF NOT EXISTS relevance      INT  DEFAULT 50,
    ADD COLUMN IF NOT EXISTS source_country TEXT,
    ADD COLUMN IF NOT EXISTS source_type    TEXT,
    ADD COLUMN IF NOT EXISTS sectors        TEXT[];

CREATE UNIQUE INDEX IF NOT EXISTS news_events_url_key ON news_events (url);
CREATE INDEX IF NOT EXISTS news_events_severity ON news_events (severity, time DESC);
CREATE INDEX IF NOT EXISTS news_events_source_country ON news_events (source_country, time DESC);
CREATE INDEX IF NOT EXISTS news_events_source_type ON news_events (source_type, time DESC);
```

---

## Ingestor (services/ingestor_news/)

### Ficheros

- `requirements.txt` — `feedparser==6.0.*`, `httpx==0.27.*`, `asyncpg==0.29.*`, `redis==5.0.*`, `pyyaml==6.0.*`
- `Dockerfile` — FROM python:3.12-slim
- `main.py` — lógica principal
- `test_classify.py` — tests unitarios del clasificador

### Lógica de main.py

```
arranque:
  1. Cargar news_sources.yaml
  2. Conectar Redis + TimescaleDB
  3. Ordenar fuentes: high priority primero

loop cada NEWS_POLL_INTERVAL (default 900s):
  para cada fuente:
    GET rss_url con httpx (timeout 15s, user-agent Qilin/1.0)
    parsear con feedparser
    para cada entry:
      texto = title + " " + summary
      sectors = classify_sectors(texto)
      severity = classify_severity(texto, sectors)
      relevance = compute_relevance(source, sectors, severity)
      url = entry.link
      si redis.exists(f"current:news:{hash(url)}") → skip
      redis.setex(key, 86400, "1")
      redis.xadd("stream:news", {data: json}, maxlen=2000)
      asyncpg INSERT INTO news_events ... ON CONFLICT (url) DO NOTHING
    await asyncio.sleep(1)  # cortesía entre fuentes
```

### Variables de entorno

- `REDIS_URL` — default `redis://localhost:6379`
- `DB_URL` — connection string PostgreSQL
- `NEWS_POLL_INTERVAL` — default `900` (15 min)

---

## API — endpoints

### GET /news/feed

Parámetros: `limit` (default 50, max 200), `zone`, `country`, `source_type`, `sector`, `severity`, `q` (búsqueda texto), `since` (ISO datetime).

Lee de TimescaleDB con filtros dinámicos ORDER BY time DESC. Fallback a `stream:news` en Redis si DB no disponible.

Requiere auth: `Depends(get_current_user)`.

### GET /news/sources

Devuelve la lista completa de fuentes desde `news_sources.yaml`. Sin filtros. Requiere auth.

---

## Frontend

### useNewsFeed.js

Hook análogo a `useSocialFeed.js`:
- Fetch paralelo de `/api/news/feed?limit=100` y `/api/news/sources` al montar
- Polling cada 60s
- Devuelve: `{ articles, sources, countries, sourceTypes, sectors, loading, lastUpdate }`
- `countries`, `sourceTypes`, `sectors` derivados de `sources` para poblar los filtros

### NewsPage.jsx

Cambios respecto al estado actual:
- Sustituir `MOCK_NEWS` por `useNewsFeed()`
- Añadir 3 filtros nuevos en el sidebar: **País**, **Tipo de medio**, **Sector**
- Mantener filtros existentes: Severidad, Zona, búsqueda
- En `NewsCard`: añadir etiqueta de `source_type` y `source_country` junto a la fuente
- Tags bajo el titular muestran los `sectors[]` detectados (en lugar de tags mock)
- `RelevanceBar` usa el campo `relevance` real de la API

### Filtros en el sidebar (orden de arriba a abajo)

1. BUSCAR (input texto)
2. SEVERIDAD (high / medium / low)
3. SECTOR (7 opciones)
4. ZONA
5. PAÍS
6. TIPO DE MEDIO

---

## Docker Compose

```yaml
ingestor-news:
  build: ./services/ingestor_news
  container_name: qilin_ingestor_news
  restart: unless-stopped
  environment:
    REDIS_URL: redis://redis:6379
    DB_URL: postgresql://${DB_USER:-qilin}:${DB_PASSWORD:-changeme}@timescaledb:5432/qilin
    NEWS_POLL_INTERVAL: ${NEWS_POLL_INTERVAL:-900}
  volumes:
    - ./config:/app/config
  depends_on:
    - redis
    - timescaledb
```

No requiere token externo — RSS es acceso público.

---

## Tests unitarios (test_classify.py)

- `test_classify_sectors_militar` — título con "airstrike" → sectors contiene "militar"
- `test_classify_sectors_multiple` — texto con "missile" y "sanctions" → sectors contiene militar y diplomacia
- `test_severity_high_critical_keyword` — "invasion" en título → severity = "high"
- `test_severity_medium_two_sectors` — militar + diplomacia → severity = "medium"
- `test_severity_low_no_keywords` — texto neutral → severity = "low"
- `test_relevance_high_priority_source` — fuente high + 2 sectores + severity high → score ≥ 70
- `test_relevance_medium_source` — fuente medium + 0 sectores → score = 15

---

## Notas de implementación

- `feedparser` es síncrono. Llamarlo con `asyncio.get_event_loop().run_in_executor(None, feedparser.parse, url)` para no bloquear el loop.
- Algunas fuentes (TASS, RT) pueden estar bloqueadas por IP. El ingestor registra el error y continúa.
- `news_events` NO es hypertable por `url` (tiene PRIMARY KEY bigserial). La columna `time` ya tiene índice. No se llama a `create_hypertable` de nuevo — ya existe.
- La URL del RSS se almacena en `news_sources.yaml`. Si una fuente cambia su RSS, se edita solo el YAML sin tocar código.
