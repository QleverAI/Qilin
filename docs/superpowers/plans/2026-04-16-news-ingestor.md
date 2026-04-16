# News Ingestor (RSS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingestar artículos de 104 fuentes geopolíticas vía RSS, clasificarlos por sector y severidad con reglas de keywords, persistirlos en TimescaleDB, y mostrarlos en NewsPage con filtros por zona, país, tipo de medio y sector.

**Architecture:** El ingestor `ingestor_news` hace polling RSS con `feedparser` cada 15 min, clasifica cada artículo (sectors[], severity, relevance), deduplica por URL en Redis y persiste en `news_events`. La API FastAPI expone `/news/feed` y `/news/sources`. El hook `useNewsFeed` consume la API con polling de 60s y alimenta `NewsPage`.

**Tech Stack:** Python 3.12 asyncio + feedparser + httpx · FastAPI + asyncpg · Redis 7 Streams · TimescaleDB · React 18 + Vite

---

## File Map

| Acción | Fichero | Responsabilidad |
|--------|---------|-----------------|
| Modificar | `db/init.sql` | Añadir columnas a `news_events` + índices |
| Crear | `config/news_sources.yaml` | 104 fuentes con URL RSS, país, tipo, zona, sectores |
| Crear | `services/ingestor_news/requirements.txt` | Dependencias Python |
| Crear | `services/ingestor_news/Dockerfile` | Imagen del servicio |
| Crear | `services/ingestor_news/classifier.py` | Lógica pura: classify_sectors, classify_severity, compute_relevance |
| Crear | `services/ingestor_news/test_classifier.py` | Tests unitarios del clasificador |
| Crear | `services/ingestor_news/main.py` | Loop principal: polling RSS, dedup, publicación |
| Modificar | `services/api/main.py` | Endpoints GET /news/feed y /news/sources |
| Modificar | `docker-compose.yml` | Servicio ingestor-news |
| Modificar | `.env.example` | Variable NEWS_POLL_INTERVAL |
| Crear | `frontend/src/hooks/useNewsFeed.js` | Hook React con polling 60s |
| Modificar | `frontend/src/pages/NewsPage.jsx` | Datos reales + filtros país/tipo/sector |

---

## Task 1: Esquema de base de datos

**Files:**
- Modify: `db/init.sql`

- [ ] **Step 1: Añadir columnas a `news_events` al final del bloque de esa tabla en `db/init.sql`**

El bloque actual termina en la línea con `CREATE INDEX IF NOT EXISTS news_time_idx`. Añadir inmediatamente después:

```sql
ALTER TABLE news_events
    ADD COLUMN IF NOT EXISTS severity       TEXT    DEFAULT 'low',
    ADD COLUMN IF NOT EXISTS relevance      INT     DEFAULT 50,
    ADD COLUMN IF NOT EXISTS source_country TEXT,
    ADD COLUMN IF NOT EXISTS source_type    TEXT,
    ADD COLUMN IF NOT EXISTS sectors        TEXT[];

CREATE UNIQUE INDEX IF NOT EXISTS news_events_url_key      ON news_events (url);
CREATE INDEX        IF NOT EXISTS news_events_severity_idx ON news_events (severity, time DESC);
CREATE INDEX        IF NOT EXISTS news_events_country_idx  ON news_events (source_country, time DESC);
CREATE INDEX        IF NOT EXISTS news_events_type_idx     ON news_events (source_type, time DESC);
```

- [ ] **Step 2: Aplicar en un contenedor existente**

Si TimescaleDB ya está corriendo (init.sql solo se ejecuta en primera creación del volumen), aplicar manualmente:

```bash
docker exec -i qilin_db psql -U qilin -d qilin << 'EOF'
ALTER TABLE news_events
    ADD COLUMN IF NOT EXISTS severity       TEXT    DEFAULT 'low',
    ADD COLUMN IF NOT EXISTS relevance      INT     DEFAULT 50,
    ADD COLUMN IF NOT EXISTS source_country TEXT,
    ADD COLUMN IF NOT EXISTS source_type    TEXT,
    ADD COLUMN IF NOT EXISTS sectors        TEXT[];

CREATE UNIQUE INDEX IF NOT EXISTS news_events_url_key      ON news_events (url);
CREATE INDEX        IF NOT EXISTS news_events_severity_idx ON news_events (severity, time DESC);
CREATE INDEX        IF NOT EXISTS news_events_country_idx  ON news_events (source_country, time DESC);
CREATE INDEX        IF NOT EXISTS news_events_type_idx     ON news_events (source_type, time DESC);
EOF
```

Verificar:
```bash
docker exec qilin_db psql -U qilin -d qilin -c "\d news_events"
```
Esperado: columnas `severity`, `relevance`, `source_country`, `source_type`, `sectors` presentes.

- [ ] **Step 3: Commit**

```bash
git add db/init.sql
git commit -m "feat(db): añadir severity, relevance, source_country, source_type, sectors a news_events"
```

---

## Task 2: Configuración de fuentes RSS

**Files:**
- Create: `config/news_sources.yaml`

- [ ] **Step 1: Crear `config/news_sources.yaml` con las 104 fuentes**

