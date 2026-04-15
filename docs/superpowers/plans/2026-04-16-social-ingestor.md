# Social Ingestor (X/Twitter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingestar tweets de 104 cuentas geopolíticas vía X API v2, persistirlos en TimescaleDB, y mostrarlos en la SocialPage del dashboard Qilin con filtros por categoría y zona.

**Architecture:** Nuevo servicio Docker `ingestor_social` hace polling cada 15 min, deduplica por `tweet_id` en Redis, persiste en tabla `social_posts` (TimescaleDB hypertable). La API FastAPI expone `/social/feed` y `/social/accounts`. La SocialPage consume el feed vía polling REST cada 60s.

**Tech Stack:** Python 3.12 asyncio + httpx (ingestor) · FastAPI + asyncpg (API) · Redis 7 Streams · TimescaleDB (PostgreSQL 16) · React 18 + Vite (frontend)

---

## File Map

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Modificar | `db/init.sql` | Añadir tabla `social_posts` + índices + hypertable |
| Crear | `config/social_accounts.yaml` | 104 cuentas con handle, display, category, zone, priority |
| Crear | `services/ingestor_social/requirements.txt` | Dependencias Python del ingestor |
| Crear | `services/ingestor_social/Dockerfile` | Imagen del servicio |
| Crear | `services/ingestor_social/main.py` | Lógica de polling X API v2, dedup, publicación |
| Crear | `services/ingestor_social/test_parse.py` | Tests unitarios de `parse_tweet` |
| Modificar | `services/api/main.py` | Endpoints `/social/feed` y `/social/accounts` |
| Modificar | `docker-compose.yml` | Nuevo servicio `ingestor-social` |
| Modificar | `.env.example` | Variables `X_BEARER_TOKEN` y `SOCIAL_POLL_INTERVAL` |
| Crear | `frontend/src/hooks/useSocialFeed.js` | Hook React para fetch y polling del feed social |
| Modificar | `frontend/src/pages/SocialPage.jsx` | Reemplazar mock data con datos reales de la API |

---

## Task 1: Esquema de base de datos

**Files:**
- Modify: `db/init.sql`

- [ ] **Step 1: Añadir tabla `social_posts` al final de `db/init.sql`**

Abrir `db/init.sql` y añadir al final:

```sql
-- ─── POSTS SOCIALES (X / Twitter) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
    time        TIMESTAMPTZ  NOT NULL,
    tweet_id    TEXT         NOT NULL,
    handle      TEXT         NOT NULL,
    display     TEXT,
    category    TEXT,
    zone        TEXT,
    content     TEXT,
    lang        TEXT,
    likes       INT          DEFAULT 0,
    retweets    INT          DEFAULT 0,
    url         TEXT,
    media_url   TEXT,
    media_type  TEXT,        -- 'photo' | 'video' | 'animated_gif' | NULL
    CONSTRAINT social_posts_tweet_id_key UNIQUE (tweet_id)
);

SELECT create_hypertable('social_posts', 'time', if_not_exists => TRUE);
SELECT add_compression_policy('social_posts', INTERVAL '7 days');

CREATE INDEX IF NOT EXISTS social_posts_handle_time ON social_posts (handle, time DESC);
CREATE INDEX IF NOT EXISTS social_posts_category_time ON social_posts (category, time DESC);
CREATE INDEX IF NOT EXISTS social_posts_zone_time ON social_posts (zone, time DESC);
```

- [ ] **Step 2: Aplicar migración en un contenedor existente**

Si TimescaleDB ya está corriendo con datos, la tabla no se crea automáticamente (init.sql solo corre en primera creación). Ejecutar manualmente:

```bash
docker exec -i qilin_db psql -U qilin -d qilin << 'EOF'
CREATE TABLE IF NOT EXISTS social_posts (
    time        TIMESTAMPTZ  NOT NULL,
    tweet_id    TEXT         NOT NULL,
    handle      TEXT         NOT NULL,
    display     TEXT,
    category    TEXT,
    zone        TEXT,
    content     TEXT,
    lang        TEXT,
    likes       INT          DEFAULT 0,
    retweets    INT          DEFAULT 0,
    url         TEXT,
    media_url   TEXT,
    media_type  TEXT,
    CONSTRAINT social_posts_tweet_id_key UNIQUE (tweet_id)
);
SELECT create_hypertable('social_posts', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS social_posts_handle_time ON social_posts (handle, time DESC);
CREATE INDEX IF NOT EXISTS social_posts_category_time ON social_posts (category, time DESC);
CREATE INDEX IF NOT EXISTS social_posts_zone_time ON social_posts (zone, time DESC);
EOF
```

Verificar:
```bash
docker exec qilin_db psql -U qilin -d qilin -c "\d social_posts"
```
Esperado: tabla con columnas `time`, `tweet_id`, `handle`, etc.

- [ ] **Step 3: Commit**

```bash
git add db/init.sql
git commit -m "feat(db): tabla social_posts hypertable para tweets de X"
```

---

## Task 2: Configuración de cuentas

**Files:**
- Create: `config/social_accounts.yaml`

- [ ] **Step 1: Crear el fichero con las 104 cuentas**

