"""
Qilin — Ingestor Sentinel-5P (emisiones atmosféricas)
Fuente: Copernicus Data Space Ecosystem (CDSE) OData API — sin coste, OAuth2.

Estrategia:
  1. Obtiene token OAuth2 con CDSE_USER / CDSE_PASSWORD.
  2. Cada SENTINEL_POLL_INTERVAL segundos (default 6h):
     Para cada zona en zones.yaml:
       - Busca granules L2__NO2___ y L2__SO2___ de las últimas 24h.
       - Descarga estadísticas del granule más reciente disponible.
       - Calcula baseline de los últimos 30 días desde sentinel_observations.
       - Si anomaly_ratio >= 1.5 → publica en stream:sentinel de Redis.
       - Persiste en sentinel_observations (TimescaleDB).
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta

import asyncpg
import httpx
import redis.asyncio as aioredis
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SENTINEL] %(message)s")
log = logging.getLogger(__name__)

CDSE_TOKEN_URL      = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CDSE_CATALOGUE_URL  = "https://catalogue.dataspace.copernicus.eu/odata/v1"

REDIS_URL     = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL        = os.getenv("DB_URL", "")
CDSE_USER     = os.getenv("CDSE_USER", "")
CDSE_PASSWORD = os.getenv("CDSE_PASSWORD", "")
POLL_INTERVAL = int(os.getenv("SENTINEL_POLL_INTERVAL", "21600"))  # 6h

PRODUCTS = ["L2__NO2___", "L2__SO2___"]
ANOMALY_THRESHOLD = 1.5  # superar 1.5x el baseline → alerta


# ── Config ────────────────────────────────────────────────────────────────────

def load_zones() -> list[tuple[str, dict]]:
    with open("/app/config/zones.yaml") as f:
        cfg = yaml.safe_load(f)
    return [(name, z) for name, z in cfg["zones"].items()]


# ── OAuth2 ────────────────────────────────────────────────────────────────────

async def get_access_token(client: httpx.AsyncClient) -> str | None:
    if not CDSE_USER or not CDSE_PASSWORD:
        log.warning("CDSE_USER/CDSE_PASSWORD no configurados — omitiendo Sentinel")
        return None
    try:
        r = await client.post(CDSE_TOKEN_URL, data={
            "client_id":  "cdse-public",
            "grant_type": "password",
            "username":   CDSE_USER,
            "password":   CDSE_PASSWORD,
        }, timeout=30)
        r.raise_for_status()
        return r.json()["access_token"]
    except Exception as e:
        log.error(f"Error obteniendo token CDSE: {e}")
        return None


# ── Búsqueda de granules ──────────────────────────────────────────────────────

async def find_latest_granule(
    client: httpx.AsyncClient, token: str,
    zone_cfg: dict, product: str
) -> dict | None:
    """
    Busca el granule más reciente (<24h) que intersecta la bounding box de la zona.
    """
    lat_min, lat_max = zone_cfg["lat"]
    lon_min, lon_max = zone_cfg["lon"]
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")

    bbox_wkt = (
        f"POLYGON(({lon_min} {lat_min},{lon_max} {lat_min},"
        f"{lon_max} {lat_max},{lon_min} {lat_max},{lon_min} {lat_min}))"
    )

    params = {
        "$filter": (
            f"Collection/Name eq 'SENTINEL-5P' and "
            f"Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' "
            f"and att/OData.CSC.StringAttribute/Value eq '{product}') and "
            f"ContentDate/Start gt {since} and "
            f"OData.CSC.Intersects(area=geography'SRID=4326;{bbox_wkt}')"
        ),
        "$orderby": "ContentDate/Start desc",
        "$top":     "1",
        "$expand":  "Attributes",
    }

    try:
        r = await client.get(
            f"{CDSE_CATALOGUE_URL}/Products",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        r.raise_for_status()
        items = r.json().get("value", [])
        return items[0] if items else None
    except Exception as e:
        log.warning(f"Error buscando granule {product}: {e}")
        return None


# ── Estadísticas desde atributos ──────────────────────────────────────────────

def extract_stats_from_attributes(granule: dict, product: str) -> dict | None:
    """
    Extrae estadísticas de los atributos del granule CDSE.
    Devuelve None si no hay valores numéricos disponibles.
    """
    attrs = {a["Name"]: a.get("Value") for a in granule.get("Attributes", [])}

    mean_val = attrs.get("meanValue") or attrs.get("mean_value")
    max_val  = attrs.get("maxValue")  or attrs.get("max_value")

    if mean_val is None:
        log.debug(f"Granule {granule.get('Id')} sin estadísticas numéricas en atributos")
        return None

    try:
        mean_val = float(mean_val)
        max_val  = float(max_val) if max_val is not None else mean_val * 1.5
        p95_val  = mean_val + (max_val - mean_val) * 0.8
    except (ValueError, TypeError) as e:
        log.warning(f"Error parseando estadísticas del granule: {e}")
        return None

    return {"mean": mean_val, "max": max_val, "p95": p95_val}


# ── Baseline histórico ────────────────────────────────────────────────────────

async def get_baseline(db, zone_id: str, product: str) -> float | None:
    """
    Media de mean_value de los últimos 30 días para zona+producto.
    Devuelve None si no hay datos suficientes (<3 observaciones).
    """
    if not db:
        return None
    try:
        row = await db.fetchrow(
            """
            SELECT AVG(mean_value) as baseline, COUNT(*) as cnt
            FROM sentinel_observations
            WHERE zone_id = $1 AND product = $2
              AND time > NOW() - INTERVAL '30 days'
            """,
            zone_id, product,
        )
        if row and row["cnt"] >= 3:
            return float(row["baseline"])
        return None
    except Exception as e:
        log.warning(f"Error leyendo baseline sentinel: {e}")
        return None


# ── Publicación ───────────────────────────────────────────────────────────────

async def publish_observation(redis, db, zone_id: str, product: str,
                               stats: dict, baseline: float | None,
                               granule_id: str):
    anomaly_ratio = (stats["mean"] / baseline) if baseline else None
    now = datetime.now(timezone.utc)

    product_short = product.replace("L2__", "").replace("___", "").strip("_")

    record = {
        "time":           now.isoformat(),
        "zone_id":        zone_id,
        "product":        product_short,
        "mean_value":     stats["mean"],
        "max_value":      stats["max"],
        "p95_value":      stats["p95"],
        "baseline_mean":  baseline,
        "anomaly_ratio":  anomaly_ratio,
        "granule_id":     granule_id,
    }

    if db:
        try:
            await db.execute(
                """
                INSERT INTO sentinel_observations
                    (time, zone_id, product, mean_value, max_value, p95_value,
                     baseline_mean, anomaly_ratio, granule_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                """,
                now, zone_id, product_short,
                stats["mean"], stats["max"], stats["p95"],
                baseline, anomaly_ratio, granule_id,
            )
        except Exception as e:
            log.error(f"Error guardando sentinel observation: {e}")

    if anomaly_ratio and anomaly_ratio >= ANOMALY_THRESHOLD:
        log.info(
            f"Anomalía Sentinel {product_short} en {zone_id}: "
            f"ratio={anomaly_ratio:.2f}x baseline"
        )
        await redis.xadd(
            "stream:sentinel",
            {"data": json.dumps(record, default=str)},
            maxlen=500,
        )


# ── Loop principal ────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin Sentinel-5P ingestor arrancando...")

    if not CDSE_USER or not CDSE_PASSWORD:
        log.warning("Sin credenciales CDSE — el servicio esperará pero no procesará datos.")

    zones = load_zones()
    log.info(f"Monitorizando {len(zones)} zonas para productos {PRODUCTS}")

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Observaciones no se persistirán.")

    async with httpx.AsyncClient() as client:
        while True:
            token = await get_access_token(client)
            if not token:
                log.warning("Sin token CDSE — esperando próximo ciclo")
                await asyncio.sleep(POLL_INTERVAL)
                continue

            processed = 0
            for zone_name, zone_cfg in zones:
                for product in PRODUCTS:
                    try:
                        granule = await find_latest_granule(client, token, zone_cfg, product)
                        if not granule:
                            continue

                        granule_id = granule.get("Id", "unknown")

                        # Evitar reprocesar el mismo granule
                        dedup_key = f"sentinel:seen:{granule_id}"
                        if await redis.exists(dedup_key):
                            continue
                        await redis.setex(dedup_key, 86400 * 2, "1")

                        stats = extract_stats_from_attributes(granule, product)
                        if not stats:
                            continue

                        baseline = await get_baseline(db, zone_name, product)
                        await publish_observation(
                            redis, db, zone_name, product, stats, baseline, granule_id
                        )
                        processed += 1

                    except Exception as e:
                        log.error(f"Error procesando {product} en {zone_name}: {e}")

                await asyncio.sleep(1)  # cortesía entre zonas

            log.info(f"Ciclo Sentinel completo — {processed} observaciones procesadas")
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