```yaml
# Qilin — Fuentes RSS de noticias geopolíticas
# Campos: slug, name, rss_url, country, type, zone, sectors, priority

sources:

  # ── AGENCIAS WIRE ─────────────────────────────────────────────────────────────
  - slug: reuters_world
    name: "Reuters World"
    rss_url: "https://feeds.reuters.com/reuters/worldNews"
    country: UK
    type: agency
    zone: global
    sectors: [militar, diplomacia, economia, energia, crisis_humanitaria, nuclear]
    priority: high

  - slug: ap_world
    name: "Associated Press"
    rss_url: "https://feeds.apnews.com/apnews/topnews"
    country: US
    type: agency
    zone: global
    sectors: [militar, diplomacia, economia, energia, crisis_humanitaria, nuclear]
    priority: high

  - slug: afp_world
    name: "AFP"
    rss_url: "https://www.afpbb.com/rss/afpbb-gaishin.xml"
    country: FR
    type: agency
    zone: global
    sectors: [militar, diplomacia, economia, crisis_humanitaria]
    priority: high

  - slug: dpa_world
    name: "DPA International"
    rss_url: "https://www.dpa-international.com/rss/rss.xml"
    country: DE
    type: agency
    zone: europe
    sectors: [militar, diplomacia, economia]
    priority: medium

  - slug: efe_world
    name: "EFE"
    rss_url: "https://www.efe.com/efe/english/mundo/rss/2"
    country: ES
    type: agency
    zone: europe
    sectors: [militar, diplomacia, economia]
    priority: medium

  - slug: tass_world
    name: "TASS"
    rss_url: "https://tass.com/rss/v2.xml"
    country: RU
    type: agency
    zone: ukraine_black_sea
    sectors: [militar, diplomacia]
    priority: medium

  - slug: xinhua_world
    name: "Xinhua"
    rss_url: "https://www.xinhuanet.com/english/rss/worldrss.xml"
    country: CN
    type: agency
    zone: china
    sectors: [militar, diplomacia, economia]
    priority: medium

  - slug: kyodo_world
    name: "Kyodo News"
    rss_url: "https://english.kyodonews.net/rss/world.xml"
    country: JP
    type: agency
    zone: korea
    sectors: [militar, diplomacia, economia]
    priority: medium

  - slug: yonhap_world
    name: "Yonhap News"
    rss_url: "https://en.yna.co.kr/RSS/index.jsp"
    country: KR
    type: agency
    zone: korea
    sectors: [militar, diplomacia]
    priority: medium

  # ── MEDIOS INTERNACIONALES ────────────────────────────────────────────────────
  - slug: bbc_world
    name: "BBC World"
    rss_url: "http://feeds.bbci.co.uk/news/world/rss.xml"
    country: UK
    type: newspaper
    zone: europe
    sectors: [militar, diplomacia, economia, crisis_humanitaria]
    priority: high

  - slug: aljazeera_world
    name: "Al Jazeera English"
    rss_url: "https://www.aljazeera.com/xml/rss/all.xml"
    country: QA
    type: newspaper
    zone: levante
    sectors: [militar, diplomacia, crisis_humanitaria]
    priority: high

  - slug: france24_world
    name: "France 24 EN"
    rss_url: "https://www.france24.com/en/rss"
    country: FR
    type: newspaper
    zone: europe
    sectors: [militar, diplomacia, economia]
    priority: high

  - slug: dw_world
    name: "Deutsche Welle"
    rss_url: "https://rss.dw.com/xml/rss-en-world"
    country: DE
    type: newspaper
    zone: europe
    sectors: [militar, diplomacia, economia]
    priority: medium

  - slug: euronews_world
    name: "Euronews"
    rss_url: "https://www.euronews.com/rss?format=mrss&level=theme&name=news"
    country: EU
    type: newspaper
    zone: europe
    sectors: [militar, diplomacia, economia]
    priority: medium

  - slug: rt_world
    name: "RT EN"
    rss_url: "https://www.rt.com/rss/news/"
    country: RU
    type: newspaper
    zone: ukraine_black_sea
    sectors: [diplomacia, militar]
    priority: medium

  - slug: cgtn_world
    name: "CGTN"
    rss_url: "https://www.cgtn.com/subscribe/rss/section/world.xml"
    country: CN
    type: newspaper
    zone: china
    sectors: [diplomacia]
    priority: medium

  - slug: nhk_world
    name: "NHK World"
    rss_url: "https://www3.nhk.or.jp/rss/news/cat0.xml"
    country: JP
    type: newspaper
    zone: korea
    sectors: [militar, diplomacia]
    priority: medium

  # ── DEFENSA Y MILITAR ─────────────────────────────────────────────────────────
  - slug: defense_news
    name: "Defense News"
    rss_url: "https://www.defensenews.com/arc/outboundfeeds/rss/"
    country: US
    type: defense_media
    zone: global
    sectors: [militar]
    priority: high

  - slug: defense_one
    name: "Defense One"
    rss_url: "https://www.defenseone.com/rss/all/"
    country: US
    type: defense_media
    zone: global
    sectors: [militar]
    priority: high

  - slug: the_war_zone
    name: "The War Zone"
    rss_url: "https://www.thedrive.com/the-war-zone/rss"
    country: US
    type: defense_media
    zone: global
    sectors: [militar]
    priority: high

  - slug: breaking_defense
    name: "Breaking Defense"
    rss_url: "https://breakingdefense.com/feed/"
    country: US
    type: defense_media
    zone: global
    sectors: [militar]
    priority: high

  - slug: military_times
    name: "Military Times"
    rss_url: "https://www.militarytimes.com/arc/outboundfeeds/rss/"
    country: US
    type: defense_media
    zone: north_america
    sectors: [militar]
    priority: medium

  - slug: stars_stripes
    name: "Stars and Stripes"
    rss_url: "https://www.stripes.com/arc/outboundfeeds/rss/"
    country: US
    type: defense_media
    zone: global
    sectors: [militar]
    priority: medium

  - slug: janes_feed
    name: "Jane's by S&P"
    rss_url: "https://www.janes.com/feeds/news"
    country: UK
    type: defense_media
    zone: global
    sectors: [militar]
    priority: medium

  - slug: naval_news
    name: "Naval News"
    rss_url: "https://www.navalnews.com/feed/"
    country: FR
    type: defense_media
    zone: global
    sectors: [militar]
    priority: medium

  - slug: alert5
    name: "Alert5 (Aviation)"
    rss_url: "https://alert5.com/feed/"
    country: US
    type: defense_media
    zone: global
    sectors: [militar]
    priority: medium

  # ── THINK TANKS / OSINT ───────────────────────────────────────────────────────
  - slug: isw_ukraine
    name: "Institute for the Study of War"
    rss_url: "https://www.understandingwar.org/rss.xml"
    country: US
    type: think_tank
    zone: ukraine_black_sea
    sectors: [militar]
    priority: high

  - slug: iiss_world
    name: "IISS"
    rss_url: "https://www.iiss.org/rss/latest"
    country: UK
    type: think_tank
    zone: global
    sectors: [militar, diplomacia]
    priority: high

  - slug: rand_world
    name: "RAND Corporation"
    rss_url: "https://www.rand.org/pubs/rss/rss.xml"
    country: US
    type: think_tank
    zone: global
    sectors: [militar, diplomacia, economia]
    priority: medium

  - slug: brookings_world
    name: "Brookings Institution"
    rss_url: "https://www.brookings.edu/feed/"
    country: US
    type: think_tank
    zone: global
    sectors: [diplomacia, economia]
    priority: medium

  - slug: atlantic_council
    name: "Atlantic Council"
    rss_url: "https://www.atlanticcouncil.org/feed/"
    country: US
    type: think_tank
    zone: europe
    sectors: [diplomacia]
    priority: medium

  - slug: csis_world
    name: "CSIS"
    rss_url: "https://www.csis.org/feed"
    country: US
    type: think_tank
    zone: global
    sectors: [militar, diplomacia]
    priority: medium

  - slug: cnas_world
    name: "CNAS"
    rss_url: "https://www.cnas.org/feed"
    country: US
    type: think_tank
    zone: global
    sectors: [militar]
    priority: medium

  - slug: carnegie_world
    name: "Carnegie Endowment"
    rss_url: "https://carnegieendowment.org/publications/?fa=rss"
    country: US
    type: think_tank
    zone: global
    sectors: [diplomacia, nuclear]
    priority: medium

  - slug: stimson_world
    name: "Stimson Center"
    rss_url: "https://www.stimson.org/feed/"
    country: US
    type: think_tank
    zone: global
    sectors: [nuclear]
    priority: medium

  - slug: chatham_house
    name: "Chatham House"
    rss_url: "https://www.chathamhouse.org/rss/news"
    country: UK
    type: think_tank
    zone: europe
    sectors: [diplomacia]
    priority: medium

  - slug: ecfr_world
    name: "ECFR"
    rss_url: "https://ecfr.eu/feed/"
    country: EU
    type: think_tank
    zone: europe
    sectors: [diplomacia]
    priority: medium

  - slug: bellingcat
    name: "Bellingcat"
    rss_url: "https://www.bellingcat.com/feed/"
    country: NL
    type: think_tank
    zone: ukraine_black_sea
    sectors: [militar]
    priority: high

  # ── POLÍTICA EXTERIOR / GEOPOLÍTICA ───────────────────────────────────────────
  - slug: foreign_policy
    name: "Foreign Policy"
    rss_url: "https://foreignpolicy.com/feed/"
    country: US
    type: magazine
    zone: global
    sectors: [militar, diplomacia, economia]
    priority: high

  - slug: foreign_affairs
    name: "Foreign Affairs"
    rss_url: "https://www.foreignaffairs.com/rss.xml"
    country: US
    type: magazine
    zone: global
    sectors: [militar, diplomacia]
    priority: medium

  - slug: the_diplomat
    name: "The Diplomat"
    rss_url: "https://thediplomat.com/feed/"
    country: US
    type: magazine
    zone: south_china_sea
    sectors: [militar, diplomacia]
    priority: medium

  - slug: war_on_rocks
    name: "War on the Rocks"
    rss_url: "https://warontherocks.com/feed/"
    country: US
    type: magazine
    zone: global
    sectors: [militar, diplomacia]
    priority: high

  - slug: lawfare_blog
    name: "Lawfare"
    rss_url: "https://www.lawfareblog.com/rss.xml"
    country: US
    type: magazine
    zone: global
    sectors: [diplomacia, ciberseguridad]
    priority: medium

  - slug: economist_world
    name: "The Economist"
    rss_url: "https://www.economist.com/international/rss.xml"
    country: UK
    type: magazine
    zone: global
    sectors: [diplomacia, economia]
    priority: medium

  - slug: national_interest
    name: "The National Interest"
    rss_url: "https://nationalinterest.org/rss.xml"
    country: US
    type: magazine
    zone: global
    sectors: [militar, diplomacia]
    priority: medium

  - slug: responsible_statecraft
    name: "Responsible Statecraft"
    rss_url: "https://responsiblestatecraft.org/feed/"
    country: US
    type: magazine
    zone: global
    sectors: [diplomacia]
    priority: medium

  # ── ORIENTE MEDIO ─────────────────────────────────────────────────────────────
  - slug: middle_east_eye
    name: "Middle East Eye"
    rss_url: "https://www.middleeasteye.net/rss"
    country: UK
    type: newspaper
    zone: levante
    sectors: [militar, diplomacia, crisis_humanitaria]
    priority: high

  - slug: al_monitor
    name: "Al-Monitor"
    rss_url: "https://www.al-monitor.com/rss.xml"
    country: US
    type: newspaper
    zone: levante
    sectors: [militar, diplomacia]
    priority: high

  - slug: haaretz_en
    name: "Haaretz English"
    rss_url: "https://www.haaretz.com/cmlink/1.628765"
    country: IL
    type: newspaper
    zone: levante
    sectors: [militar, diplomacia]
    priority: medium

  - slug: jerusalem_post
    name: "Jerusalem Post"
    rss_url: "https://www.jpost.com/rss/rssfeedsfrontpage.aspx"
    country: IL
    type: newspaper
    zone: levante
    sectors: [militar, diplomacia]
    priority: medium

  - slug: times_of_israel
    name: "Times of Israel"
    rss_url: "https://www.timesofisrael.com/feed/"
    country: IL
    type: newspaper
    zone: levante
    sectors: [militar, diplomacia]
    priority: medium

  - slug: arab_news
    name: "Arab News"
    rss_url: "https://www.arabnews.com/rss.xml"
    country: SA
    type: newspaper
    zone: gulf_ormuz
    sectors: [diplomacia, economia, energia]
    priority: medium

  - slug: gulf_news
    name: "Gulf News"
    rss_url: "https://gulfnews.com/rss/frontpage.xml"
    country: AE
    type: newspaper
    zone: gulf_ormuz
    sectors: [diplomacia, economia]
    priority: medium

  - slug: iran_international
    name: "Iran International"
    rss_url: "https://www.iranintl.com/en/rss"
    country: UK
    type: newspaper
    zone: iran
    sectors: [militar, diplomacia, nuclear]
    priority: high

  - slug: al_arabiya_en
    name: "Al-Arabiya English"
    rss_url: "https://english.alarabiya.net/rss.xml"
    country: SA
    type: newspaper
    zone: levante
    sectors: [militar, diplomacia]
    priority: medium

  - slug: turkish_minute
    name: "Turkish Minute"
    rss_url: "https://www.turkishminute.com/feed/"
    country: TR
    type: newspaper
    zone: south_caucasus
    sectors: [diplomacia, militar]
    priority: medium

  # ── EUROPA DEL ESTE / RUSIA / UCRANIA ─────────────────────────────────────────
  - slug: kyiv_independent
    name: "Kyiv Independent"
    rss_url: "https://kyivindependent.com/rss/"
    country: UA
    type: newspaper
    zone: ukraine_black_sea
    sectors: [militar, diplomacia, crisis_humanitaria]
    priority: high

  - slug: ukrainska_pravda_en
    name: "Ukrainska Pravda EN"
    rss_url: "https://www.pravda.com.ua/eng/rss/"
    country: UA
    type: newspaper
    zone: ukraine_black_sea
    sectors: [militar, diplomacia]
    priority: high

  - slug: meduza_en
    name: "Meduza EN"
    rss_url: "https://meduza.io/rss/news"
    country: LV
    type: newspaper
    zone: ukraine_black_sea
    sectors: [militar, diplomacia]
    priority: medium

  - slug: moscow_times
    name: "Moscow Times"
    rss_url: "https://www.themoscowtimes.com/rss/news"
    country: NL
    type: newspaper
    zone: ukraine_black_sea
    sectors: [militar, diplomacia]
    priority: medium

  - slug: rferl_world
    name: "RFE/RL"
    rss_url: "https://www.rferl.org/api/zyqmxqiymts"
    country: US
    type: newspaper
    zone: ukraine_black_sea
    sectors: [militar, diplomacia]
    priority: high

  - slug: euromaidan_press
    name: "Euromaidan Press"
    rss_url: "https://euromaidanpress.com/feed/"
    country: UA
    type: newspaper
    zone: ukraine_black_sea
    sectors: [militar]
    priority: medium

  - slug: politico_eu
    name: "Politico Europe"
    rss_url: "https://www.politico.eu/rss"
    country: EU
    type: newspaper
    zone: europe
    sectors: [diplomacia]
    priority: medium

  - slug: euobserver
    name: "EUobserver"
    rss_url: "https://euobserver.com/rss.xml"
    country: EU
    type: newspaper
    zone: europe
    sectors: [diplomacia]
    priority: medium

  # ── ASIA-PACÍFICO ─────────────────────────────────────────────────────────────
  - slug: scmp_world
    name: "South China Morning Post"
    rss_url: "https://www.scmp.com/rss/91/feed"
    country: HK
    type: newspaper
    zone: china
    sectors: [militar, diplomacia, economia]
    priority: high

  - slug: straits_times
    name: "The Straits Times"
    rss_url: "https://www.straitstimes.com/global/rss.xml"
    country: SG
    type: newspaper
    zone: south_china_sea
    sectors: [militar, diplomacia]
    priority: medium

  - slug: japan_times
    name: "Japan Times"
    rss_url: "https://www.japantimes.co.jp/news_category/world/feed/"
    country: JP
    type: newspaper
    zone: korea
    sectors: [militar, diplomacia]
    priority: medium

  - slug: korea_herald
    name: "Korea Herald"
    rss_url: "http://www.koreaherald.com/rss_3_02.xml"
    country: KR
    type: newspaper
    zone: korea
    sectors: [militar, diplomacia]
    priority: medium

  - slug: dawn_pk
    name: "Dawn (Pakistan)"
    rss_url: "https://www.dawn.com/feeds/home"
    country: PK
    type: newspaper
    zone: india_pakistan
    sectors: [militar, diplomacia]
    priority: medium

  - slug: the_hindu
    name: "The Hindu"
    rss_url: "https://www.thehindu.com/news/international/feeder/default.rss"
    country: IN
    type: newspaper
    zone: india_pakistan
    sectors: [militar, diplomacia]
    priority: medium

  - slug: ndtv_world
    name: "NDTV World"
    rss_url: "https://feeds.feedburner.com/NDTV-World-News"
    country: IN
    type: newspaper
    zone: india_pakistan
    sectors: [militar, diplomacia]
    priority: medium

  - slug: asia_times
    name: "Asia Times"
    rss_url: "https://asiatimes.com/feed/"
    country: HK
    type: newspaper
    zone: south_china_sea
    sectors: [militar, diplomacia, economia]
    priority: medium

  - slug: taiwan_news
    name: "Taiwan News"
    rss_url: "https://www.taiwannews.com.tw/en/rss"
    country: TW
    type: newspaper
    zone: china
    sectors: [militar, diplomacia]
    priority: medium

  - slug: nk_news
    name: "NK News"
    rss_url: "https://www.nknews.org/feed/"
    country: US
    type: newspaper
    zone: korea
    sectors: [militar, nuclear]
    priority: high

  - slug: 38north
    name: "38 North"
    rss_url: "https://www.38north.org/feed/"
    country: US
    type: think_tank
    zone: korea
    sectors: [nuclear, militar]
    priority: high

  # ── ÁFRICA / SAHEL ────────────────────────────────────────────────────────────
  - slug: allafrica
    name: "AllAfrica"
    rss_url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf"
    country: ZA
    type: newspaper
    zone: sahel
    sectors: [militar, crisis_humanitaria]
    priority: medium

  - slug: africa_report
    name: "The Africa Report"
    rss_url: "https://www.theafricareport.com/feed/"
    country: FR
    type: newspaper
    zone: sahel
    sectors: [militar, diplomacia]
    priority: medium

  - slug: premium_times_ng
    name: "Premium Times Nigeria"
    rss_url: "https://www.premiumtimesng.com/feed/"
    country: NG
    type: newspaper
    zone: sahel
    sectors: [militar, crisis_humanitaria]
    priority: medium

  - slug: daily_maverick
    name: "Daily Maverick"
    rss_url: "https://www.dailymaverick.co.za/feed/"
    country: ZA
    type: newspaper
    zone: sahel
    sectors: [diplomacia, economia]
    priority: medium

  # ── LATAM ─────────────────────────────────────────────────────────────────────
  - slug: mercopress
    name: "Mercopress"
    rss_url: "https://en.mercopress.com/rss"
    country: UY
    type: newspaper
    zone: venezuela
    sectors: [militar, diplomacia]
    priority: medium

  - slug: infobae_world
    name: "Infobae"
    rss_url: "https://www.infobae.com/feeds/rss/2013/04/15/politics.xml"
    country: AR
    type: newspaper
    zone: venezuela
    sectors: [diplomacia, economia]
    priority: medium

  - slug: elpais_world
    name: "El País Internacional"
    rss_url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada"
    country: ES
    type: newspaper
    zone: venezuela
    sectors: [diplomacia, economia]
    priority: medium

  - slug: insight_crime
    name: "InSight Crime"
    rss_url: "https://insightcrime.org/feed/"
    country: CO
    type: think_tank
    zone: venezuela
    sectors: [militar, crisis_humanitaria]
    priority: medium

  # ── GOBIERNO / OFICIAL ────────────────────────────────────────────────────────
  - slug: nato_newsroom
    name: "NATO Newsroom"
    rss_url: "https://www.nato.int/cps/en/natolive/news.xml"
    country: NATO
    type: government
    zone: europe
    sectors: [militar, diplomacia]
    priority: high

  - slug: eu_eeas
    name: "EU External Action"
    rss_url: "https://www.eeas.europa.eu/eeas/press-releases_en.xml"
    country: EU
    type: government
    zone: europe
    sectors: [diplomacia]
    priority: high

  - slug: us_dod_news
    name: "US Department of Defense"
    rss_url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=10"
    country: US
    type: government
    zone: global
    sectors: [militar]
    priority: high

  - slug: uk_mod
    name: "UK Ministry of Defence"
    rss_url: "https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=ministry-of-defence"
    country: UK
    type: government
    zone: europe
    sectors: [militar]
    priority: high

  - slug: iaea_news
    name: "IAEA Newscenter"
    rss_url: "https://www.iaea.org/feeds/pressreleases.xml"
    country: IAEA
    type: government
    zone: iran
    sectors: [nuclear]
    priority: high

  - slug: un_news
    name: "UN News"
    rss_url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml"
    country: UN
    type: government
    zone: global
    sectors: [diplomacia, crisis_humanitaria]
    priority: high

  - slug: ofac_actions
    name: "OFAC Recent Actions"
    rss_url: "https://home.treasury.gov/system/files/126/ofac.xml"
    country: US
    type: government
    zone: global
    sectors: [economia]
    priority: high

  # ── ECONOMÍA / SANCIONES ──────────────────────────────────────────────────────
  - slug: reuters_business
    name: "Reuters Business"
    rss_url: "https://feeds.reuters.com/reuters/businessNews"
    country: UK
    type: agency
    zone: global
    sectors: [economia]
    priority: high

  - slug: bloomberg_markets
    name: "Bloomberg Markets"
    rss_url: "https://feeds.bloomberg.com/markets/news.rss"
    country: US
    type: newspaper
    zone: global
    sectors: [economia]
    priority: medium

  - slug: ft_world
    name: "Financial Times"
    rss_url: "https://www.ft.com/?format=rss"
    country: UK
    type: newspaper
    zone: global
    sectors: [economia, diplomacia]
    priority: medium

  - slug: politico_dc
    name: "Politico DC"
    rss_url: "https://www.politico.com/rss/politicopicks.xml"
    country: US
    type: newspaper
    zone: north_america
    sectors: [diplomacia]
    priority: medium

  - slug: axios_world
    name: "Axios World"
    rss_url: "https://api.axios.com/feed/world"
    country: US
    type: newspaper
    zone: north_america
    sectors: [diplomacia, economia]
    priority: medium

  # ── CIBERSEGURIDAD ────────────────────────────────────────────────────────────
  - slug: recorded_future_news
    name: "Recorded Future News"
    rss_url: "https://therecord.media/feed"
    country: US
    type: defense_media
    zone: global
    sectors: [ciberseguridad]
    priority: high

  - slug: wired_security
    name: "Wired Security"
    rss_url: "https://www.wired.com/feed/category/security/latest/rss"
    country: US
    type: magazine
    zone: global
    sectors: [ciberseguridad]
    priority: medium

  - slug: krebs_security
    name: "Krebs on Security"
    rss_url: "https://krebsonsecurity.com/feed/"
    country: US
    type: magazine
    zone: global
    sectors: [ciberseguridad]
    priority: medium

  - slug: bleeping_computer
    name: "Bleeping Computer"
    rss_url: "https://www.bleepingcomputer.com/feed/"
    country: RO
    type: magazine
    zone: global
    sectors: [ciberseguridad]
    priority: medium

  # ── NUCLEAR / CBRN ────────────────────────────────────────────────────────────
  - slug: bulletin_atomic
    name: "Bulletin of the Atomic Scientists"
    rss_url: "https://thebulletin.org/feed/"
    country: US
    type: think_tank
    zone: global
    sectors: [nuclear]
    priority: high

  - slug: arms_control_assoc
    name: "Arms Control Association"
    rss_url: "https://www.armscontrol.org/rss.xml"
    country: US
    type: think_tank
    zone: global
    sectors: [nuclear]
    priority: high

  - slug: nti_world
    name: "Nuclear Threat Initiative"
    rss_url: "https://www.nti.org/feed/"
    country: US
    type: think_tank
    zone: global
    sectors: [nuclear]
    priority: high

  # ── ENERGÍA ───────────────────────────────────────────────────────────────────
  - slug: oilprice_world
    name: "OilPrice.com"
    rss_url: "https://oilprice.com/rss/main"
    country: UK
    type: magazine
    zone: gulf_ormuz
    sectors: [energia]
    priority: medium

  - slug: sp_global_energy
    name: "S&P Global Platts"
    rss_url: "https://www.spglobal.com/commodityinsights/en/rss-feed/oil"
    country: US
    type: agency
    zone: gulf_ormuz
    sectors: [energia, economia]
    priority: medium
```

