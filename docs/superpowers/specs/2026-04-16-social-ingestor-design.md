# Qilin — Social Ingestor (X/Twitter) — Design Spec
**Date:** 2026-04-16  
**Status:** Approved  
**Scope:** Ingestor de tweets de cuentas oficiales + visualización en SocialPage

---

## 1. Objetivo

Monitorizar ~105 cuentas de X (Twitter) de relevancia geopolítica (líderes, gobiernos, fuerzas armadas, think tanks, medios) y mostrar sus tweets en tiempo real en la `SocialPage` del dashboard Qilin. La arquitectura queda preparada para que el alert engine pueda consumir `stream:social` en el futuro y cruzar tweets con datos de aeronaves/buques.

---

## 2. Arquitectura

```
config/social_accounts.yaml
        │
        ▼
ingestor_social (Python asyncio — nuevo servicio Docker)
  ├── Carga cuentas al arrancar desde YAML
  ├── Resuelve handles → user IDs (GET /2/users/by, grupos de 100)
  ├── Cada 15 min: polling GET /2/users/:id/tweets por cada cuenta
  ├── Deduplicación por tweet_id en Redis (TTL 24h)
  ├── Publica tweets nuevos en:
  │     stream:social        (Redis Stream, maxlen=2000)
  │     current:tweet:{id}   (Redis key, TTL 24h)
  └── Persiste en TimescaleDB → tabla social_posts
        │
        ▼
     Redis + TimescaleDB
        │
        ▼
  API FastAPI — nuevos endpoints /social/*
        │
        ▼
  React SocialPage
  ├── Polling /social/feed cada 60s
  ├── Filtros: categoría, zona, cuenta, texto libre
  └── Feed de cards con imagen/vídeo/gif inline
```

---

## 3. Configuración de cuentas

Fichero: `config/social_accounts.yaml`

```yaml
accounts:
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

  # ... resto de cuentas
```

**Campos por cuenta:**
| Campo | Descripción |
|-------|-------------|
| `handle` | Username de X sin @ |
| `display` | Nombre legible para el UI |
| `category` | Categoría temática (ver listado) |
| `zone` | Zona geopolítica de `zones.yaml` (para alertas futuras) |
| `priority` | `high` / `medium` — para ordenación en el feed |

**Categorías definidas:**
- `us_gov` — Ejecutivo y agencias USA
- `us_mil` — Mandos militares USA
- `europe` — Líderes europeos
- `nato_eu` — OTAN e instituciones EU
- `russia` — Gobierno y medios rusos
- `ukraine` — Gobierno ucraniano
- `middle_east` — Líderes y gobiernos Oriente Medio
- `middle_east_mil` — Fuerzas armadas OM
- `asia_pacific` — Asia-Pacífico
- `china_state` — Medios estado chino
- `latam` — Latinoamérica
- `intl_org` — Organizaciones internacionales
- `think_tank` — Think tanks y analistas OSINT
- `media` — Medios geopolíticos

---

## 4. Listado de cuentas (105)

### US Gov / Ejecutivo (10)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| realDonaldTrump | Donald Trump | us_gov | north_america |
| POTUS | Presidente USA | us_gov | north_america |
| WhiteHouse | Casa Blanca | us_gov | north_america |
| VP | Vicepresidente USA | us_gov | north_america |
| StateDept | Depto. de Estado | us_gov | north_america |
| SecRubio | Marco Rubio (Sec. Estado) | us_gov | north_america |
| SecDef | Secretario de Defensa | us_gov | north_america |
| NSC_Press | Consejo Seg. Nacional | us_gov | north_america |
| PressSec | Portavoz Casa Blanca | us_gov | north_america |
| JointChiefs | Jefes del Estado Mayor | us_mil | north_america |

### US Agencias / Mandos (7)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| DeptofDefense | Pentágono | us_mil | north_america |
| CIA | CIA | us_gov | north_america |
| FBI | FBI | us_gov | north_america |
| CISAgov | CISA | us_gov | north_america |
| NSAGov | NSA | us_gov | north_america |
| CENTCOM | CENTCOM | us_mil | iran |
| INDOPACOM | INDOPACOM | us_mil | south_china_sea |