```yaml
# Qilin — Cuentas de X (Twitter) monitorizadas
# Campos: handle (sin @), display, category, zone, priority (high|medium)

accounts:

  # ── US GOV / EJECUTIVO ──────────────────────────────────────────────────────
  - handle: realDonaldTrump
    display: "Donald Trump"
    category: us_gov
    zone: north_america
    priority: high

  - handle: POTUS
    display: "Presidente USA (oficial)"
    category: us_gov
    zone: north_america
    priority: high

  - handle: WhiteHouse
    display: "Casa Blanca"
    category: us_gov
    zone: north_america
    priority: high

  - handle: VP
    display: "Vicepresidente USA"
    category: us_gov
    zone: north_america
    priority: medium

  - handle: StateDept
    display: "Depto. de Estado"
    category: us_gov
    zone: north_america
    priority: high

  - handle: SecRubio
    display: "Marco Rubio (Sec. Estado)"
    category: us_gov
    zone: north_america
    priority: high

  - handle: SecDef
    display: "Secretario de Defensa"
    category: us_gov
    zone: north_america
    priority: high

  - handle: NSC_Press
    display: "Consejo Seg. Nacional"
    category: us_gov
    zone: north_america
    priority: medium

  - handle: PressSec
    display: "Portavoz Casa Blanca"
    category: us_gov
    zone: north_america
    priority: medium

  - handle: JointChiefs
    display: "Jefes del Estado Mayor"
    category: us_mil
    zone: north_america
    priority: high

  # ── US AGENCIAS / MANDOS ────────────────────────────────────────────────────
  - handle: DeptofDefense
    display: "Pentágono"
    category: us_mil
    zone: north_america
    priority: high

  - handle: CIA
    display: "CIA"
    category: us_gov
    zone: north_america
    priority: medium

  - handle: FBI
    display: "FBI"
    category: us_gov
    zone: north_america
    priority: medium

  - handle: CISAgov
    display: "CISA (Ciberseguridad)"
    category: us_gov
    zone: north_america
    priority: medium

  - handle: NSAGov
    display: "NSA"
    category: us_gov
    zone: north_america
    priority: medium

  - handle: CENTCOM
    display: "CENTCOM"
    category: us_mil
    zone: iran
    priority: high

  - handle: INDOPACOM
    display: "INDOPACOM"
    category: us_mil
    zone: south_china_sea
    priority: high

  # ── EUROPA — LÍDERES ────────────────────────────────────────────────────────
  - handle: EmmanuelMacron
    display: "Emmanuel Macron"
    category: europe
    zone: europe
    priority: high

  - handle: OlafScholz
    display: "Olaf Scholz"
    category: europe
    zone: europe
    priority: high

  - handle: Keir_Starmer
    display: "Keir Starmer"
    category: europe
    zone: europe
    priority: high

  - handle: MeloniGiorgia
    display: "Giorgia Meloni"
    category: europe
    zone: europe
    priority: high

  - handle: sanchezcastejon
    display: "Pedro Sánchez"
    category: europe
    zone: europe
    priority: medium

  - handle: vonderleyen
    display: "Ursula von der Leyen"
    category: nato_eu
    zone: europe
    priority: high

  - handle: CharlesMichel
    display: "Charles Michel"
    category: nato_eu
    zone: europe
    priority: medium

  - handle: JosepBorrellF
    display: "Josep Borrell"
    category: nato_eu
    zone: europe
    priority: high

  - handle: MarkRutte
    display: "Mark Rutte (OTAN)"
    category: nato_eu
    zone: europe
    priority: high

  - handle: kajakallas
    display: "Kaja Kallas (PE Exterior)"
    category: nato_eu
    zone: europe
    priority: high

  - handle: AndrzejDuda
    display: "Andrzej Duda (Polonia)"
    category: europe
    zone: europe
    priority: medium

  - handle: ZelenskyyUa
    display: "Volodymyr Zelensky"
    category: ukraine
    zone: ukraine_black_sea
    priority: high

  # ── OTAN / EU INSTITUCIONES ─────────────────────────────────────────────────
  - handle: NATO
    display: "OTAN"
    category: nato_eu
    zone: europe
    priority: high

  - handle: EU_Commission
    display: "Comisión Europea"
    category: nato_eu
    zone: europe
    priority: medium

  - handle: Europarl_EN
    display: "Parlamento Europeo"
    category: nato_eu
    zone: europe
    priority: medium

  - handle: EUCouncil
    display: "Consejo EU"
    category: nato_eu
    zone: europe
    priority: medium

  - handle: EU_EEAS
    display: "Servicio Exterior EU"
    category: nato_eu
    zone: europe
    priority: medium

  # ── RUSIA / UCRANIA ─────────────────────────────────────────────────────────
  - handle: KremlinRussia_E
    display: "Kremlin (EN)"
    category: russia
    zone: ukraine_black_sea
    priority: high

  - handle: mfa_russia
    display: "MFA Rusia"
    category: russia
    zone: ukraine_black_sea
    priority: high

  - handle: mod_russia
    display: "MoD Rusia"
    category: russia
    zone: ukraine_black_sea
    priority: high

  - handle: Medvedev
    display: "Dmitry Medvedev"
    category: russia
    zone: ukraine_black_sea
    priority: high

  - handle: Ukraine
    display: "Gobierno Ucrania"
    category: ukraine
    zone: ukraine_black_sea
    priority: high

  - handle: DefenceU
    display: "MoD Ucrania"
    category: ukraine
    zone: ukraine_black_sea
    priority: high

  - handle: GeneralStaffUA
    display: "Estado Mayor Ucrania"
    category: ukraine
    zone: ukraine_black_sea
    priority: high

  - handle: MFA_Ukraine
    display: "MFA Ucrania"
    category: ukraine
    zone: ukraine_black_sea
    priority: medium

  - handle: Podolyak_M
    display: "Mykhailo Podolyak"
    category: ukraine
    zone: ukraine_black_sea
    priority: medium

  # ── ORIENTE MEDIO ───────────────────────────────────────────────────────────
  - handle: netanyahu
    display: "Benjamin Netanyahu"
    category: middle_east
    zone: levante
    priority: high

  - handle: IsraeliPM
    display: "PM Israel (oficial)"
    category: middle_east
    zone: levante
    priority: high

  - handle: IDF
    display: "Israel Defense Forces"
    category: middle_east_mil
    zone: levante
    priority: high

  - handle: khamenei_ir
    display: "Ayatolá Jamenei"
    category: middle_east
    zone: iran
    priority: high

  - handle: Iran_UN
    display: "Misión Irán en ONU"
    category: middle_east
    zone: iran
    priority: medium

  - handle: KSAMOFA
    display: "MFA Arabia Saudí"
    category: middle_east
    zone: gulf_ormuz
    priority: medium

  - handle: RTErdogan
    display: "Recep T. Erdoğan"
    category: middle_east
    zone: south_caucasus
    priority: high

  - handle: MFA_Turkey
    display: "MFA Turquía"
    category: middle_east
    zone: south_caucasus
    priority: medium

  - handle: QatarMFA
    display: "MFA Qatar"
    category: middle_east
    zone: gulf_ormuz
    priority: medium

  - handle: UAEGov
    display: "Gobierno EAU"
    category: middle_east
    zone: gulf_ormuz
    priority: medium

  - handle: MFA_Egypt
    display: "MFA Egipto"
    category: middle_east
    zone: libya
    priority: medium

  - handle: LebanonMFA
    display: "MFA Líbano"
    category: middle_east
    zone: levante
    priority: medium

  # ── ASIA-PACÍFICO ───────────────────────────────────────────────────────────
  - handle: narendramodi
    display: "Narendra Modi"
    category: asia_pacific
    zone: india_pakistan
    priority: high

  - handle: MEAIndia
    display: "MFA India"
    category: asia_pacific
    zone: india_pakistan
    priority: medium

  - handle: MFAChina
    display: "MFA China"
    category: asia_pacific
    zone: china
    priority: high

  - handle: SpokespersonCHN
    display: "Portavoz MFA China"
    category: asia_pacific
    zone: china
    priority: high

  - handle: XHNews
    display: "Xinhua"
    category: china_state
    zone: china
    priority: medium

  - handle: MFA_Japan
    display: "MFA Japón"
    category: asia_pacific
    zone: korea
    priority: medium

  - handle: JPN_PMO
    display: "PM Japón"
    category: asia_pacific
    zone: korea
    priority: high

  - handle: AusDeptDefence
    display: "Defensa Australia"
    category: asia_pacific
    zone: south_china_sea
    priority: medium

  - handle: MFASingapore
    display: "MFA Singapur"
    category: asia_pacific
    zone: south_china_sea
    priority: medium

  - handle: KoreaMFA
    display: "MFA Corea del Sur"
    category: asia_pacific
    zone: korea
    priority: medium

  # ── CHINA ESTADO ────────────────────────────────────────────────────────────
  - handle: PDChina
    display: "People's Daily"
    category: china_state
    zone: china
    priority: medium

  - handle: CGTNOfficial
    display: "CGTN"
    category: china_state
    zone: china
    priority: medium

  - handle: ChinaDaily
    display: "China Daily"
    category: china_state
    zone: china
    priority: medium

  - handle: HuXijin_GT
    display: "Hu Xijin (ex Global Times)"
    category: china_state
    zone: china
    priority: medium

  - handle: globaltimesnews
    display: "Global Times"
    category: china_state
    zone: china
    priority: medium

  # ── LATINOAMÉRICA ───────────────────────────────────────────────────────────
  - handle: lulaoficial
    display: "Lula da Silva"
    category: latam
    zone: venezuela
    priority: medium

  - handle: JMilei
    display: "Javier Milei"
    category: latam
    zone: venezuela
    priority: high

  - handle: NicolasMaduro
    display: "Nicolás Maduro"
    category: latam
    zone: venezuela
    priority: high

  - handle: Claudiashein
    display: "Claudia Sheinbaum"
    category: latam
    zone: north_america
    priority: medium

  - handle: petrogustavo
    display: "Gustavo Petro"
    category: latam
    zone: venezuela
    priority: medium

  - handle: LuisArce_Bo
    display: "Luis Arce (Bolivia)"
    category: latam
    zone: venezuela
    priority: medium

  # ── ORGANISMOS INTERNACIONALES ──────────────────────────────────────────────
  - handle: UN
    display: "Naciones Unidas"
    category: intl_org
    zone: europe
    priority: high

  - handle: IAEA
    display: "AIEA"
    category: intl_org
    zone: iran
    priority: high

  - handle: WHO
    display: "OMS"
    category: intl_org
    zone: europe
    priority: medium

  - handle: IMFNews
    display: "FMI"
    category: intl_org
    zone: europe
    priority: medium

  - handle: WFP
    display: "Prog. Mundial Alimentos"
    category: intl_org
    zone: sahel
    priority: medium

  - handle: UNHCR
    display: "ACNUR"
    category: intl_org
    zone: europe
    priority: medium

  - handle: _AfricanUnion
    display: "Unión Africana"
    category: intl_org
    zone: sahel
    priority: medium

  - handle: OPCW
    display: "Org. Armas Químicas"
    category: intl_org
    zone: europe
    priority: medium

  # ── THINK TANKS / OSINT ─────────────────────────────────────────────────────
  - handle: ISWonline
    display: "Inst. Study of War"
    category: think_tank
    zone: ukraine_black_sea
    priority: high

  - handle: AtlanticCouncil
    display: "Atlantic Council"
    category: think_tank
    zone: europe
    priority: medium

  - handle: IISS_org
    display: "IISS"
    category: think_tank
    zone: europe
    priority: medium

  - handle: CFR_org
    display: "Council on Foreign Relations"
    category: think_tank
    zone: north_america
    priority: medium

  - handle: RANDCorporation
    display: "RAND Corporation"
    category: think_tank
    zone: north_america
    priority: medium

  - handle: bellingcat
    display: "Bellingcat"
    category: think_tank
    zone: ukraine_black_sea
    priority: high

  - handle: EliotHiggins
    display: "Eliot Higgins (Bellingcat)"
    category: think_tank
    zone: ukraine_black_sea
    priority: medium

  - handle: IanBremmer
    display: "Ian Bremmer (Eurasia Group)"
    category: think_tank
    zone: north_america
    priority: medium

  - handle: OSINTdefender
    display: "OSINT Defender"
    category: think_tank
    zone: ukraine_black_sea
    priority: high

  - handle: CovertShores
    display: "Covert Shores (naval)"
    category: think_tank
    zone: south_china_sea
    priority: medium

  # ── MEDIOS GEOPOLÍTICOS ─────────────────────────────────────────────────────
  - handle: Reuters
    display: "Reuters"
    category: media
    zone: europe
    priority: high

  - handle: AP
    display: "Associated Press"
    category: media
    zone: north_america
    priority: high

  - handle: BBCWorld
    display: "BBC World"
    category: media
    zone: europe
    priority: high

  - handle: AlJazeera
    display: "Al Jazeera"
    category: media
    zone: middle_east
    priority: high

  - handle: AFP
    display: "AFP"
    category: media
    zone: europe
    priority: medium

  - handle: ForeignPolicy
    display: "Foreign Policy"
    category: media
    zone: north_america
    priority: medium

  - handle: TheEconomist
    display: "The Economist"
    category: media
    zone: europe
    priority: medium

  - handle: MiddleEastEye
    display: "Middle East Eye"
    category: media
    zone: levante
    priority: medium

  - handle: defense_one
    display: "Defense One"
    category: media
    zone: north_america
    priority: medium

  - handle: EURACTIV
    display: "Euractiv"
    category: media
    zone: europe
    priority: medium
```

