import json
import logging

import asyncpg

from tools import db_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista marítimo GLOBAL. Analizas las últimas 8h de tráfico AIS mundial
para detectar: concentraciones de buques militares, buques con AIS desactivado
(dark), movimientos anómalos de tankers en chokepoints.

Tienes `previous_findings` de ciclos anteriores para evaluar continuidad y escalada.

Usa las herramientas disponibles. Al terminar responde ÚNICAMENTE con JSON:
{
  "anomaly_score": <0-10>,
  "total_military_vessels": <int>,
  "total_ais_dark": <int>,
  "military_hotspots": [{"area": "<geografía>", "count": <int>}],
  "ais_dark_events": [{"mmsi": "...", "name": "...", "last_zone": "..."}],
  "notable_vessels": ["<nombre o MMSI>"],
  "delta_vs_previous_cycles": "<aumenta|estable|disminuye|n/a>",
  "summary": "<2-3 frases>"
}\
"""

_TOOLS = [
    {
        "name": "get_vessels_global",
        "description": "Devuelve buques con categorías dadas (default military) en las últimas N horas a escala global.",
        "input_schema": {
            "type": "object",
            "properties": {
                "hours": {"type": "integer"},
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Categorías a incluir (military, tanker, cargo...). Default: [military].",
                },
            },
            "required": ["hours"],
        },
    },
    {
        "name": "get_ais_dark_global",
        "description": "Devuelve buques con AIS desactivado en las últimas N horas a escala global.",
        "input_schema": {
            "type": "object",
            "properties": {"hours": {"type": "integer"}},
            "required": ["hours"],
        },
    },
]


class MaritimeAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool) -> None:
        super().__init__(name="maritime_agent", tools=_TOOLS, system_prompt=_SYSTEM_PROMPT)
        self.pool = pool

    async def _tool_get_vessels_global(self, tool_input: dict) -> str:
        hours = int(tool_input.get("hours", 8))
        categories = tool_input.get("categories") or ["military"]
        rows = await db_tools.get_vessel_history_global(self.pool, hours, categories=categories)
        by_cat: dict[str, int] = {}
        by_flag: dict[str, int] = {}
        for r in rows:
            by_cat[r.get("category") or "unknown"] = by_cat.get(r.get("category") or "unknown", 0) + 1
            by_flag[r.get("flag") or "UNK"] = by_flag.get(r.get("flag") or "UNK", 0) + 1
        log.info("[AGENT:maritime] global hours=%d categories=%s → %d", hours, categories, len(rows))
        return json.dumps({
            "total": len(rows),
            "by_category": by_cat,
            "top_flags": sorted(by_flag.items(), key=lambda x: -x[1])[:20],
            "sample": rows[:40],
        }, default=str)

    async def _tool_get_ais_dark_global(self, tool_input: dict) -> str:
        hours = int(tool_input.get("hours", 8))
        rows = await db_tools.get_ais_dark_events_global(self.pool, hours)
        log.info("[AGENT:maritime] ais_dark_global → %d", len(rows))
        return json.dumps({"count": len(rows), "events": rows[:30]}, default=str)
