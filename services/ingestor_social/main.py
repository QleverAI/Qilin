"""
Qilin — Ingestor Social (RSS + RSSHub)

Estrategia:
  - Cuentas con RSS oficial usan su feed directo (medios, instituciones).
  - Resto usa RSSHub: {RSSHUB_BASE}/twitter/user/{handle}
    → configura RSSHUB_BASE apuntando a una instancia propia para mayor fiabilidad.
  - Deduplica por entry GUID/URL en Redis (TTL 24h).
  - Publica en stream:social + persiste en social_posts.
  - Ciclo cada SOCIAL_POLL_INTERVAL segundos (default 900).
"""

import asyncio
import hashlib
import html
import json
import logging
import os
import re
from datetime import datetime, timezone

import asyncpg
import feedparser
import httpx
import redis.asyncio as aioredis
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SOCIAL] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL     = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL        = os.getenv("DB_URL", "")
POLL_INTERVAL = int(os.getenv("SOCIAL_POLL_INTERVAL", "900"))
RSSHUB_BASE   = os.getenv("RSSHUB_BASE", "http://rsshub:1200").rstrip("/")
BATCH_SIZE    = int(os.getenv("SOCIAL_BATCH_SIZE", "15"))

# ── Feeds RSS directos por handle (minúsculas) ────────────────────────────
# None = sin RSS directo fiable → usa RSSHub (ver RSSHUB_ROUTES abajo)
RSS_OVERRIDES: dict[str, str | None] = {
    # Medios internacionales — RSS oficial estable
    "bbcworld":        "http://feeds.bbci.co.uk/news/world/rss.xml",
    "nytimes":         "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "washingtonpost":  "https://feeds.washingtonpost.com/rss/world",
    "guardian":        "https://www.theguardian.com/world/rss",
    "aljazeera":       "https://www.aljazeera.com/xml/rss/all.xml",
    "ajenglish":       "https://www.aljazeera.com/xml/rss/all.xml",
    "politico":        "https://rss.politico.com/politics-news.xml",
    "foreignpolicy":   "https://foreignpolicy.com/feed/",
    "theeconomist":    "https://www.economist.com/international/rss.xml",
    "deutschewelle":   "https://rss.dw.com/rdf/rss-en-world",
    "france24english": "https://www.france24.com/en/rss",
    "middleeasteye":   "https://www.middleeasteye.net/rss",
    "timesofisrael":   "https://www.timesofisrael.com/feed/",
    "irna_english":    "https://en.irna.ir/rss",
    "defense_one":     "https://www.defenseone.com/rss/all/",
    "euractiv":        "https://www.euractiv.com/feed/",
    "axios":           "https://api.axios.com/feed/",
    "thehill":         "https://thehill.com/feed/",
    "newsweek":        "https://www.newsweek.com/rss",
    "channel4news":    "https://www.channel4.com/news/feed/dateline/rss.xml",
    "kyivindependent": "https://kyivindependent.com/feed/",
    "kyivpost":        "https://www.kyivpost.com/rss",
    # Instituciones — RSS oficial
    "nato":            "https://www.nato.int/rss/en/news.xml",
    "un":              "https://press.un.org/en/rss.xml",
    "iaea":            "https://www.iaea.org/feeds/topstories.xml",
    "who":             "https://www.who.int/rss-feeds/news-english.xml",
    "wfp":             "https://www.wfp.org/rss.xml",
    "eu_commission":   "https://ec.europa.eu/commission/presscorner/rss/en",
    "europarl_en":     "https://www.europarl.europa.eu/rss/doc/press-releases-en.xml",
    # Rusia / China — medios estado con RSS
    "rt_com":          "https://www.rt.com/rss/news/",
    "tass_agency":     "https://tass.com/rss/v2.xml",
    "xhnews":          "https://www.xinhuanet.com/english/rss/worldrss.xml",
    "cgtnofficial":    "https://www.cgtn.com/subscribe/rss/section/world.do",
    "chinadaily":      "https://www.chinadaily.com.cn/rss/world_rss.xml",
    # Sin RSS directo fiable → usa RSSHub vía RSSHUB_ROUTES
    "reuters":         None,
    "reutersworld":    None,
    "ap":              None,
    "wsj":             None,
    "afp":             None,
    "haaretzcom":      None,
    "spectatorindex":  None,
    "disclosetv":      None,
}

# ── Rutas RSSHub para fuentes sin RSS oficial ─────────────────────────────
# Si handle está aquí, usa {RSSHUB_BASE}{ruta} en vez de /twitter/user/{handle}
RSSHUB_ROUTES: dict[str, str] = {
    "reuters":      "/reuters/world",
    "reutersworld": "/reuters/world",
    "ap":           "/apnews/topics/world-news",
    "wsj":          "/wsj/world-news",
    "afp":          "/afp/en/world",
}


def get_feed_url(account: dict) -> str | None:
    handle = account["handle"].lower()
    # 1. RSS directo registrado
    if handle in RSS_OVERRIDES:
        url = RSS_OVERRIDES[handle]
        if url is not None:
            return url
        # None pero tiene ruta RSSHub → usar RSSHub
        if handle in RSSHUB_ROUTES:
            return f"{RSSHUB_BASE}{RSSHUB_ROUTES[handle]}"
        return None  # omitir
    # 2. Ruta RSSHub personalizada (no Twitter)
    if handle in RSSHUB_ROUTES:
        return f"{RSSHUB_BASE}{RSSHUB_ROUTES[handle]}"
    # 3. Fallback: feed de Twitter vía RSSHub
    return f"{RSSHUB_BASE}/twitter/user/{account['handle']}"


def strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    return " ".join(html.unescape(text).split())


def entry_time(entry) -> datetime:
    for field in ("published_parsed", "updated_parsed"):
        t = getattr(entry, field, None)
        if t:
            try:
                return datetime(*t[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    return datetime.now(timezone.utc)


def entry_uid(entry) -> str:
    raw = getattr(entry, "id", None) or getattr(entry, "link", None) or ""
    return hashlib.md5(raw.encode()).hexdigest()


def entry_media(entry) -> tuple[str | None, str | None]:
    for key in ("media_content", "media_thumbnail"):
        items = getattr(entry, key, None)
        if items and isinstance(items, list) and items[0].get("url"):
            t = items[0].get("type", "")
            mtype = "video" if "video" in t else "photo"
            return items[0]["url"], mtype
    for link in getattr(entry, "links", []):
        if link.get("rel") == "enclosure" and "image" in link.get("type", ""):
            return link.get("href"), "photo"
    return None, None


async def fetch_feed(client: httpx.AsyncClient, url: str) -> list:
    try:
        r = await client.get(url, follow_redirects=True, timeout=20)
        if r.status_code != 200:
            log.debug(f"Feed {url}: HTTP {r.status_code}")
            return []
        feed = feedparser.parse(r.text)
        return feed.entries or []
    except Exception as e:
        log.debug(f"Feed {url}: {e}")
        return []


async def process_account(
    client: httpx.AsyncClient,
    redis,
    db,
    account: dict,
) -> int:
    url = get_feed_url(account)
    if not url:
        return 0

    entries = await fetch_feed(client, url)
    new_count = 0

    for entry in entries[:20]:
        uid = entry_uid(entry)
        key = f"current:tweet:{uid}"
        if await redis.exists(key):
            continue

        title      = strip_html(getattr(entry, "title", ""))
        summary    = strip_html(getattr(entry, "summary", ""))
        content    = title or summary or "—"
        link       = getattr(entry, "link", url)
        media_url, media_type = entry_media(entry)
        time_      = entry_time(entry)

        post = {
            "tweet_id":   uid,
            "handle":     account["handle"],
            "display":    account["display"],
            "category":   account["category"],
            "zone":       account["zone"],
            "content":    content,
            "lang":       None,
            "likes":      0,
            "retweets":   0,
            "url":        link,
            "media_url":  media_url,
            "media_type": media_type,
            "time":       time_.isoformat(),
        }

        payload = json.dumps(post, default=str)
        await redis.setex(key, 86400, payload)
        await redis.xadd("stream:social", {"data": payload}, maxlen=2000)

        if db:
            try:
                async with db.acquire() as conn:
                    await conn.execute(
                        """
                        INSERT INTO social_posts
                            (time, tweet_id, handle, display, category, zone,
                             content, lang, likes, retweets, url, media_url, media_type)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                        ON CONFLICT (tweet_id) DO NOTHING
                        """,
                        time_, uid, account["handle"],
                        account["display"], account["category"], account["zone"],
                        content, None, 0, 0, link, media_url, media_type,
                    )
            except Exception as e:
                log.error(f"DB error {uid}: {e}")

        new_count += 1

    return new_count


async def run_cycle(client, redis, db, accounts: list) -> int:
    total = 0
    for i in range(0, len(accounts), BATCH_SIZE):
        batch = accounts[i:i + BATCH_SIZE]
        results = await asyncio.gather(
            *[process_account(client, redis, db, a) for a in batch],
            return_exceptions=True,
        )
        total += sum(r for r in results if isinstance(r, int))
        await asyncio.sleep(2)
    return total


async def main():
    log.info("Qilin Social ingestor (RSS) arrancando...")

    try:
        with open("/app/config/social_accounts.yaml") as f:
            cfg = yaml.safe_load(f)
        accounts = cfg["accounts"]
    except Exception as e:
        log.error(f"Error cargando social_accounts.yaml: {e}")
        return

    rss_count  = sum(1 for a in accounts if a["handle"].lower() in RSS_OVERRIDES and RSS_OVERRIDES[a["handle"].lower()])
    hub_count  = sum(1 for a in accounts if a["handle"].lower() not in RSS_OVERRIDES)
    skip_count = sum(1 for a in accounts if a["handle"].lower() in RSS_OVERRIDES and not RSS_OVERRIDES[a["handle"].lower()])
    log.info(f"Cuentas: {rss_count} RSS oficiales · {hub_count} RSSHub · {skip_count} omitidas")
    log.info(f"RSSHub base: {RSSHUB_BASE}")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.create_pool(DB_URL, min_size=1, max_size=3)
            log.info("Pool TimescaleDB creado.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}")

    # high priority primero
    ordered = (
        [a for a in accounts if a.get("priority") == "high"] +
        [a for a in accounts if a.get("priority") != "high"]
    )

    headers = {"User-Agent": "Mozilla/5.0 (compatible; Qilin/1.0; RSS reader)"}
    async with httpx.AsyncClient(headers=headers) as client:
        while True:
            try:
                count = await run_cycle(client, redis, db, ordered)
                log.info(f"Ciclo completo — {count} entradas nuevas de {len(ordered)} fuentes")
                if count > 0:
                    try:
                        await redis.publish("cache.invalidate", "social.feed")
                    except Exception as e:
                        log.warning(f"[cache.invalidate] publish error: {e}")
            except Exception as e:
                log.error(f"Error en ciclo: {e}")
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