- [ ] **Step 2: Verificar que el YAML parsea correctamente**

```bash
python3 -c "
import yaml
with open('config/social_accounts.yaml') as f:
    cfg = yaml.safe_load(f)
accounts = cfg['accounts']
print(f'Total cuentas: {len(accounts)}')
cats = set(a['category'] for a in accounts)
print(f'Categorías: {sorted(cats)}')
"
```
Esperado: `Total cuentas: 104` y lista de 13 categorías.

- [ ] **Step 3: Commit**

```bash
git add config/social_accounts.yaml
git commit -m "feat(config): 104 cuentas X para monitorización geopolítica"
```

---

## Task 3: Ingestor social — servicio Python

**Files:**
- Create: `services/ingestor_social/requirements.txt`
- Create: `services/ingestor_social/Dockerfile`
- Create: `services/ingestor_social/main.py`
- Create: `services/ingestor_social/test_parse.py`

- [ ] **Step 1: Crear `requirements.txt`**

```
httpx==0.27.*
asyncpg==0.29.*
redis==5.0.*
pyyaml==6.0.*
```

- [ ] **Step 2: Crear `Dockerfile`**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```

- [ ] **Step 3: Escribir el test de la función pura `parse_tweet` primero**

Crear `services/ingestor_social/test_parse.py`:

```python
"""Tests unitarios para parse_tweet — sin dependencias externas."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))


def parse_tweet(raw: dict, account: dict, media_map: dict) -> dict:
    """Importada inline para test aislado — debe coincidir con main.py."""
    media_url = None
    media_type = None
    keys = raw.get("attachments", {}).get("media_keys", [])
    if keys and keys[0] in media_map:
        m = media_map[keys[0]]
        media_type = m.get("type")
        media_url = m.get("url") or m.get("preview_image_url")

    metrics = raw.get("public_metrics", {})
    tweet_id = raw["id"]

    return {
        "tweet_id":   tweet_id,
        "handle":     account["handle"],
        "display":    account["display"],
        "category":   account["category"],
        "zone":       account["zone"],
        "content":    raw["text"],
        "lang":       raw.get("lang"),
        "likes":      metrics.get("like_count", 0),
        "retweets":   metrics.get("retweet_count", 0),
        "url":        f"https://x.com/{account['handle']}/status/{tweet_id}",
        "media_url":  media_url,
        "media_type": media_type,
        "time":       raw.get("created_at", ""),
    }


ACCOUNT = {"handle": "IDF", "display": "Israel Defense Forces",
           "category": "middle_east_mil", "zone": "levante"}


def test_parse_basic_fields():
    raw = {
        "id": "1234567890",
        "text": "IDF forces operating in northern Gaza.",
        "created_at": "2026-04-16T08:32:00.000Z",
        "public_metrics": {"like_count": 1420, "retweet_count": 380},
        "lang": "en",
    }
    result = parse_tweet(raw, ACCOUNT, {})
    assert result["tweet_id"] == "1234567890"
    assert result["handle"] == "IDF"
    assert result["category"] == "middle_east_mil"
    assert result["zone"] == "levante"
    assert result["likes"] == 1420
    assert result["retweets"] == 380
    assert result["url"] == "https://x.com/IDF/status/1234567890"
    assert result["media_url"] is None
    assert result["media_type"] is None
    assert result["content"] == "IDF forces operating in northern Gaza."


def test_parse_photo_media():
    raw = {
        "id": "9999",
        "text": "Photo tweet.",
        "created_at": "2026-04-16T10:00:00.000Z",
        "public_metrics": {"like_count": 100, "retweet_count": 20},
        "lang": "en",
        "attachments": {"media_keys": ["3_abc123"]},
    }
    media_map = {"3_abc123": {"type": "photo", "url": "https://pbs.twimg.com/photo.jpg"}}
    result = parse_tweet(raw, ACCOUNT, media_map)
    assert result["media_type"] == "photo"
    assert result["media_url"] == "https://pbs.twimg.com/photo.jpg"


def test_parse_video_uses_preview_image():
    raw = {
        "id": "8888",
        "text": "Video tweet.",
        "created_at": "2026-04-16T11:00:00.000Z",
        "public_metrics": {"like_count": 50, "retweet_count": 5},
        "lang": "en",
        "attachments": {"media_keys": ["13_vid"]},
    }
    media_map = {
        "13_vid": {"type": "video", "preview_image_url": "https://pbs.twimg.com/preview.jpg"}
    }
    result = parse_tweet(raw, ACCOUNT, media_map)
    assert result["media_type"] == "video"
    assert result["media_url"] == "https://pbs.twimg.com/preview.jpg"


def test_parse_missing_metrics_defaults_to_zero():
    raw = {"id": "7777", "text": "No metrics.", "created_at": "2026-04-16T12:00:00.000Z"}
    result = parse_tweet(raw, ACCOUNT, {})
    assert result["likes"] == 0
    assert result["retweets"] == 0


def test_parse_unknown_media_key_ignored():
    raw = {
        "id": "6666",
        "text": "Mystery media.",
        "created_at": "2026-04-16T13:00:00.000Z",
        "attachments": {"media_keys": ["unknown_key"]},
    }
    result = parse_tweet(raw, ACCOUNT, {})
    assert result["media_url"] is None
    assert result["media_type"] is None
```

- [ ] **Step 4: Ejecutar tests para verificar que pasan**

```bash
cd services/ingestor_social
pip install pytest pyyaml
pytest test_parse.py -v
```
Esperado: 5 tests PASSED.

- [ ] **Step 5: Crear `main.py`**

```python
"""
Qilin — Ingestor Social (X / Twitter)
Fuente: X API v2 Basic — Bearer token de app, sin OAuth de usuario.

