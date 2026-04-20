"""
Qilin — Ingestor Sentinel-5P (emisiones atmosféricas)
Fuente: Copernicus Data Space Ecosystem (CDSE) OData API — sin coste, OAuth2.

Estrategia:
  1. Token OAuth2 gestionado por CdseClient (renovación automática cada ~10 min).
  2. Cada SENTINEL_POLL_INTERVAL segundos (default 6h):
     Para cada zona en zones.yaml y cada producto (NO2, SO2):
       - Busca el granule más reciente (<24h) que intersecta la bbox de la zona.
       - Deduplica via Redis: omite granules ya procesados.
       - Extrae mean_value de los Attributes del granule.
       - Calcula baseline 30 días desde sentinel_observations.
       - Si anomaly_ratio >= 1.5 → publica en stream:sentinel.
       - Persiste en sentinel_observations (TimescaleDB).
"""

import asyncio
import logging
import os

import asyncpg
import redis.asyncio as aioredis
import yaml

from cdse_client import CdseClient
from sentinel_processor import process_granule

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SENTINEL] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL     = os.getenv("REDIS_URL",               "redis://localhost:6379")
DB_URL        = os.getenv("DB_URL",                  "")
CDSE_USER     = os.getenv("CDSE_USER",               "")
CDSE_PASSWORD = os.getenv("CDSE_PASSWORD",            "")
POLL_INTERVAL = int(os.getenv("SENTINEL_POLL_INTERVAL", "21600"))  # 6h

PRODUCTS = ["L2__NO2___", "L2__SO2___"]
DEDUP_TTL = 86400 * 2  # 48h — un granule tarda más de 24h en actualizarse


def load_zones() -> list[tuple[str, dict]]:
    with open("/app/config/zones.yaml") as f:
        cfg = yaml.safe_load(f)
    return [(name, z) for name, z in cfg["zones"].items()]


async def main() -> None:
    log.info(
        "[SENTINEL] Arrancando — poll_interval=%ds productos=%s",
        POLL_INTERVAL, PRODUCTS,
    )

    if not CDSE_USER or not CDSE_PASSWORD:
        log.warning(
            "[SENTINEL] CDSE_USER/CDSE_PASSWORD no configurados "
            "— el servicio arranca pero no procesará datos"
        )

    zones = load_zones()
    log.info("[SENTINEL] Monitorizando %d zonas", len(zones))

    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("[SENTINEL] Conectado a TimescaleDB")
        except Exception as exc:
            log.warning(
                "[SENTINEL] Sin conexión a DB, continuando sin persistencia: %s", exc
            )

    cdse = CdseClient(user=CDSE_USER, password=CDSE_PASSWORD)

    try:
        while True:
            # Verify connectivity before starting the cycle
            token = await cdse.get_token()
            if not token and (CDSE_USER or CDSE_PASSWORD):
                log.warning(
                    "[SENTINEL] CDSE no responde o credenciales inválidas "
                    "— esperando próximo ciclo"
                )
                await asyncio.sleep(POLL_INTERVAL)
                continue

            processed = 0

            for zone_name, zone_cfg in zones:
                for product in PRODUCTS:
                    try:
                        granule = await cdse.find_latest_granule(zone_cfg, product)

                        if not granule:
                            log.info(
                                "[SENTINEL] Sin datos Sentinel para %s (%s)",
                                zone_name, product,
                            )
                            continue

                        granule_id = granule.get("Id", "unknown")

                        # Dedup: skip granules already processed
                        dedup_key = f"sentinel:seen:{granule_id}"
                        if await redis_client.exists(dedup_key):
                            continue
                        await redis_client.setex(dedup_key, DEDUP_TTL, "1")

                        await process_granule(
                            redis_client, db, zone_name, product, granule
                        )
                        processed += 1

                    except Exception as exc:
                        log.warning(
                            "[SENTINEL] Error en %s/%s: %s", zone_name, product, exc
                        )

                await asyncio.sleep(1)  # cortesía entre zonas

            log.info(
                "[SENTINEL] Ciclo completo — %d observaciones procesadas", processed
            )
            await asyncio.sleep(POLL_INTERVAL)

    finally:
        await cdse.close()
        await redis_client.aclose()
        if db:
            await db.close()


if __name__ == "__main__":
    asyncio.run(main())
