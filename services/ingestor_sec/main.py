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
            if new_count > 0:
                try:
                    await redis.publish("cache.invalidate", "sec.feed")
                except Exception as e:
                    log.warning(f"[cache.invalidate] publish error: {e}")
            await asyncio.sleep(SEC_POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