Estrategia:
  1. Arranque: resuelve handles → user IDs en grupos de 100.
  2. Cada SOCIAL_POLL_INTERVAL segundos: GET /2/users/:id/tweets por cuenta.
  3. Deduplica por tweet_id en Redis (TTL 24h).
  4. Publica en stream:social + persiste en social_posts (TimescaleDB).
  5. Cuentas con priority=high se procelan primero cada ciclo.
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SOCIAL] %(message)s")
log = logging.getLogger(__name__)

BASE_URL      = "https://api.twitter.com/2"
BEARER_TOKEN  = os.getenv("X_BEARER_TOKEN", "")
REDIS_URL     = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL        = os.getenv("DB_URL", "")
POLL_INTERVAL = int(os.getenv("SOCIAL_POLL_INTERVAL", "900"))  # 15 min


# ── Carga de configuración ────────────────────────────────────────────────────

def load_accounts() -> list[dict]:
    with open("/app/config/social_accounts.yaml") as f:
        cfg = yaml.safe_load(f)
    return cfg["accounts"]


# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_tweet(raw: dict, account: dict, media_map: dict) -> dict:
    """
    Convierte un tweet de la API v2 al formato interno de Qilin.
    media_map: {media_key: {type, url, preview_image_url}}
    """
    media_url = None
    media_type = None
    keys = raw.get("attachments", {}).get("media_keys", [])
    if keys and keys[0] in media_map:
        m = media_map[keys[0]]
        media_type = m.get("type")
        media_url = m.get("url") or m.get("preview_image_url")

    metrics = raw.get("public_metrics", {})
    tweet_id = raw["id"]

    return {
        "tweet_id":   tweet_id,
        "handle":     account["handle"],
        "display":    account["display"],
        "category":   account["category"],
        "zone":       account["zone"],
        "content":    raw["text"],
        "lang":       raw.get("lang"),
        "likes":      metrics.get("like_count", 0),
        "retweets":   metrics.get("retweet_count", 0),
        "url":        f"https://x.com/{account['handle']}/status/{tweet_id}",
        "media_url":  media_url,
        "media_type": media_type,
        "time":       raw.get("created_at", datetime.now(timezone.utc).isoformat()),
    }