- [ ] **Step 2: Verificar que el YAML parsea correctamente**

```bash
python3 -c "
import yaml
with open('config/news_sources.yaml') as f:
    cfg = yaml.safe_load(f)
sources = cfg['sources']
print(f'Total fuentes: {len(sources)}')
types = set(s['type'] for s in sources)
print(f'Tipos: {sorted(types)}')
countries = set(s['country'] for s in sources)
print(f'Países: {len(countries)} únicos')
"
```
Esperado: `Total fuentes: 104`, 6 tipos, ~35 países únicos.

- [ ] **Step 3: Commit**

```bash
git add config/news_sources.yaml
git commit -m "feat(config): 104 fuentes RSS para monitorización geopolítica"
```

---

## Task 3: Clasificador — TDD

**Files:**
- Create: `services/ingestor_news/classifier.py`
- Create: `services/ingestor_news/test_classifier.py`

- [ ] **Step 1: Crear `services/ingestor_news/test_classifier.py`**

```python
"""Tests unitarios del clasificador de noticias — sin dependencias externas."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from classifier import classify_sectors, classify_severity, compute_relevance


# ── classify_sectors ──────────────────────────────────────────────────────────

def test_classify_sectors_militar():
    sectors = classify_sectors("Airstrike kills dozens in Gaza", "Israeli forces launch missiles")
    assert "militar" in sectors

def test_classify_sectors_diplomacia():
    sectors = classify_sectors("UN Security Council imposes new sanctions", "")
    assert "diplomacia" in sectors
    assert "economia" in sectors  # sanctions también activa economia

def test_classify_sectors_multiple():
    sectors = classify_sectors("Missile strike forces emergency summit", "Troops advancing")
    assert "militar" in sectors
    assert "diplomacia" in sectors

def test_classify_sectors_nuclear():
    sectors = classify_sectors("IAEA reports uranium enrichment at 90%", "Iran denies warhead program")
    assert "nuclear" in sectors

def test_classify_sectors_ciberseguridad():
    sectors = classify_sectors("Major cyberattack hits critical infrastructure", "APT group identified")
    assert "ciberseguridad" in sectors

def test_classify_sectors_energia():
    sectors = classify_sectors("Russia cuts gas pipeline flow to Europe", "LNG shipments halted")
    assert "energia" in sectors

def test_classify_sectors_humanitaria():
    sectors = classify_sectors("Aid convoy blocked, refugees flee fighting", "")
    assert "crisis_humanitaria" in sectors

def test_classify_sectors_empty_text():
    sectors = classify_sectors("", "")
    assert sectors == []

def test_classify_sectors_no_match():
    sectors = classify_sectors("Local council approves new park", "")
    assert sectors == []


# ── classify_severity ─────────────────────────────────────────────────────────

def test_severity_high_critical_keyword():
    assert classify_severity("Russia launches invasion of Ukraine", ["militar"]) == "high"

def test_severity_high_nuclear():
    assert classify_severity("Nuclear test detected in North Korea", ["nuclear", "militar"]) == "high"

def test_severity_high_airstrike():
    assert classify_severity("Airstrike kills 40 civilians in Beirut", ["militar"]) == "high"

def test_severity_medium_two_active_sectors():
    assert classify_severity("Troops massing as sanctions imposed", ["militar", "diplomacia"]) == "medium"

def test_severity_medium_single_active_sector():
    assert classify_severity("Military exercises announced", ["militar"]) == "medium"

def test_severity_low_no_active_sector():
    assert classify_severity("Trade deal signed between EU and Mexico", ["economia"]) == "low"

def test_severity_low_empty():
    assert classify_severity("Local council meeting", []) == "low"


# ── compute_relevance ─────────────────────────────────────────────────────────

def test_relevance_high_priority_high_severity():
    source = {"priority": "high"}
    score = compute_relevance(source, ["militar", "nuclear"], "high")
    assert score >= 70  # 30 + 16 + 20 = 66, capped at 100

def test_relevance_medium_priority_no_sectors():
    source = {"priority": "medium"}
    score = compute_relevance(source, [], "low")
    assert score == 15

def test_relevance_capped_at_100():
    source = {"priority": "high"}
    score = compute_relevance(source, ["militar", "diplomacia", "nuclear", "economia", "energia", "ciberseguridad", "crisis_humanitaria"], "high")
    assert score == 100

def test_relevance_medium_priority_two_sectors_medium_severity():
    source = {"priority": "medium"}
    score = compute_relevance(source, ["militar", "diplomacia"], "medium")
    assert score == 15 + 16 + 10  # 41
```

