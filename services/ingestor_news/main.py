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