# ── HTTP helpers ──────────────────────────────────────────────────────────────

async def resolve_user_ids(client: httpx.AsyncClient, accounts: list[dict]) -> dict[str, str]:
    """
    Resuelve handles → user IDs numéricos en batches de 100.
    Devuelve {handle_lower: user_id}.
    """
    id_map: dict[str, str] = {}
    for i in range(0, len(accounts), 100):
        batch = accounts[i:i + 100]
        handles = ",".join(a["handle"] for a in batch)
        try:
            r = await client.get(
                f"{BASE_URL}/users/by",
                params={"usernames": handles, "user.fields": "id,name"},
                timeout=15,
            )
            if r.status_code == 200:
                for u in r.json().get("data", []):
                    id_map[u["username"].lower()] = u["id"]
            else:
                log.warning(f"Error resolviendo IDs batch {i}: HTTP {r.status_code}")
        except Exception as e:
            log.warning(f"Error resolviendo IDs batch {i}: {e}")
        await asyncio.sleep(1)
    return id_map


async def fetch_user_tweets(
    client: httpx.AsyncClient, user_id: str
) -> tuple[list[dict], dict[str, dict]]:
    """
    Devuelve (tweets, media_map) para un user_id.
    En caso de 429 espera el tiempo indicado por x-rate-limit-reset.
    """
    try:
        r = await client.get(
            f"{BASE_URL}/users/{user_id}/tweets",
            params={
                "max_results": 10,
                "tweet.fields": "created_at,public_metrics,lang,attachments",
                "expansions": "attachments.media_keys",
                "media.fields": "url,preview_image_url,type",
            },
            timeout=15,
        )
        if r.status_code == 429:
            reset = int(r.headers.get("x-rate-limit-reset", "60"))
            wait  = max(reset - int(datetime.now(timezone.utc).timestamp()), 10)
            log.warning(f"Rate limit — esperando {wait}s")
            await asyncio.sleep(wait)
            return [], {}
        if r.status_code != 200:
            log.warning(f"HTTP {r.status_code} para user {user_id}")
            return [], {}
        data = r.json()
        tweets   = data.get("data", []) or []
        media_map = {
            m["media_key"]: m
            for m in data.get("includes", {}).get("media", [])
        }
        return tweets, media_map
    except Exception as e:
        log.warning(f"Error fetching tweets user {user_id}: {e}")
        return [], {}


# ── Publicación ───────────────────────────────────────────────────────────────

async def publish(redis, db, tweet: dict) -> bool:
    """
    Publica tweet nuevo en Redis stream y TimescaleDB.
    Retorna True si era nuevo, False si ya existía.
    """
    key = f"current:tweet:{tweet['tweet_id']}"
    if await redis.exists(key):
        return False

    payload = json.dumps(tweet)
    await redis.setex(key, 86400, payload)
    await redis.xadd("stream:social", {"data": payload}, maxlen=2000)

    if db:
        try:
            await db.execute(
                """
                INSERT INTO social_posts
                    (time, tweet_id, handle, display, category, zone,
                     content, lang, likes, retweets, url, media_url, media_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (tweet_id) DO NOTHING
                """,
                tweet["time"], tweet["tweet_id"], tweet["handle"],
                tweet["display"], tweet["category"], tweet["zone"],
                tweet["content"], tweet["lang"], tweet["likes"],
                tweet["retweets"], tweet["url"],
                tweet["media_url"], tweet["media_type"],
            )
        except Exception as e:
            log.error(f"Error guardando tweet {tweet['tweet_id']} en DB: {e}")

    return True