- [ ] **Step 2: Ejecutar tests para verificar que FALLAN (classifier.py no existe)**

```bash
cd services/ingestor_news
pip install pytest
pytest test_classifier.py -v 2>&1 | head -20
```
Esperado: `ModuleNotFoundError: No module named 'classifier'`

- [ ] **Step 3: Crear `services/ingestor_news/classifier.py`**

```python
"""
Qilin — Clasificador de noticias por sector y severidad.
Lógica pura sin efectos secundarios — facilita testing.
"""

SECTOR_KEYWORDS: dict[str, list[str]] = {
    "militar": [
        "strike", "airstrike", "missile", "troops", "warship", "drone",
        "offensive", "ceasefire", "shelling", "bombardment", "tank",
        "fighter jet", "naval", "military operation", "armed forces",
        "artillery", "infantry", "battalion", "combat", "casualties",
        "frontline", "ammunition", "weapons", "air defense", "airspace",
        "navy", "army", "air force", "deployment", "siege", "artillery fire",
    ],
    "diplomacia": [
        "sanctions", "treaty", "negotiations", "summit", "ambassador",
        "ultimatum", "veto", "resolution", "un security council",
        "bilateral", "diplomatic", "envoy", "foreign minister",
        "secretary of state", "communique", "nato", "g7", "g20",
        "talks", "agreement", "deal", "accord", "expel", "recall",
        "embassy", "foreign policy", "multilateral", "united nations",
    ],
    "economia": [
        "sanctions", "tariff", "embargo", "export ban", "swift", "imf",
        "default", "currency", "trade war", "gdp", "inflation",
        "recession", "debt", "bond", "reserve", "world bank", "wto",
        "supply chain", "semiconductor", "economic", "financial crisis",
    ],
    "energia": [
        "pipeline", "lng", "oil", "gas", "opec", "nuclear plant",
        "blackout", "energy deal", "power grid", "refinery",
        "nord stream", "electricity", "fuel", "petrol", "barrel",
        "energy supply", "natural gas", "crude", "coal",
    ],
    "ciberseguridad": [
        "cyberattack", "ransomware", "data breach", "hack", "malware",
        "critical infrastructure", "apt", "phishing", "zero-day",
        "cyber espionage", "ddos", "intrusion", "cyber operation",
        "cybersecurity", "vulnerability", "exploit",
    ],
    "crisis_humanitaria": [
        "refugees", "famine", "displacement", "civilian casualties",
        "aid convoy", "hospital", "evacuation", "humanitarian",
        "displaced", "starvation", "siege", "blockade", "war crimes",
        "icc", "genocide", "exodus", "civilian", "children killed",
    ],
    "nuclear": [
        "nuclear", "warhead", "icbm", "uranium", "plutonium", "iaea",
        "enrichment", "ballistic missile", "deterrence", "nonproliferation",
        "dirty bomb", "radiation", "nuclear deal", "npt", "nuclear test",
        "nuclear program",
    ],
}

# Keywords que garantizan severidad HIGH sin importar sectores
CRITICAL_KEYWORDS: set[str] = {
    "nuclear strike", "nuclear attack", "invasion", "war declared",
    "coup", "airstrike kills", "missile strike", "ceasefire broken",
    "martial law", "state of emergency", "genocide", "war crimes",
    "nuclear test", "icbm launched", "aircraft carrier deployed",
    "invaded", "full-scale", "direct confrontation",
}

# Sectores que por sí solos elevan a MEDIUM
ACTIVE_SECTORS: set[str] = {"militar", "nuclear", "ciberseguridad"}


def classify_sectors(title: str, summary: str) -> list[str]:
    """
    Devuelve lista de sectores detectados en title + summary.
    Comparación case-insensitive.
    """
    text = (title + " " + summary).lower()
    return [
        sector
        for sector, keywords in SECTOR_KEYWORDS.items()
        if any(kw in text for kw in keywords)
    ]


def classify_severity(title: str, sectors: list[str]) -> str:
    """
    Calcula severidad (high/medium/low) a partir del título y los sectores.
    El título se usa para keywords críticos; los sectores para lógica de combinación.
    """
    title_lower = title.lower()
    if any(kw in title_lower for kw in CRITICAL_KEYWORDS):
        return "high"
    active_present = set(sectors) & ACTIVE_SECTORS
    if active_present:
        return "medium"
    if len(sectors) >= 2:
        return "medium"
    return "low"


def compute_relevance(source: dict, sectors: list[str], severity: str) -> int:
    """
    Calcula score de relevancia 0-100.
    source debe tener campo 'priority' (high|medium).
    """
    score = 30 if source.get("priority") == "high" else 15
    score += min(len(sectors) * 8, 40)
    score += {"high": 20, "medium": 10, "low": 0}.get(severity, 0)
    return min(score, 100)
```

