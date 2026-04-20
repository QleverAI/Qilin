import json
import logging

import asyncpg

from tools import db_tools, geo_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista especializado en tráfico aéreo militar.
Analizas patrones de vuelo de aeronaves militares para detectar actividad inusual.
Conoces los tipos de misiones por callsign y tipo de aeronave: patrullas ASW, AWACS,
reabastecimiento, transporte estratégico, cazas.
Cuando ves datos, buscas anomalías respecto al baseline histórico.
Eres conciso y preciso.

Usa las herramientas disponibles para recopilar datos de la zona indicada.
Cuando hayas completado el análisis, responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "zone": "<nombre de zona>",
  "anomaly_score": <0-10>,
  "aircraft_count": <int total>,
  "military_count": <int militares>,
  "notable_types": ["<tipo/callsign>"],
  "baseline_comparison": "<normal | +XX% sobre baseline | sin datos baseline>",
  "summary": "<1-2 frases del hallazgo>"
}\
"""

_TOOLS = [
    {
        "name": "get_aircraft_history",
        "description": "Obtiene el historial de posiciones de aeronaves en una zona geográfica.",
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona (clave de zones.yaml)"},
                "hours": {"type": "integer", "description": "Horas de historial a consultar"},
                "military_only": {"type": "boolean", "description": "Si true, solo aeronaves militares"},
            },
            "required": ["zone", "hours"],
        },
    },
    {
        "name": "get_aircraft_types",
        "description": "Obtiene aeronaves de la zona agrupadas por categoría y callsign.",
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona"},
                "hours": {"type": "integer", "description": "Horas de historial"},
            },
            "required": ["zone", "hours"],
        },
    },
    {
        "name": "compare_with_baseline",
        "description": (
            "Compara la actividad aérea militar de las últimas 24h con el baseline "
            "de los últimos N días para detectar desviaciones."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona"},
                "days_baseline": {
                    "type": "integer",
                    "description": "Días de baseline a usar (default 7)",
                },
            },
            "required": ["zone"],
        },
    },
]


class AdsbAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool, zones: dict) -> None:
        super().__init__(
            name="adsb_agent",
            tools=_TOOLS,
            system_prompt=_SYSTEM_PROMPT,
        )
        self.pool = pool
        self.zones = zones

    # ── Tool implementations ──────────────────────────────────────────────────

    async def _tool_get_aircraft_history(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 6))
        military_only = bool(tool_input.get("military_only", True))
        bbox = geo_tools.get_zone_bbox(zone_name, self.zones)
        rows = await db_tools.get_aircraft_history(self.pool, bbox, hours, military_only)
        log.info(
            "[AGENT:adsb] get_aircraft_history zone=%s hours=%d military=%s → %d filas",
            zone_name, hours, military_only, len(rows),
        )
        return json.dumps(rows, default=str)

    async def _tool_get_aircraft_types(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 6))
        bbox = geo_tools.get_zone_bbox(zone_name, self.zones)
        rows = await db_tools.get_aircraft_history(self.pool, bbox, hours, military_only=False)

        by_category: dict[str, int] = {}
        callsigns: list[str] = []
        for row in rows:
            cat = row.get("category") or "unknown"
            by_category[cat] = by_category.get(cat, 0) + 1
            cs = row.get("callsign") or ""
            if cs and cs not in callsigns:
                callsigns.append(cs)

        log.info("[AGENT:adsb] get_aircraft_types zone=%s → %d aeronaves", zone_name, len(rows))
        return json.dumps(
            {
                "total": len(rows),
                "by_category": by_category,
                "callsigns": callsigns[:60],
            },
            default=str,
        )

    async def _tool_compare_with_baseline(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        days_baseline = int(tool_input.get("days_baseline", 7))
        bbox = geo_tools.get_zone_bbox(zone_name, self.zones)

        today_rows = await db_tools.get_aircraft_history(self.pool, bbox, 24, military_only=True)
        today_count = len(today_rows)

        baseline_rows = await db_tools.get_aircraft_history(
            self.pool, bbox, days_baseline * 24, military_only=True
        )
        baseline_avg = len(baseline_rows) / days_baseline if days_baseline > 0 else 0

        if baseline_avg > 0:
            ratio = today_count / baseline_avg
            assessment = (
                "normal"
                if ratio < 1.3
                else f"+{int((ratio - 1) * 100)}% sobre baseline"
            )
        else:
            ratio = None
            assessment = "sin datos baseline"

        log.info(
            "[AGENT:adsb] compare_with_baseline zone=%s today=%d baseline_avg=%.1f ratio=%s",
            zone_name, today_count, baseline_avg, ratio,
        )
        return json.dumps(
            {
                "today_count": today_count,
                "baseline_avg_per_day": round(baseline_avg, 1),
                "ratio": round(ratio, 2) if ratio is not None else None,
                "assessment": assessment,
                "days_used": days_baseline,
            }
        )