### Europa — Líderes (12)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| EmmanuelMacron | Emmanuel Macron | europe | europe |
| OlafScholz | Olaf Scholz | europe | europe |
| Keir_Starmer | Keir Starmer | europe | europe |
| MeloniGiorgia | Giorgia Meloni | europe | europe |
| sanchezcastejon | Pedro Sánchez | europe | europe |
| vonderleyen | Ursula von der Leyen | nato_eu | europe |
| CharlesMichel | Charles Michel | nato_eu | europe |
| JosepBorrellF | Josep Borrell | nato_eu | europe |
| MarkRutte | Mark Rutte (OTAN) | nato_eu | europe |
| kajakallas | Kaja Kallas | nato_eu | europe |
| AndrzejDuda | Andrzej Duda | europe | europe |
| ZelenskyyUa | Volodymyr Zelensky | ukraine | ukraine_black_sea |

### OTAN / EU Instituciones (5)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| NATO | OTAN | nato_eu | europe |
| EU_Commission | Comisión Europea | nato_eu | europe |
| Europarl_EN | Parlamento Europeo | nato_eu | europe |
| EUCouncil | Consejo EU | nato_eu | europe |
| EU_EEAS | Servicio Exterior EU | nato_eu | europe |

### Rusia / Ucrania (9)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| KremlinRussia_E | Kremlin (EN) | russia | ukraine_black_sea |
| mfa_russia | MFA Rusia | russia | ukraine_black_sea |
| mod_russia | MoD Rusia | russia | ukraine_black_sea |
| Medvedev | Dmitry Medvedev | russia | ukraine_black_sea |
| Ukraine | Gobierno Ucrania | ukraine | ukraine_black_sea |
| DefenceU | MoD Ucrania | ukraine | ukraine_black_sea |
| GeneralStaffUA | Estado Mayor Ucrania | ukraine | ukraine_black_sea |
| MFA_Ukraine | MFA Ucrania | ukraine | ukraine_black_sea |
| Podolyak_M | Mykhailo Podolyak | ukraine | ukraine_black_sea |

### Oriente Medio (12)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| netanyahu | Benjamin Netanyahu | middle_east | levante |
| IsraeliPM | PM Israel (oficial) | middle_east | levante |
| IDF | Israel Defense Forces | middle_east_mil | levante |
| khamenei_ir | Ayatolá Jamenei | middle_east | iran |
| Iran_UN | Misión Irán en ONU | middle_east | iran |
| KSAMOFA | MFA Arabia Saudí | middle_east | gulf_ormuz |
| RTErdogan | Recep Tayyip Erdoğan | middle_east | south_caucasus |
| MFA_Turkey | MFA Turquía | middle_east | south_caucasus |
| QatarMFA | MFA Qatar | middle_east | gulf_ormuz |
| UAEGov | Gobierno EAU | middle_east | gulf_ormuz |
| MFA_Egypt | MFA Egipto | middle_east | libya |
| LebanonMFA | MFA Líbano | middle_east | levante |

### Asia-Pacífico (10)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| narendramodi | Narendra Modi | asia_pacific | india_pakistan |
| MEAIndia | MFA India | asia_pacific | india_pakistan |
| MFAChina | MFA China | asia_pacific | china |
| SpokespersonCHN | Portavoz MFA China | asia_pacific | china |
| XHNews | Xinhua | china_state | china |
| MFA_Japan | MFA Japón | asia_pacific | korea |
| JPN_PMO | PM Japón | asia_pacific | korea |
| AusDeptDefence | Defensa Australia | asia_pacific | south_china_sea |
| MFASingapore | MFA Singapur | asia_pacific | south_china_sea |
| KoreaMFA | MFA Corea del Sur | asia_pacific | korea |

### China Estado (5)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| PDChina | People's Daily | china_state | china |
| CGTNOfficial | CGTN | china_state | china |
| ChinaDaily | China Daily | china_state | china |
| HuXijin_GT | Hu Xijin (ex Global Times) | china_state | china |
| globaltimesnews | Global Times | china_state | china |

### Latinoamérica (6)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| lulaoficial | Lula da Silva | latam | venezuela |
| JMilei | Javier Milei | latam | venezuela |
| NicolasMaduro | Nicolás Maduro | latam | venezuela |
| Claudiashein | Claudia Sheinbaum | latam | north_america |
| petrogustavo | Gustavo Petro | latam | venezuela |
| LuisArce_Bo | Luis Arce | latam | venezuela |