- [ ] **Step 4: Ejecutar tests — deben pasar todos**

```bash
cd services/ingestor_news
pytest test_classifier.py -v
```
Esperado: `19 passed` (todos en verde).

- [ ] **Step 5: Commit**

```bash
git add services/ingestor_news/classifier.py services/ingestor_news/test_classifier.py
git commit -m "feat(ingestor-news): clasificador TDD — sectors, severity, relevance"
```

---

## Task 4: Ingestor Python — servicio completo

**Files:**
- Create: `services/ingestor_news/requirements.txt`
- Create: `services/ingestor_news/Dockerfile`
- Create: `services/ingestor_news/main.py`

- [ ] **Step 1: Crear `services/ingestor_news/requirements.txt`**

```
feedparser==6.0.*
httpx==0.27.*
asyncpg==0.29.*
redis==5.0.*
pyyaml==6.0.*
```

- [ ] **Step 2: Crear `services/ingestor_news/Dockerfile`**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```

- [ ] **Step 3: Crear `services/ingestor_news/main.py`**

```python
"""
Qilin — Ingestor de Noticias (RSS)
Fuente: RSS pública de 104 medios geopolíticos — sin autenticación.

Estrategia:
  1. Carga news_sources.yaml al arrancar.
  2. Cada NEWS_POLL_INTERVAL segundos: GET RSS de cada fuente con httpx.
  3. Parsea con feedparser (síncrono, ejecutado en executor).
  4. Clasifica cada artículo: sectors[], severity, relevance via classifier.py.
  5. Deduplica por URL en Redis (TTL 24h).
  6. Publica en stream:news + persiste en news_events (TimescaleDB).
  7. Fuentes con priority=high se procesan primero cada ciclo.
"""

