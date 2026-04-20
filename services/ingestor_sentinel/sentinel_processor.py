"""
Lógica de procesamiento de granules Sentinel-5P:
  - Extracción de mean_value de los atributos del granule
  - Cálculo de baseline de 30 días desde sentinel_observations
  - Cálculo de anomaly_ratio
  - Persistencia en TimescaleDB
  - Publicación en stream:sentinel si anomaly_ratio > 1.5
"""

import json
import logging
from datetime import datetime, timezone

log = logging.getLogger(__name__)

ANOMALY_THRESHOLD  = 1.5
MIN_BASELINE_COUNT = 5  # mínimo de observaciones previas para calcular baseline válido


# ── Extracción de estadísticas ────────────────────────────────────────────────

def extract_mean_value(granule: dict, zone_name: str) -> float | None:
    """
    Intenta extraer el valor medio de los Attributes del granule CDSE.
    Si no hay atributo numérico disponible, loga INFO y devuelve None
    (el granule se persistirá con mean_value=NULL).
    """
    attrs = {a["Name"]: a.get("Value") for a in granule.get("Attributes", [])}

    for key in ("meanValue", "mean_value", "MeanValue", "MEAN_VALUE"):
        raw = attrs.get(key)
        if raw is not None:
            try:
                return float(raw)
            except (ValueError, TypeError):
                pass

    log.info(
        "[SENTINEL] Solo metadatos disponibles para %s — sin valor de columna",
        zone_name,
    )
    return None


# ── Baseline histórico ────────────────────────────────────────────────────────

async def get_baseline(db, zone_id: str, product: str) -> tuple[float | None, int]:
    """
    Calcula la media de mean_value de los últimos 30 días para zona+producto.

    Devuelve (baseline_mean, count).
    baseline_mean es None si hay menos de MIN_BASELINE_COUNT registros válidos.
    """
    if not db:
        return None, 0
    try:
        row = await db.fetchrow(
            """
            SELECT AVG(mean_value) AS baseline, COUNT(*) AS cnt
            FROM sentinel_observations
            WHERE zone_id = $1 AND product = $2
              AND mean_value IS NOT NULL
              AND time > NOW() - INTERVAL '30 days'
            """,
            zone_id, product,
        )
        cnt = int(row["cnt"]) if row else 0
        if cnt >= MIN_BASELINE_COUNT and row["baseline"] is not None:
            return float(row["baseline"]), cnt
        return None, cnt
    except Exception as exc:
        log.warning(
            "[SENTINEL] Error leyendo baseline %s/%s: %s", zone_id, product, exc
        )
        return None, 0


# ── Procesamiento principal ───────────────────────────────────────────────────

async def process_granule(
    redis,
    db,
    zone_name: str,
    product_long: str,
    granule: dict,
) -> None:
    """
    Procesa un granule Sentinel-5P:
    1. Extrae mean_value de los atributos.
    2. Obtiene baseline de 30 días.
    3. Calcula anomaly_ratio (1.0 si baseline insuficiente).
    4. Persiste en sentinel_observations.
    5. Si anomaly_ratio > 1.5, publica en stream:sentinel.
    """
    granule_id    = granule.get("Id", "unknown")
    product_short = "NO2" if "NO2" in product_long else "SO2"

    mean_value              = extract_mean_value(granule, zone_name)
    baseline_mean, bl_count = await get_baseline(db, zone_name, product_short)

    # Anomaly ratio
    if mean_value is not None and baseline_mean is not None:
        anomaly_ratio = mean_value / baseline_mean
    else:
        if bl_count < MIN_BASELINE_COUNT:
            log.info(
                "[SENTINEL] Baseline insuficiente para %s (%d registros)",
                zone_name, bl_count,
            )
        anomaly_ratio = 1.0

    now = datetime.now(timezone.utc)

    # Persist
    if db:
        try:
            await db.execute(
                """
                INSERT INTO sentinel_observations
                    (time, zone_id, product, mean_value, baseline_mean,
                     anomaly_ratio, granule_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                now, zone_name, product_short,
                mean_value, baseline_mean, anomaly_ratio, granule_id,
            )
        except Exception as exc:
            log.warning(
                "[SENTINEL] Error persistiendo observación %s/%s: %s",
                zone_name, product_short, exc,
            )

    # Publish to Redis if anomaly detected
    if anomaly_ratio > ANOMALY_THRESHOLD:
        log.info(
            "[SENTINEL] Anomalía %s en %s: ratio=%.2f (baseline=%.4g, mean=%.4g)",
            product_short, zone_name, anomaly_ratio, baseline_mean, mean_value,
        )
        msg = {
            "zone":          zone_name,
            "product":       product_short,
            "anomaly_ratio": round(anomaly_ratio, 4),
            "mean_value":    mean_value,
            "baseline_mean": baseline_mean,
            "granule_id":    granule_id,
            "source":        "sentinel-5p",
        }
        await redis.xadd(
            "stream:sentinel",
            {"data": json.dumps(msg, default=str)},
            maxlen=500,
        )