### Organismos Internacionales (8)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| UN | Naciones Unidas | intl_org | europe |
| IAEA | AIEA | intl_org | iran |
| WHO | OMS | intl_org | europe |
| IMFNews | FMI | intl_org | europe |
| WFP | Prog. Mundial Alimentos | intl_org | sahel |
| UNHCR | Alto Com. Refugiados | intl_org | europe |
| _AfricanUnion | Unión Africana | intl_org | sahel |
| OPCW | Org. Armas Químicas | intl_org | europe |

### Think Tanks / OSINT (10)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| ISWonline | Inst. Study of War | think_tank | ukraine_black_sea |
| AtlanticCouncil | Atlantic Council | think_tank | europe |
| IISS_org | IISS | think_tank | europe |
| CFR_org | Council on Foreign Relations | think_tank | north_america |
| RANDCorporation | RAND Corporation | think_tank | north_america |
| bellingcat | Bellingcat | think_tank | europe |
| EliotHiggins | Eliot Higgins (Bellingcat) | think_tank | europe |
| IanBremmer | Ian Bremmer (Eurasia Group) | think_tank | north_america |
| OSINTdefender | OSINT Defender | think_tank | ukraine_black_sea |
| CovertShores | Covert Shores (análisis naval) | think_tank | south_china_sea |

### Medios Geopolíticos (10)
| Handle | Display | Category | Zone |
|--------|---------|----------|------|
| Reuters | Reuters | media | europe |
| AP | Associated Press | media | north_america |
| BBCWorld | BBC World | media | europe |
| AlJazeera | Al Jazeera | media | middle_east |
| AFP | AFP | media | europe |
| ForeignPolicy | Foreign Policy | media | north_america |
| TheEconomist | The Economist | media | europe |
| MiddleEastEye | Middle East Eye | media | levante |
| defense_one | Defense One | media | north_america |
| EURACTIV | Euractiv | media | europe |

---

## 5. Modelo de datos

### TimescaleDB — `social_posts`
```sql
CREATE TABLE social_posts (
    time        TIMESTAMPTZ NOT NULL,
    tweet_id    TEXT        NOT NULL UNIQUE,
    handle      TEXT        NOT NULL,
    display     TEXT,
    category    TEXT,
    zone        TEXT,
    content     TEXT,
    lang        TEXT,
    likes       INT         DEFAULT 0,
    retweets    INT         DEFAULT 0,
    url         TEXT,
    media_url   TEXT,
    media_type  TEXT        -- 'photo' | 'video' | 'animated_gif' | NULL
);
SELECT create_hypertable('social_posts', 'time');
CREATE INDEX ON social_posts (handle, time DESC);
CREATE INDEX ON social_posts (category, time DESC);
CREATE INDEX ON social_posts (zone, time DESC);
```

### Redis
```
stream:social              # Redis Stream, maxlen=2000
current:tweet:{tweet_id}   # TTL 24h — deduplicación
```

### Payload en stream:social
```json
{
  "tweet_id":   "1234567890",
  "handle":     "IDF",
  "display":    "Israel Defense Forces",
  "category":   "middle_east_mil",
  "zone":       "levante",
  "content":    "IDF forces operating in...",
  "lang":       "en",
  "likes":      1420,
  "retweets":   380,
  "url":        "https://x.com/IDF/status/1234567890",
  "media_url":  "https://pbs.twimg.com/media/...",
  "media_type": "photo",
  "time":       "2026-04-16T08:32:00Z"
}
```

---

## 6. Ingestor — comportamiento

### Arranque
1. Carga `config/social_accounts.yaml`
2. Resuelve handles → user IDs via `GET /2/users/by?usernames=...` (grupos de 100)
3. Cachea el mapa `handle → user_id` en memoria