import asyncio
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import asyncpg
import feedparser
import httpx
import redis.asyncio as aioredis
import yaml

from classifier import classify_sectors, classify_severity, compute_relevance

logging.basicConfig(level=logging.INFO, format="%(asctime)s [NEWS] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL     = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL        = os.getenv("DB_URL", "")
POLL_INTERVAL = int(os.getenv("NEWS_POLL_INTERVAL", "900"))  # 15 min

_executor = ThreadPoolExecutor(max_workers=4)


# ── Config ────────────────────────────────────────────────────────────────────

def load_sources() -> list[dict]:
    with open("/app/config/news_sources.yaml") as f:
        cfg = yaml.safe_load(f)
    return cfg["sources"]


# ── RSS fetch (síncrono en executor para no bloquear el loop) ─────────────────

async def fetch_feed(client: httpx.AsyncClient, source: dict) -> list[feedparser.FeedParserDict]:
    """
    Descarga y parsea el RSS de una fuente.
    Devuelve lista de entries (puede estar vacía si hay error).
    """
    url = source["rss_url"]
    try:
        r = await client.get(url, timeout=15)
        if r.status_code != 200:
            log.warning(f"HTTP {r.status_code} en {source['slug']}")
            return []
        loop = asyncio.get_event_loop()
        feed = await loop.run_in_executor(
            _executor, feedparser.parse, r.text
        )
        return feed.entries or []
    except Exception as e:
        log.warning(f"Error fetching {source['slug']}: {e}")
        return []


# ── Parseo de una entry ───────────────────────────────────────────────────────

def parse_entry(entry: feedparser.FeedParserDict, source: dict) -> dict | None:
    """
    Convierte una entry de feedparser al formato interno de Qilin.
    Devuelve None si faltan campos obligatorios.
    """
    url   = getattr(entry, "link", None)
    title = getattr(entry, "title", None)
    if not url or not title:
        return None

    summary = getattr(entry, "summary", "") or ""
    # Quitar HTML básico del summary
    summary = summary.replace("<p>", "").replace("</p>", " ").strip()

    # Fecha de publicación
    published = getattr(entry, "published_parsed", None)
    if published:
        time = datetime(*published[:6], tzinfo=timezone.utc)
    else:
        time = datetime.now(timezone.utc)

    sectors   = classify_sectors(title, summary)
    severity  = classify_severity(title, sectors)
    relevance = compute_relevance(source, sectors, severity)

    return {
        "time":           time,
        "source":         source["name"],
        "source_country": source["country"],
        "source_type":    source["type"],
        "title":          title[:500],
        "url":            url,
        "summary":        summary[:1000] if summary else None,
        "zones":          [source["zone"]] if source.get("zone") != "global" else [],
        "keywords":       sectors,  # reutiliza campo keywords existente
        "severity":       severity,
        "relevance":      relevance,
        "sectors":        sectors,
    }


# ── Publicación ───────────────────────────────────────────────────────────────

async def publish(redis, db, article: dict) -> bool:
    """
    Publica artículo nuevo en Redis stream y TimescaleDB.
    Retorna True si era nuevo, False si ya existía.
    """
    import hashlib
    url_hash = hashlib.md5(article["url"].encode()).hexdigest()
    key = f"current:news:{url_hash}"

    if await redis.exists(key):
        return False

    await redis.setex(key, 86400, "1")

    payload = {
        **article,
        "time": article["time"].isoformat(),
        "zones": json.dumps(article["zones"]),
        "sectors": json.dumps(article["sectors"]),
        "keywords": json.dumps(article["keywords"]),
    }
    await redis.xadd("stream:news", {"data": json.dumps(payload, default=str)}, maxlen=2000)

    if db:
        try:
            await db.execute(
                """
                INSERT INTO news_events
                    (time, source, title, url, summary, zones, keywords,
                     severity, relevance, source_country, source_type, sectors)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (url) DO NOTHING
                """,
                article["time"], article["source"], article["title"],
                article["url"], article["summary"],
                article["zones"], article["keywords"],
                article["severity"], article["relevance"],
                article["source_country"], article["source_type"],
                article["sectors"],
            )
        except Exception as e:
            log.error(f"Error guardando artículo en DB: {e}")

    return True


# ── Loop principal ────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin News ingestor (RSS) arrancando...")

    sources = load_sources()
    log.info(f"Cargadas {len(sources)} fuentes RSS")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Artículos no se persistirán.")

    headers = {
        "User-Agent": "Qilin/1.0 geopolitical-intelligence-platform (RSS reader)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
    }

    # Fuentes high priority primero
    ordered = (
        [s for s in sources if s.get("priority") == "high"] +
        [s for s in sources if s.get("priority") != "high"]
    )

    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        while True:
            new_count  = 0
            fail_count = 0

            for source in ordered:
                try:
                    entries = await fetch_feed(client, source)
                    for entry in entries:
                        article = parse_entry(entry, source)
                        if article and await publish(redis, db, article):
                            new_count += 1
                except Exception as e:
                    log.error(f"Error procesando {source['slug']}: {e}")
                    fail_count += 1

                await asyncio.sleep(0.5)  # cortesía entre fuentes

            log.info(
                f"Ciclo completo — {new_count} artículos nuevos, "
                f"{fail_count} fuentes fallidas de {len(ordered)}"
            )
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 4: Verificar que el módulo importa correctamente**

```bash
cd services/ingestor_news
pip install feedparser httpx asyncpg redis pyyaml
python3 -c "import main; print('OK')"
```
Esperado: `OK` sin errores de importación.

- [ ] **Step 5: Commit**

```bash
git add services/ingestor_news/
git commit -m "feat(ingestor-news): servicio RSS polling con feedparser + clasificador"
```

---

## Task 5: API — endpoints /news/feed y /news/sources

**Files:**
- Modify: `services/api/main.py` (insertar antes de la línea `# ── WEBSOCKET`, actualmente línea 399)

- [ ] **Step 1: Añadir el bloque de endpoints de noticias en `services/api/main.py`**

Insertar el siguiente bloque entre el endpoint `get_social_accounts` (línea ~396) y el comentario `# ── WEBSOCKET` (línea ~399):

```python
# ── NEWS FEED ────────────────────────────────────────────────────────────────

@app.get("/news/feed")
async def get_news_feed(
    limit: int = 50,
    zone: str | None = None,
    country: str | None = None,
    source_type: str | None = None,
    sector: str | None = None,
    severity: str | None = None,
    q: str | None = None,
    since: datetime | None = None,
    _user: str = Depends(get_current_user),
):
    """
    Feed de noticias RSS clasificadas.
    Lee de TimescaleDB con filtros dinámicos, ORDER BY time DESC.
    Fallback a stream:news en Redis si DB no disponible.
    """
    if app.state.db:
        conditions: list[str] = []
        params: list = []

        if zone:
            params.append(zone)
            conditions.append(f"${len(params)} = ANY(zones)")
        if country:
            params.append(country)
            conditions.append(f"source_country = ${len(params)}")
        if source_type:
            params.append(source_type)
            conditions.append(f"source_type = ${len(params)}")
        if sector:
            params.append(sector)
            conditions.append(f"${len(params)} = ANY(sectors)")
        if severity:
            params.append(severity)
            conditions.append(f"severity = ${len(params)}")
        if q:
            params.append(f"%{q}%")
            conditions.append(f"(title ILIKE ${len(params)} OR summary ILIKE ${len(params)})")
        if since:
            params.append(since)
            conditions.append(f"time >= ${len(params)}")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(min(limit, 200))
        rows = await app.state.db.fetch(
            f"SELECT * FROM news_events {where} ORDER BY time DESC LIMIT ${len(params)}",
            *params,
        )
        return [dict(r) for r in rows]

    # Fallback Redis
    entries = await app.state.redis.xrevrange("stream:news", count=min(limit, 200))
    return [json.loads(msg["data"]) for _, msg in entries]


@app.get("/news/sources")
async def get_news_sources(_user: str = Depends(get_current_user)):
    """Lista de fuentes RSS monitorizadas desde news_sources.yaml."""
    config_path = "/app/config/news_sources.yaml"
    try:
        with open(config_path) as f:
            cfg = yaml.safe_load(f)
        return cfg.get("sources", [])
    except Exception as e:
        log.warning(f"Error leyendo news_sources.yaml: {e}")
        return []
```

- [ ] **Step 2: Verificar que el endpoint `/news/sources` no rompe el API**

Con el API corriendo:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -d "username=carlos&password=12345" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/news/sources" | python3 -c "
import sys, json
sources = json.load(sys.stdin)
print(f'Total: {len(sources)} fuentes')
"
```
Esperado: `Total: 104 fuentes`

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/news/feed?limit=5" | python3 -m json.tool
```
Esperado: array vacío `[]` (ingestor aún no ha corrido) o artículos si hay datos.

- [ ] **Step 3: Commit**

```bash
git add services/api/main.py
git commit -m "feat(api): endpoints GET /news/feed y /news/sources"
```

---

## Task 6: Docker Compose y variables de entorno

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Añadir servicio `ingestor-news` a `docker-compose.yml`**

Añadir después del bloque `ingestor-social` (tras la línea `depends_on: - timescaledb` del social):

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

- [ ] **Step 2: Añadir variable a `.env.example`**

Añadir al final de `.env.example`:

```bash
# Intervalo de polling para noticias RSS (segundos, default 900 = 15 min)
NEWS_POLL_INTERVAL=900
```

- [ ] **Step 3: Verificar que el servicio construye**

```bash
docker compose build ingestor-news
```
Esperado: `Successfully built` sin errores.

- [ ] **Step 4: Arrancar y verificar logs**

```bash
docker compose up ingestor-news --no-deps 2>&1 | head -30
```
Esperado primeras líneas:
```
[NEWS] Qilin News ingestor (RSS) arrancando...
[NEWS] Cargadas 104 fuentes RSS
[NEWS] Ciclo completo — XX artículos nuevos, Y fuentes fallidas de 104
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat(infra): servicio ingestor-news en Docker Compose"
```

---

## Task 7: Hook React `useNewsFeed`

**Files:**
- Create: `frontend/src/hooks/useNewsFeed.js`

- [ ] **Step 1: Crear `frontend/src/hooks/useNewsFeed.js`**

```javascript
import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from './apiClient'

export function useNewsFeed() {
  const [articles,   setArticles]   = useState([])
  const [sources,    setSources]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawArticles, rawSources] = await Promise.all([
          apiFetch('/api/news/feed?limit=100'),
          apiFetch('/api/news/sources'),
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
  }, [])

  // Valores derivados para los filtros del sidebar
  const countries   = useMemo(() => [...new Set(sources.map(s => s.country))].sort(),   [sources])
  const sourceTypes = useMemo(() => [...new Set(sources.map(s => s.type))].sort(),      [sources])
  const zones       = useMemo(() => [...new Set(sources.map(s => s.zone).filter(z => z !== 'global'))].sort(), [sources])
  const sectors     = useMemo(() => {
    const all = sources.flatMap(s => s.sectors || [])
    return [...new Set(all)].sort()
  }, [sources])

  return { articles, sources, countries, sourceTypes, zones, sectors, loading, lastUpdate }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useNewsFeed.js
git commit -m "feat(frontend): hook useNewsFeed con polling 60s"
```

---

## Task 8: NewsPage — datos reales + filtros nuevos

**Files:**
- Modify: `frontend/src/pages/NewsPage.jsx`

- [ ] **Step 1: Reescribir `frontend/src/pages/NewsPage.jsx` con datos reales**

Reemplazar el contenido completo del fichero:

```jsx
import { useState, useMemo } from 'react'
import { useNewsFeed } from '../hooks/useNewsFeed'

const SEV_COLOR  = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' }
const SEV_BG     = { high: 'rgba(255,59,74,0.10)', medium: 'rgba(255,176,32,0.09)', low: 'rgba(0,229,160,0.08)' }
const SEV_BORDER = { high: 'rgba(255,59,74,0.28)', medium: 'rgba(255,176,32,0.26)', low: 'rgba(0,229,160,0.2)' }

const TYPE_LABELS = {
  agency:       'Agencia',
  newspaper:    'Periódico',
  magazine:     'Revista',
  think_tank:   'Think Tank',
  government:   'Oficial',
  defense_media:'Defensa',
}

const SECTOR_LABELS = {
  militar:           'Militar',
  diplomacia:        'Diplomacia',
  economia:          'Economía',
  energia:           'Energía',
  ciberseguridad:    'Ciber',
  crisis_humanitaria:'Humanitario',
  nuclear:           'Nuclear',
}

const SECTOR_COLOR = {
  militar:           'rgba(255,59,74,0.8)',
  diplomacia:        'rgba(0,200,255,0.8)',
  economia:          'rgba(255,176,32,0.8)',
  energia:           'rgba(255,140,0,0.8)',
  ciberseguridad:    'rgba(130,80,255,0.8)',
  crisis_humanitaria:'rgba(0,229,160,0.8)',
  nuclear:           'rgba(255,59,74,1)',
}

function RelevanceBar({ value }) {
  const color = value >= 70 ? 'var(--red)' : value >= 50 ? 'var(--amber)' : 'var(--green)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '2px', background: 'var(--border)', borderRadius: '1px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '1px', transition: 'width .3s' }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color, flexShrink: 0 }}>{value}</span>
    </div>
  )
}

function SectorTag({ sector }) {
  const color = SECTOR_COLOR[sector] || 'rgba(150,150,150,0.8)'
  const label = SECTOR_LABELS[sector] || sector
  return (
    <span style={{
      fontSize: '8px', fontFamily: 'var(--mono)',
      color: 'var(--bg-0)', background: color,
      padding: '1px 5px', borderRadius: '2px',
    }}>
      {label}
    </span>
  )
}

function NewsCard({ article, selected, onClick }) {
  const severity = article.severity || 'low'
  // sectors puede venir como array de Python (ya deserializado) o como JSON string
  const sectors = Array.isArray(article.sectors)
    ? article.sectors
    : (article.keywords || [])

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        background: selected ? 'var(--bg-3)' : 'var(--bg-2)',
        border: `1px solid ${selected ? 'rgba(0,200,255,0.35)' : 'var(--border)'}`,
        borderLeft: `3px solid ${SEV_COLOR[severity]}`,
        borderRadius: '2px',
        cursor: 'pointer',
        transition: 'all .15s',
        marginBottom: '6px',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(0,200,255,0.2)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '8px', fontWeight: '700', letterSpacing: '.12em',
          padding: '2px 6px', borderRadius: '2px',
          background: SEV_BG[severity],
          color: SEV_COLOR[severity],
          border: `1px solid ${SEV_BORDER[severity]}`,
          fontFamily: 'var(--mono)', flexShrink: 0,
        }}>{severity.toUpperCase()}</span>

        <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--cyan)', letterSpacing: '.06em', flexShrink: 0 }}>
          {article.source_country && `[${article.source_country}]`}
        </span>

        <span style={{ fontSize: '8px', fontFamily: 'var(--mono)', color: 'var(--txt-3)', flexShrink: 0 }}>
          {TYPE_LABELS[article.source_type] || article.source_type}
        </span>

        <span style={{ marginLeft: 'auto', fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--txt-3)', flexShrink: 0 }}>
          {article.source}
        </span>
      </div>

      {/* Título */}
      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--txt-1)', lineHeight: 1.35, marginBottom: '6px' }}>
        {article.title}
      </div>

      {/* Resumen (solo si está seleccionado) */}
      {selected && article.summary && (
        <div style={{ fontSize: '11px', color: 'var(--txt-2)', lineHeight: 1.6, marginBottom: '8px' }}>
          {article.summary}
        </div>
      )}

      {/* Footer: sectores + relevancia + enlace */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {sectors.slice(0, 3).map(s => <SectorTag key={s} sector={s} />)}
        <div style={{ marginLeft: 'auto', flex: '0 0 100px' }}>
          <RelevanceBar value={article.relevance || 50} />
        </div>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              fontFamily: 'var(--mono)', fontSize: '9px',
              color: 'var(--cyan)', textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            Leer ↗
          </a>
        )}
      </div>
    </div>
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

export default function NewsPage() {
  const { articles, countries, sourceTypes, zones, sectors, loading, lastUpdate } = useNewsFeed()

  const [sevFilter,  setSevFilter]  = useState('TODOS')
  const [sectorFilter, setSectorFilter] = useState('TODOS')
  const [zoneFilter, setZoneFilter] = useState('TODOS')
  const [countryFilter, setCountryFilter] = useState('TODOS')
  const [typeFilter, setTypeFilter] = useState('TODOS')
  const [selected,   setSelected]   = useState(null)
  const [search,     setSearch]     = useState('')

  const filtered = useMemo(() => articles.filter(a => {
    const articleSectors = Array.isArray(a.sectors) ? a.sectors : (a.keywords || [])
    const articleZones   = Array.isArray(a.zones) ? a.zones : []

    if (sevFilter    !== 'TODOS' && a.severity     !== sevFilter)               return false
    if (sectorFilter !== 'TODOS' && !articleSectors.includes(sectorFilter))     return false
    if (zoneFilter   !== 'TODOS' && !articleZones.includes(zoneFilter))         return false
    if (countryFilter!== 'TODOS' && a.source_country !== countryFilter)         return false
    if (typeFilter   !== 'TODOS' && a.source_type    !== typeFilter)            return false
    if (search && !a.title?.toLowerCase().includes(search.toLowerCase()))       return false
    return true
  }), [articles, sevFilter, sectorFilter, zoneFilter, countryFilter, typeFilter, search])

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {/* Sidebar filtros */}
      <aside style={{
        width: '160px', flexShrink: 0,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border-md)',
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', gap: '14px',
        overflowY: 'auto',
      }}>
        {/* Búsqueda */}
        <div>
          <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
            BUSCAR
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="titular…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: '2px', color: 'var(--txt-1)',
              fontFamily: 'var(--mono)', fontSize: '9px',
              padding: '5px 7px', outline: 'none',
            }}
          />
        </div>

        <FilterGroup
          label="SEVERIDAD"
          options={['high', 'medium', 'low']}
          value={sevFilter}
          onChange={setSevFilter}
        />

        <FilterGroup
          label="SECTOR"
          options={sectors}
          value={sectorFilter}
          onChange={setSectorFilter}
          labelFn={s => SECTOR_LABELS[s] || s}
        />

        <FilterGroup
          label="ZONA"
          options={zones}
          value={zoneFilter}
          onChange={setZoneFilter}
        />

        <FilterGroup
          label="PAÍS"
          options={countries}
          value={countryFilter}
          onChange={setCountryFilter}
        />

        <FilterGroup
          label="TIPO"
          options={sourceTypes}
          value={typeFilter}
          onChange={setTypeFilter}
          labelFn={t => TYPE_LABELS[t] || t}
        />
      </aside>

      {/* Feed principal */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Barra de estado */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
          background: 'var(--bg-1)',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>
            NEWS INTELLIGENCE · RSS
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', marginLeft: 'auto' }}>
            {loading
              ? 'Cargando…'
              : `${filtered.length} artículos · ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`
            }
          </span>
        </div>

        {/* Artículos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)' }}>
              Cargando noticias…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)' }}>
              {articles.length === 0
                ? 'Ingestor de noticias no activo o sin artículos aún'
                : 'Sin resultados para los filtros actuales'}
            </div>
          )}
          {!loading && filtered.map(article => (
            <NewsCard
              key={article.id || article.url}
              article={article}
              selected={selected === (article.id || article.url)}
              onClick={() => setSelected(
                selected === (article.id || article.url) ? null : (article.id || article.url)
              )}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Arrancar el frontend y verificar que NewsPage carga sin errores**

```bash
cd frontend
npm run dev
```

Abrir `http://localhost:3000` → navegar a News.

Verificar:
- Status bar muestra "Cargando…" y luego "0 artículos · HH:MM:SS"
- Sidebar muestra los grupos de filtros (vacíos si no hay datos)
- No hay errores de consola relacionados con `MOCK_NEWS` ni imports rotos

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/NewsPage.jsx
git commit -m "feat(frontend): NewsPage con datos reales + filtros país/tipo/sector"
```

---

## Task 9: Verificación end-to-end

- [ ] **Step 1: Levantar el stack con el ingestor**

```bash
docker compose up --build redis timescaledb api ingestor-news
```

- [ ] **Step 2: Verificar logs del ingestor**

```bash
docker logs qilin_ingestor_news -f
```
Esperado en los primeros 5 minutos:
```
[NEWS] Qilin News ingestor (RSS) arrancando...
[NEWS] Cargadas 104 fuentes RSS
[NEWS] Ciclo completo — XXX artículos nuevos, Y fuentes fallidas de 104
```

- [ ] **Step 3: Verificar artículos en TimescaleDB**

```bash
docker exec qilin_db psql -U qilin -d qilin -c "
SELECT source, severity, LEFT(title, 60) AS titulo, time
FROM news_events
ORDER BY time DESC
LIMIT 10;"
```
Esperado: filas con artículos reales con severity y source rellenados.

- [ ] **Step 4: Verificar endpoint /news/feed**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -d "username=carlos&password=12345" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/news/feed?limit=5&severity=high" | python3 -m json.tool
```
Esperado: array con artículos de severidad high con campos `severity`, `sectors`, `source_country`, etc.

- [ ] **Step 5: Probar filtros en la NewsPage**

Abrir `http://localhost:3000` → News.
- Feed muestra artículos con etiquetas de sector coloreadas
- Filtro "Severidad → high" muestra solo artículos críticos
- Filtro "País → US" muestra solo fuentes americanas
- Filtro "Tipo → think_tank" muestra ISW, Bellingcat, RAND, etc.
- Filtro "Sector → nuclear" muestra 38 North, Bulletin, IAEA, etc.
- Clic en un artículo despliega el resumen

- [ ] **Step 6: Commit final**

```bash
git add .
git commit -m "feat(news): integración completa RSS — ingestor + API + NewsPage"
```