# ── Loop principal ────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin Social ingestor (X/Twitter) arrancando...")

    if not BEARER_TOKEN:
        log.error("X_BEARER_TOKEN no configurado — saliendo.")
        return

    accounts = load_accounts()
    log.info(f"Cargadas {len(accounts)} cuentas desde social_accounts.yaml")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Tweets no se persistirán.")

    headers = {
        "Authorization": f"Bearer {BEARER_TOKEN}",
        "User-Agent":    "Qilin/1.0 geopolitical-intelligence-platform",
    }

    async with httpx.AsyncClient(headers=headers) as client:
        log.info("Resolviendo user IDs de X...")
        id_map = await resolve_user_ids(client, accounts)
        log.info(f"Resueltos {len(id_map)}/{len(accounts)} user IDs")

        # Ordenar: high priority primero
        ordered = (
            [a for a in accounts if a.get("priority") == "high"] +
            [a for a in accounts if a.get("priority") != "high"]
        )

        while True:
            new_count = 0

            for account in ordered:
                handle  = account["handle"].lower()
                user_id = id_map.get(handle)
                if not user_id:
                    log.warning(f"Sin user ID para @{account['handle']} — omitido")
                    continue

                tweets, media_map = await fetch_user_tweets(client, user_id)
                for raw in tweets:
                    tweet = parse_tweet(raw, account, media_map)
                    if await publish(redis, db, tweet):
                        new_count += 1

                await asyncio.sleep(1)  # 1s entre cuentas — rate limit cortesía

            log.info(f"Ciclo completo — {new_count} tweets nuevos de {len(ordered)} cuentas")
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 6: Commit**

```bash
git add services/ingestor_social/
git commit -m "feat(ingestor-social): polling X API v2 con dedup Redis + persistencia TimescaleDB"
```

---

## Task 4: API — endpoints `/social/feed` y `/social/accounts`

**Files:**
- Modify: `services/api/main.py`

- [ ] **Step 1: Añadir import de yaml al bloque de imports de `api/main.py`**

Localizar la línea `import asyncpg` en `services/api/main.py` y añadir `import yaml` justo después (yaml ya está disponible por defecto en Python pero hay que importarlo). Añadir también al `requirements.txt` del API si no está.

Verificar que `pyyaml` está en `services/api/requirements.txt`. Si no, añadirlo:
```
pyyaml==6.0.*
```

- [ ] **Step 2: Añadir los dos endpoints al final de `services/api/main.py`, antes del bloque WebSocket**

Añadir después del endpoint `GET /meta/{icao24}` y antes del bloque `# ── WEBSOCKET`:

```python
# ── SOCIAL FEED ───────────────────────────────────────────────────────────────

@app.get("/social/feed")
async def get_social_feed(
    limit: int = 50,
    category: str | None = None,
    zone: str | None = None,
    handle: str | None = None,
    q: str | None = None,
    since: str | None = None,
    _user: str = Depends(get_current_user),
):
    """
    Feed de tweets de cuentas monitorizadas.
    Lee de TimescaleDB ordenado por tiempo DESC.
    Fallback a Redis stream:social si DB no disponible.
    """
    if app.state.db:
        conditions: list[str] = []
        params: list = []

        if category:
            params.append(category)
            conditions.append(f"category = ${len(params)}")
        if zone:
            params.append(zone)
            conditions.append(f"zone = ${len(params)}")
        if handle:
            params.append(handle)
            conditions.append(f"handle = ${len(params)}")
        if q:
            params.append(f"%{q}%")
            conditions.append(f"content ILIKE ${len(params)}")
        if since:
            params.append(since)
            conditions.append(f"time >= ${len(params)}")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(min(limit, 200))
        rows = await app.state.db.fetch(
            f"SELECT * FROM social_posts {where} ORDER BY time DESC LIMIT ${len(params)}",
            *params,
        )
        return [dict(r) for r in rows]

    # Fallback Redis
    redis = app.state.redis
    entries = await redis.xrevrange("stream:social", count=min(limit, 200))
    return [json.loads(msg["data"]) for _, msg in entries]


@app.get("/social/accounts")
async def get_social_accounts(_user: str = Depends(get_current_user)):
    """Lista de cuentas monitorizadas con sus metadatos desde social_accounts.yaml."""
    import yaml as _yaml
    config_path = "/app/config/social_accounts.yaml"
    try:
        with open(config_path) as f:
            cfg = _yaml.safe_load(f)
        return cfg.get("accounts", [])
    except Exception as e:
        log.warning(f"Error leyendo social_accounts.yaml: {e}")
        return []
```

- [ ] **Step 3: Probar los endpoints con curl (con el stack levantado)**

```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -d "username=carlos&password=12345" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Feed vacío (sin ingestor corriendo aún)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/social/feed?limit=5" | python3 -m json.tool

# Lista de cuentas
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/social/accounts" | python3 -c "
import sys, json
accounts = json.load(sys.stdin)
print(f'Total: {len(accounts)} cuentas')
"
```
Esperado: `/social/feed` devuelve `[]`, `/social/accounts` devuelve lista de 104 cuentas.

- [ ] **Step 4: Commit**

```bash
git add services/api/main.py services/api/requirements.txt
git commit -m "feat(api): endpoints GET /social/feed y /social/accounts"
```

---

## Task 5: Infraestructura — Docker Compose y variables de entorno

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Añadir servicio `ingestor-social` a `docker-compose.yml`**

Añadir después del bloque `ingestor-adsb` (antes del comentario de ingestor-ais):

```yaml
  ingestor-social:
    build: ./services/ingestor_social
    container_name: qilin_ingestor_social
    restart: unless-stopped
    environment:
      REDIS_URL: redis://redis:6379
      DB_URL: postgresql://${DB_USER:-qilin}:${DB_PASSWORD:-changeme}@timescaledb:5432/qilin
      X_BEARER_TOKEN: ${X_BEARER_TOKEN:-}
      SOCIAL_POLL_INTERVAL: ${SOCIAL_POLL_INTERVAL:-900}
    volumes:
      - ./config:/app/config
    depends_on:
      - redis
      - timescaledb
```