### Ciclo de polling (cada 15 min)
Para cada cuenta:
1. `GET /2/users/{id}/tweets?max_results=10&tweet.fields=created_at,public_metrics,lang,attachments&expansions=attachments.media_keys&media.fields=url,preview_image_url,type`
2. Por cada tweet:
   - Comprueba `current:tweet:{tweet_id}` en Redis — si existe, skip
   - Parsea campos, extrae media si hay
   - Publica en `stream:social`
   - Guarda en `social_posts` (TimescaleDB)
   - Setea `current:tweet:{tweet_id}` con TTL 24h

### Rate limiting
- Pausa de 1s entre cuentas para no saturar
- Retry con backoff exponencial en 429
- Las cuentas se procesan en orden de `priority: high` primero

---

## 7. API — nuevos endpoints

```
GET /social/feed
    ?limit=50          (default 50, max 200)
    ?category=us_gov
    ?zone=levante
    ?handle=IDF
    ?q=nuclear         (búsqueda en content, case-insensitive)
    ?since=ISO8601     (para histórico)
```

Lee de TimescaleDB. Si DB no disponible, lee últimas entradas del `stream:social` en Redis como fallback.

```
GET /social/accounts
```
Devuelve la lista de cuentas configuradas con sus metadatos (útil para el UI de filtros).

---

## 8. Frontend — SocialPage

### Layout
```
┌──────────────────────────────────────────────────────────┐
│ [Todas] [US Gov] [Rusia] [OTAN] [Oriente Medio] [OSINT] │ ← tabs categoría
│ [🔍 buscar...] [zona ▼] [cuenta ▼]                       │ ← filtros
├──────────────────────────────────────────────────────────┤
│ @IDF · Israel Defense Forces              hace 3 min      │
│ IDF forces conducted strikes on northern Gaza...          │
│ ┌────────────────────────────────────────────┐           │
│ │  [imagen si media_type=photo]              │           │
│ │  [thumbnail + ▶ si media_type=video/gif]  │           │
│ └────────────────────────────────────────────┘           │
│ ❤ 1.4k  🔁 380  · 🌐 Ver en X                            │
├──────────────────────────────────────────────────────────┤
│ @KremlinRussia_E · Kremlin                hace 7 min      │
│ President Putin held a call with...                       │
│ ❤ 892   🔁 210  · 🌐 Ver en X                            │
└──────────────────────────────────────────────────────────┘
```

### Comportamiento
- Polling a `/social/feed` cada 60s
- Tweets nuevos aparecen en la parte superior con animación suave
- Vídeos: thumbnail + enlace a X (no se embebe el MP4 directamente)
- Estilo coherente: fondo oscuro, `IBM Plex Mono`, acentos `#00c8ff`
- Sin librerías nuevas

---

## 9. Variables de entorno (añadir a .env.example)

```
X_BEARER_TOKEN=          # Bearer token de la X API v2 Basic
SOCIAL_POLL_INTERVAL=900 # segundos (15 min)
```

---

## 10. Docker Compose — nuevo servicio

```yaml
ingestor-social:
  build: ./services/ingestor_social
  restart: unless-stopped
  env_file: .env
  volumes:
    - ./config:/app/config
  depends_on:
    - redis
    - timescaledb
```

---

## 11. Preparación para alertas (futuro)

El alert engine ya consume `stream:adsb` y `stream:ais`. Para añadir `stream:social`:
1. Añadir `"stream:social": "$"` a `last_ids` en `alert_engine/main.py`
2. Crear `rule_social_keyword(zone, tweets)` — detecta keywords críticos en tweets de cuentas `priority: high` de una zona con actividad aérea/naval simultánea
3. No requiere cambios en la arquitectura

---

## 12. Archivos a crear / modificar

| Acción | Archivo |
|--------|---------|
| Crear | `services/ingestor_social/main.py` |
| Crear | `services/ingestor_social/Dockerfile` |
| Crear | `services/ingestor_social/requirements.txt` |
| Crear | `config/social_accounts.yaml` |
| Modificar | `services/api/main.py` — endpoints `/social/*` |
| Modificar | `db/init.sql` — tabla `social_posts` |
| Modificar | `docker-compose.yml` — nuevo servicio |
| Modificar | `frontend/src/App.jsx` — activar SocialPage |
| Modificar | `frontend/src/pages/SocialPage.jsx` — actualmente stub vacío |
| Modificar | `.env.example` — `X_BEARER_TOKEN`, `SOCIAL_POLL_INTERVAL` |
