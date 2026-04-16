"""
Qilin — Ingestor de Documentos Oficiales
Fuente: RSS + scraping de 30 portales de defensa, organismos internacionales,
        think tanks y energía.

Estrategia:
  1. Carga doc_sources.yaml al arrancar.
  2. Cada DOCS_POLL_INTERVAL segundos: fetch RSS o scraping por fuente.
  3. Filtra PDFs ya vistos (dedup Redis TTL 7 días).
  4. Para fuentes no-mandatory: descarta si classifier no detecta ningún sector.
  5. Descarga PDF + extrae texto (pdfplumber).
  6. Clasifica sectores, severidad, relevancia.
  7. Persiste en TimescaleDB `documents`.
  8. Fuentes con 3+ fallos consecutivos → evento en stream:alerts.
"""

import asyncio
import hashlib
import json
import logging
import os
from datetime import datetime, timezone

import asyncpg
import httpx
import redis.asyncio as aioredis
import yaml
from playwright.async_api import async_playwright

from classifier import classify_sectors, classify_severity, compute_relevance
from extractor import download_and_extract
from fetcher import fetch_source

logging.basicConfig(level=logging.INFO, format="%(asctime)s [DOCS] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL         = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL            = os.getenv("DB_URL", "")
POLL_INTERVAL     = int(os.getenv("DOCS_POLL_INTERVAL", "3600"))
FAILURE_THRESHOLD = 3


def load_sources() -> list[dict]:
    with open("/app/config/doc_sources.yaml") as f:
        cfg = yaml.safe_load(f)
    return cfg["sources"]


async def _publish_failure_alert(redis, source: dict, failures: int, error: str):
    payload = {
        "rule":        "scrape_failure",
        "zone":        "global",
        "severity":    "medium",
        "title":       f"Portal sin respuesta: {source['name']}",
        "description": f"La fuente '{source['slug']}' ha fallado {failures} ciclos consecutivos. Último error: {error}",
        "time":        datetime.now(timezone.utc).isoformat(),
        "entities":    json.dumps([{"type": "doc_source", "id": source["slug"]}]),
    }
    await redis.xadd("stream:alerts", {"data": json.dumps(payload)}, maxlen=500)
    log.error(f"ALERTA scraping: {source['slug']} lleva {failures} fallos consecutivos")


async def process_source(
    client: httpx.AsyncClient,
    redis,
    db,
    source: dict,
    browser=None,
) -> int:
    """
    Procesa una fuente: fetch → dedup → (optional filter) → download → classify → persist.
    Retorna número de documentos nuevos guardados.
    """
    slug        = source["slug"]
    failure_key = f"docs:failures:{slug}"
    new_count   = 0

    try:
        entries = await fetch_source(client, source, browser=browser)
    except Exception as e:
        log.error(f"[{slug}] fetch fallido: {e}")
        failures = int(await redis.incr(failure_key))
        await redis.expire(failure_key, 7 * 86400)
        if failures >= FAILURE_THRESHOLD:
            await _publish_failure_alert(redis, source, failures, str(e))
        return 0

    # Fuente respondió correctamente → resetear contador de fallos
    await redis.delete(failure_key)

    for entry in entries:
        url      = entry["url"]
        url_hash = hashlib.md5(url.encode()).hexdigest()
        dedup_key = f"current:doc:{url_hash}"

        if await redis.exists(dedup_key):
            continue

        # Para fuentes no-mandatory: solo ingestar si el clasificador detecta algún sector
        if not source.get("mandatory", False):
            if not classify_sectors(entry["title"], ""):
                continue

        # Descargar y extraer texto del PDF
        try:
            meta        = await download_and_extract(client, url)
            status      = "processed"
            fetch_error = None
        except Exception as e:
            log.warning(f"[{slug}] extracción fallida {url}: {e}")
            meta = {"full_text": None, "summary": None, "page_count": None, "file_size_kb": None}
            status      = "failed"
            fetch_error = str(e)[:200]

        # Clasificar
        sectors   = classify_sectors(entry["title"], meta.get("summary") or "")
        severity  = classify_severity(entry["title"], sectors)
        relevance = compute_relevance(source, sectors, severity)

        # Fecha de publicación (del feed si existe, sino NOW)
        pub      = entry.get("published")
        doc_time = datetime(*pub[:6], tzinfo=timezone.utc) if pub else datetime.now(timezone.utc)

        # Persistir en DB
        if db:
            try:
                await db.execute(
                    """
                    INSERT INTO documents
                        (time, title, url, source, source_country, org_type,
                         sectors, relevance, severity, page_count, file_size_kb,
                         summary, full_text, status, fetch_error)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                    ON CONFLICT (url) DO NOTHING
                    """,
                    doc_time, entry["title"], url,
                    source["name"], source["country"], source["org_type"],
                    sectors, relevance, severity,
                    meta.get("page_count"), meta.get("file_size_kb"),
                    meta.get("summary"), meta.get("full_text"),
                    status, fetch_error,
                )
            except Exception as e:
                log.error(f"[{slug}] DB insert fallido: {e}")

        await redis.setex(dedup_key, 7 * 86400, "1")
        new_count += 1
        await asyncio.sleep(0.5)  # cortesía entre descargas de PDF

    return new_count


async def main():
    log.info("Qilin Document ingestor arrancando...")

    sources = load_sources()
    log.info(f"Cargadas {len(sources)} fuentes de documentos")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Documentos no se persistirán.")

    headers = {
        "User-Agent": "Qilin/1.0 geopolitical-intelligence-platform (document monitor)",
        "Accept":     "text/html,application/xhtml+xml,application/xml,application/pdf,*/*",
    }

    # Fuentes high priority primero
    ordered = (
        [s for s in sources if s.get("priority") == "high"] +
        [s for s in sources if s.get("priority") != "high"]
    )

    log.info("Iniciando Playwright (Chromium headless)...")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        log.info("Playwright listo.")

        async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
            while True:
                new_count = 0
                for source in ordered:
                    new_count += await process_source(client, redis, db, source, browser=browser)
                    await asyncio.sleep(1.0)  # cortesía entre fuentes

                log.info(f"Ciclo completo — {new_count} documentos nuevos de {len(ordered)} fuentes")
                await asyncio.sleep(POLL_INTERVAL)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
