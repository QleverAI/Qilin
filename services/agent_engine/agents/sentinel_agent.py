import json
import logging
import statistics

import asyncpg

from tools import db_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista especializado en teledetección satelital.
Interpretas datos de emisiones de NO₂ y SO₂ del satélite Sentinel-5P de la ESA.
Detectas anomalías que pueden indicar actividad industrial inusual, operaciones
militares intensas, o cambios en infraestructura energética.
Conoces los niveles baseline típicos por tipo de zona y sabes cuándo una anomalía
es significativa. Un ratio ≥ 1.5 sobre el baseline es el umbral de alerta.

Usa las herramientas disponibles para analizar las emisiones de la zona indicada.
Cuando hayas completado el análisis, responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "zone": "<nombre de zona>",
  "has_data": <bool>,
  "anomaly_detected": <bool>,
  "anomaly_ratio": <float, 1.0=normal>,
  "product": "<NO2 | SO2 | both | none>",
  "latest_reading": <float o null>,
  "baseline_mean": <float o null>,
  "summary": "<1-2 frases del hallazgo>"
}\
"""

_ANOMALY_THRESHOLD = 1.5
_BASELINE_DAYS = 30

_TOOLS = [
    {
        "name": "get_sentinel_data",
        "description": (
            "Obtiene observaciones recientes de Sentinel-5P (NO₂/SO₂) para una zona. "
            "Incluye mean_value, max_value, anomaly_ratio y granule_id."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "ID de zona (clave de zones.yaml)"},
                "hours": {"type": "integer", "description": "Horas de historial a consultar"},
            },
            "required": ["zone", "hours"],
        },
    },
    {
        "name": "get_sentinel_baseline",
        "description": (
            "Obtiene observaciones de Sentinel-5P de los últimos N días y calcula "
            "estadísticas baseline: media, mediana, desviación estándar y percentil 95."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "ID de zona"},
                "days": {
                    "type": "integer",
                    "description": f"Días de historial para el baseline (default {_BASELINE_DAYS})",
                },
                "product": {
                    "type": "string",
                    "description": "Producto a analizar: 'NO2', 'SO2' o vacío para ambos",
                },
            },
            "required": ["zone"],
        },
    },
    {
        "name": "detect_emission_anomaly",
        "description": (
            f"Compara las emisiones de las últimas 24h con el baseline de {_BASELINE_DAYS} días "
            f"y determina si el ratio supera el umbral de {_ANOMALY_THRESHOLD}x. "
            "Analiza NO₂ y SO₂ por separado."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "ID de zona"},
            },
            "required": ["zone"],
        },
    },
]


class SentinelAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool, zones: dict) -> None:
        super().__init__(
            name="sentinel_agent",
            tools=_TOOLS,
            system_prompt=_SYSTEM_PROMPT,
        )
        self.pool = pool
        self.zones = zones

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _baseline_stats(self, values: list[float]) -> dict:
        if not values:
            return {"mean": None, "median": None, "stdev": None, "p95": None, "count": 0}
        sorted_vals = sorted(values)
        p95_idx = max(0, int(len(sorted_vals) * 0.95) - 1)
        return {
            "mean": round(statistics.mean(values), 6),
            "median": round(statistics.median(values), 6),
            "stdev": round(statistics.stdev(values), 6) if len(values) > 1 else 0.0,
            "p95": round(sorted_vals[p95_idx], 6),
            "count": len(values),
        }

    # ── Tool implementations ──────────────────────────────────────────────────

    async def _tool_get_sentinel_data(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 48))
        rows = await db_tools.get_sentinel_data(self.pool, zone_name, hours)
        log.info(
            "[AGENT:sentinel] get_sentinel_data zone=%s hours=%d → %d observaciones",
            zone_name, hours, len(rows),
        )
        return json.dumps(
            [
                {
                    "time": str(r.get("time")),
                    "product": r.get("product"),
                    "mean_value": r.get("mean_value"),
                    "max_value": r.get("max_value"),
                    "p95_value": r.get("p95_value"),
                    "baseline_mean": r.get("baseline_mean"),
                    "anomaly_ratio": r.get("anomaly_ratio"),
                    "granule_id": r.get("granule_id"),
                }
                for r in rows
            ],
            default=str,
        )

    async def _tool_get_sentinel_baseline(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        days = int(tool_input.get("days", _BASELINE_DAYS))
        product_filter = (tool_input.get("product") or "").upper()
        hours = days * 24

        rows = await db_tools.get_sentinel_data(self.pool, zone_name, hours)

        if product_filter in ("NO2", "SO2"):
            rows = [r for r in rows if r.get("product") == product_filter]

        by_product: dict[str, list[float]] = {}
        for row in rows:
            prod = row.get("product") or "UNKNOWN"
            val = row.get("mean_value")
            if val is not None:
                by_product.setdefault(prod, []).append(float(val))

        result: dict = {"zone": zone_name, "days": days, "products": {}}
        for prod, vals in by_product.items():
            result["products"][prod] = self._baseline_stats(vals)

        log.info(
            "[AGENT:sentinel] get_sentinel_baseline zone=%s days=%d → %s",
            zone_name, days,
            {p: v["count"] for p, v in result["products"].items()},
        )
        return json.dumps(result)

    async def _tool_detect_emission_anomaly(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")

        recent_rows = await db_tools.get_sentinel_data(self.pool, zone_name, hours=24)
        baseline_rows = await db_tools.get_sentinel_data(
            self.pool, zone_name, hours=_BASELINE_DAYS * 24
        )

        results_by_product: dict[str, dict] = {}

        for product in ("NO2", "SO2"):
            recent = [
                float(r["mean_value"])
                for r in recent_rows
                if r.get("product") == product and r.get("mean_value") is not None
            ]
            baseline = [
                float(r["mean_value"])
                for r in baseline_rows
                if r.get("product") == product and r.get("mean_value") is not None
            ]

            if not recent:
                results_by_product[product] = {"has_data": False}
                continue

            recent_mean = statistics.mean(recent)
            baseline_mean = statistics.mean(baseline) if baseline else None

            if baseline_mean and baseline_mean > 0:
                ratio = recent_mean / baseline_mean
                anomaly = ratio >= _ANOMALY_THRESHOLD
            else:
                ratio = None
                anomaly = False

            results_by_product[product] = {
                "has_data": True,
                "recent_mean": round(recent_mean, 6),
                "baseline_mean": round(baseline_mean, 6) if baseline_mean else None,
                "ratio": round(ratio, 3) if ratio is not None else None,
                "anomaly_detected": anomaly,
                "threshold": _ANOMALY_THRESHOLD,
            }

        anomalous_products = [
            p for p, v in results_by_product.items()
            if v.get("anomaly_detected")
        ]

        log.info(
            "[AGENT:sentinel] detect_emission_anomaly zone=%s → anomalous=%s",
            zone_name, anomalous_products,
        )
        return json.dumps(
            {
                "zone": zone_name,
                "by_product": results_by_product,
                "anomalous_products": anomalous_products,
                "overall_anomaly": len(anomalous_products) > 0,
            }
        )