- [ ] **Step 2: Añadir variables a `.env.example`**

Añadir al final de `.env.example`:

```bash
# --- X (Twitter) API v2 Basic ---
# Obtener en https://developer.x.com → Projects & Apps → Keys and tokens
# Necesitas una app con Basic tier ($100/mes) para búsqueda de tweets
X_BEARER_TOKEN=

# Intervalo de polling para tweets (segundos, default 900 = 15 min)
SOCIAL_POLL_INTERVAL=900
```

- [ ] **Step 3: Verificar que el servicio construye correctamente**

```bash
docker compose build ingestor-social
```
Esperado: `Successfully built` sin errores.

- [ ] **Step 4: Arrancar y verificar logs (sin token real — debe salir con error limpio)**

```bash
docker compose up ingestor-social --no-deps 2>&1 | head -20
```
Esperado: línea `[SOCIAL] X_BEARER_TOKEN no configurado — saliendo.`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat(infra): servicio ingestor-social en Docker Compose"
```

---

## Task 6: Hook React `useSocialFeed`

**Files:**
- Create: `frontend/src/hooks/useSocialFeed.js`

- [ ] **Step 1: Crear el hook**

```javascript
import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function authHeaders() {
  const token = sessionStorage.getItem('qilin_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function useSocialFeed() {
  const [posts,      setPosts]      = useState([])
  const [accounts,   setAccounts]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawPosts, rawAccounts] = await Promise.all([
          apiFetch('/social/feed?limit=100'),
          apiFetch('/social/accounts'),
        ])
        if (cancelled) return
        setPosts(rawPosts   || [])
        setAccounts(rawAccounts || [])
        setLastUpdate(new Date())
      } catch (err) {
        console.warn('[useSocialFeed] fetch failed:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)  // actualizar cada 60s
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Valores derivados para el UI de filtros
  const categories = [...new Set(accounts.map(a => a.category))].sort()
  const zones      = [...new Set(accounts.map(a => a.zone))].sort()

  return { posts, accounts, categories, zones, loading, lastUpdate }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useSocialFeed.js
git commit -m "feat(frontend): hook useSocialFeed con polling 60s"
```

---

## Task 7: SocialPage — datos reales

**Files:**
- Modify: `frontend/src/pages/SocialPage.jsx`

- [ ] **Step 1: Reescribir `SocialPage.jsx` usando datos reales**

Reemplazar el contenido completo de `frontend/src/pages/SocialPage.jsx`:

```jsx
import { useState, useMemo } from 'react'
import { useSocialFeed } from '../hooks/useSocialFeed'

// Etiquetas legibles por categoría
const CAT_LABELS = {
  us_gov:         'US Gov',
  us_mil:         'US Mil',
  europe:         'Europa',
  nato_eu:        'OTAN/EU',
  russia:         'Rusia',
  ukraine:        'Ucrania',
  middle_east:    'Oriente Medio',
  middle_east_mil:'OM Mil',
  asia_pacific:   'Asia-Pac',
  china_state:    'China',
  latam:          'LATAM',
  intl_org:       'Org. Intl',
  think_tank:     'Think Tanks',
  media:          'Medios',
}

// Color de acento por categoría
const CAT_COLOR = {
  us_gov:         '#00c8ff',
  us_mil:         '#4fc3f7',
  europe:         '#81d4fa',
  nato_eu:        '#29b6f6',
  russia:         '#ef5350',
  ukraine:        '#ffca28',
  middle_east:    '#ff7043',
  middle_east_mil:'#ff3b4a',
  asia_pacific:   '#66bb6a',
  china_state:    '#ef5350',
  latam:          '#ab47bc',
  intl_org:       '#26c6da',
  think_tank:     '#00e5a0',
  media:          '#bdbdbd',
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60)   return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function MediaBlock({ url, type, tweetUrl }) {
  if (!url) return null
  if (type === 'photo') {
    return (
      <img
        src={url}
        alt=""
        style={{
          width: '100%', maxHeight: '200px', objectFit: 'cover',
          borderRadius: '2px', display: 'block', marginBottom: '8px', opacity: 0.9,
        }}
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    )
  }
  // video o animated_gif — thumbnail + enlace
  return (
    <a href={tweetUrl} target="_blank" rel="noopener noreferrer"
      style={{ display: 'block', position: 'relative', marginBottom: '8px' }}>
      <img
        src={url} alt=""
        style={{
          width: '100%', maxHeight: '160px', objectFit: 'cover',
          borderRadius: '2px', display: 'block', opacity: 0.75,
        }}
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: '28px', background: 'rgba(0,0,0,0.55)',
          borderRadius: '50%', width: '48px', height: '48px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>▶</span>
      </div>
    </a>
  )
}

function TweetCard({ post }) {
  const color = CAT_COLOR[post.category] || '#888'
  return (
    <div
      style={{
        padding: '11px 14px',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: '3px',
        marginBottom: '6px',
        transition: 'border-color .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,200,255,0.2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: '8px', fontWeight: '700',
          color, background: `${color}18`, border: `1px solid ${color}44`,
          padding: '1px 6px', borderRadius: '2px', letterSpacing: '.08em', flexShrink: 0,
        }}>
          {CAT_LABELS[post.category] || post.category}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--cyan)', letterSpacing: '.04em' }}>
          @{post.handle}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', marginLeft: 'auto', flexShrink: 0 }}>
          {timeAgo(post.time)}
        </span>
      </div>

      {/* Nombre display */}
      <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>
        {post.display}
      </div>

      {/* Media */}
      <MediaBlock url={post.media_url} type={post.media_type} tweetUrl={post.url} />

      {/* Texto */}
      <div style={{ fontSize: '11px', color: 'var(--txt-1)', lineHeight: 1.6, marginBottom: '8px', wordBreak: 'break-word' }}>
        {post.content}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
          ❤ {(post.likes || 0).toLocaleString()}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
          🔁 {(post.retweets || 0).toLocaleString()}
        </span>
        <a
          href={post.url} target="_blank" rel="noopener noreferrer"
          style={{
            marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '9px',
            color: 'var(--cyan)', textDecoration: 'none', letterSpacing: '.06em',
          }}
        >
          Ver en X ↗
        </a>
      </div>
    </div>
  )
}

export default function SocialPage() {
  const { posts, categories, zones, loading, lastUpdate } = useSocialFeed()

  const [catFilter,  setCatFilter]  = useState('TODAS')
  const [zoneFilter, setZoneFilter] = useState('TODAS')
  const [query,      setQuery]      = useState('')

  const filtered = useMemo(() => posts.filter(p => {
    if (catFilter  !== 'TODAS' && p.category !== catFilter)                       return false
    if (zoneFilter !== 'TODAS' && p.zone     !== zoneFilter)                      return false
    if (query && !p.content?.toLowerCase().includes(query.toLowerCase()))         return false
    return true
  }), [posts, catFilter, zoneFilter, query])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {/* Status bar */}
      <div style={{
        background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>
          SOCIAL INTELLIGENCE · X/TWITTER
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', marginLeft: 'auto' }}>
          {loading ? 'Cargando…' : `${posts.length} tweets · actualizado ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`}
        </span>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar filtros */}
        <aside style={{
          width: '160px', flexShrink: 0,
          background: 'var(--bg-1)', borderRight: '1px solid var(--border-md)',
          padding: '12px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>

          {/* Búsqueda */}
          <div>
            <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
              BUSCAR
            </div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="palabra clave…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: '2px', color: 'var(--txt-1)',
                fontFamily: 'var(--mono)', fontSize: '9px',
                padding: '5px 7px', outline: 'none',
              }}
            />
          </div>

          {/* Categoría */}
          <div>
            <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
              CATEGORÍA
            </div>
            {['TODAS', ...categories].map(c => (
              <button key={c} onClick={() => setCatFilter(c)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: catFilter === c ? 'rgba(0,200,255,0.08)' : 'none',
                border: 'none',
                borderLeft: `2px solid ${catFilter === c ? 'var(--cyan)' : 'transparent'}`,
                color: catFilter === c ? 'var(--cyan)' : 'var(--txt-3)',
                fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '.06em',
                padding: '4px 8px', cursor: 'pointer', transition: 'all .15s',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c === 'TODAS' ? 'TODAS' : (CAT_LABELS[c] || c)}
              </button>
            ))}
          </div>

          {/* Zona */}
          <div>
            <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
              ZONA
            </div>
            {['TODAS', ...zones].map(z => (
              <button key={z} onClick={() => setZoneFilter(z)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: zoneFilter === z ? 'rgba(0,200,255,0.08)' : 'none',
                border: 'none',
                borderLeft: `2px solid ${zoneFilter === z ? 'var(--cyan)' : 'transparent'}`,
                color: zoneFilter === z ? 'var(--cyan)' : 'var(--txt-3)',
                fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '.06em',
                padding: '4px 8px', cursor: 'pointer', transition: 'all .15s',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase',
              }}>
                {z.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </aside>

        {/* Feed principal */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)' }}>
              Cargando feed…
            </div>
          )}
          {!loading && (
            <>
              <div style={{ marginBottom: '10px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt-3)' }}>
                {filtered.length} publicaciones
                {filtered.length === 0 && posts.length === 0 && (
                  <span style={{ marginLeft: '12px', color: 'rgba(0,200,255,0.4)' }}>
                    · Ingestor social no activo o sin tweets aún
                  </span>
                )}
              </div>
              {filtered.map(post => <TweetCard key={post.tweet_id} post={post} />)}
              {filtered.length === 0 && posts.length > 0 && (
                <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)' }}>
                  Sin resultados para los filtros actuales
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Arrancar el frontend y verificar la SocialPage**

```bash
cd frontend
npm run dev
```

Abrir `http://localhost:3000` → navegar a la vista Social.

Verificar:
- Status bar muestra "Cargando…" y luego "0 tweets · actualizado HH:MM:SS"
- Sidebar muestra filtros de Categoría y Zona vacíos (o con datos de la API)
- No hay errores en la consola del navegador relacionados con el import de `mockSocial`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/SocialPage.jsx
git commit -m "feat(frontend): SocialPage con datos reales de X via useSocialFeed"
```

---

## Task 8: Verificación end-to-end

- [ ] **Step 1: Configurar `X_BEARER_TOKEN` en `.env`**

Añadir el bearer token real a `.env`:
```
X_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 2: Levantar el stack completo**

```bash
docker compose up --build redis timescaledb api ingestor-social
```

- [ ] **Step 3: Verificar logs del ingestor**

```bash
docker logs qilin_ingestor_social -f
```
Esperado en los primeros 2 minutos:
```
[SOCIAL] Qilin Social ingestor (X/Twitter) arrancando...
[SOCIAL] Cargadas 104 cuentas desde social_accounts.yaml
[SOCIAL] Resolviendo user IDs de X...
[SOCIAL] Resueltos XX/104 user IDs
[SOCIAL] Ciclo completo — XX tweets nuevos de 104 cuentas
```

- [ ] **Step 4: Verificar tweets en TimescaleDB**

```bash
docker exec qilin_db psql -U qilin -d qilin -c \
  "SELECT handle, category, LEFT(content, 60) AS preview, time FROM social_posts ORDER BY time DESC LIMIT 10;"
```
Esperado: filas con tweets reales.

- [ ] **Step 5: Verificar endpoint `/social/feed`**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -d "username=carlos&password=12345" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/social/feed?limit=5" | python3 -m json.tool
```
Esperado: array con 5 tweets con campos `tweet_id`, `handle`, `content`, `media_url`, etc.

- [ ] **Step 6: Verificar SocialPage en el navegador**

Abrir `http://localhost:3000` → Social.
- Feed muestra tweets con texto, imágenes (si las hay), likes/retweets
- Filtros de categoría y zona funcionan
- Búsqueda por texto funciona
- "Ver en X ↗" abre el tweet correcto

- [ ] **Step 7: Commit final**

```bash
git add .
git commit -m "feat(social): integración completa X/Twitter — ingestor + API + SocialPage"
```
