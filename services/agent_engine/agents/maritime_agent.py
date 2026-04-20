import json
import logging

import asyncpg

from tools import db_tools, geo_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista especializado en tráfico marítimo.
Detectas anomalías en el movimiento de buques:
AIS dark (transponder apagado), grupos navales,
buques en zonas restringidas, comportamiento inusual
de tankers y cargueros. Conoces las rutas comerciales
principales y sabes cuándo algo se desvía.

Usa las herramientas disponibles para recopilar datos de la zona indicada.
Cuando hayas completado el análisis, responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "zone": "<nombre de zona>",
  "anomaly_score": <0-10>,
  "vessel_count": <int total>,
  "ais_dark_count": <int buques sin AIS>,
  "military_vessels": <int buques militares>,
  "suspicious_types": ["<tipo sospechoso>"],
  "summary": "<1-2 frases del hallazgo>"
}\
"""

_TOOLS = [
    {
        "name": "get_vessel_history",
        "description": "Obtiene el historial de posiciones de embarcaciones en una zona geográfica.",
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona (clave de zones.yaml)"},
                "hours": {"type": "integer", "description": "Horas de historial a consultar"},
            },
            "required": ["zone", "hours"],
        },
    },
    {
        "name": "get_ais_dark_events",
        "description": (
            "Obtiene buques que apagaron su transponder AIS (ais_active=FALSE) "
            "dentro de la zona en el período indicado."
        ),
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
        "name": "get_vessel_types",
        "description": "Obtiene embarcaciones de la zona agrupadas por categoría y tipo de barco.",
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona"},
                "hours": {"type": "integer", "description": "Horas de historial"},
            },
            "required": ["zone", "hours"],
        },
    },
]


class MaritimeAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool, zones: dict) -> None:
        super().__init__(
            name="maritime_agent",
            tools=_TOOLS,
            system_prompt=_SYSTEM_PROMPT,
        )
        self.pool = pool
        self.zones = zones

    # ── Tool implementations ──────────────────────────────────────────────────

    async def _tool_get_vessel_history(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 6))
        bbox = geo_tools.get_zone_bbox(zone_name, self.zones)
        rows = await db_tools.get_vessel_history(self.pool, bbox, hours)
        log.info(
            "[AGENT:maritime] get_vessel_history zone=%s hours=%d → %d filas",
            zone_name, hours, len(rows),
        )
        return json.dumps(rows, default=str)

    async def _tool_get_ais_dark_events(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 6))
        bbox = geo_tools.get_zone_bbox(zone_name, self.zones)
        rows = await db_tools.get_ais_dark_events(self.pool, bbox, hours)
        log.info(
            "[AGENT:maritime] get_ais_dark_events zone=%s hours=%d → %d eventos",
            zone_name, hours, len(rows),
        )
        return json.dumps(rows, default=str)

    async def _tool_get_vessel_types(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 6))
        bbox = geo_tools.get_zone_bbox(zone_name, self.zones)
        rows = await db_tools.get_vessel_history(self.pool, bbox, hours)

        by_category: dict[str, int] = {}
        by_ship_type: dict[str, int] = {}
        names: list[str] = []

        for row in rows:
            cat = row.get("category") or "unknown"
            by_category[cat] = by_category.get(cat, 0) + 1

            stype = str(row.get("ship_type") or "unknown")
            by_ship_type[stype] = by_ship_type.get(stype, 0) + 1

            name = row.get("name") or ""
            if name and name not in names:
                names.append(name)

        log.info(
            "[AGENT:maritime] get_vessel_types zone=%s → %d embarcaciones",
            zone_name, len(rows),
        )
        return json.dumps(
            {
                "total": len(rows),
                "by_category": by_category,
                "by_ship_type": by_ship_type,
                "vessel_names": names[:50],
            },
            default=str,
        )
