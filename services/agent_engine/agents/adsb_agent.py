import json
import logging

import asyncpg

from tools import db_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista especializado en tráfico aéreo militar GLOBAL.
Analizas patrones de vuelo de aeronaves militares en las últimas 8 horas a escala mundial
para detectar actividad inusual: patrullas ASW, AWACS, reabastecimiento, transporte
estratégico, cazas, actividad concentrada en zonas sensibles.

Tienes tus propios findings de ciclos anteriores (`previous_findings`) para detectar
escalada/desescalada respecto a los 3 últimos ciclos (≤24h).

Usa las herramientas para recopilar datos. No estás limitado a una zona.
Cuando hayas completado el análisis, responde ÚNICAMENTE con JSON:
{
  "anomaly_score": <0-10>,
  "total_military_aircraft": <int>,
  "hotspots": [{"area": "<descripción geográfica>", "count": <int>, "notable": ["<callsign|tipo>"]}],
  "notable_callsigns": ["<callsign>"],
  "baseline_comparison": "<normal | +XX% sobre baseline | sin datos>",
  "delta_vs_previous_cycles": "<aumenta | estable | disminuye | n/a>",
  "summary": "<2-3 frases del hallazgo global>"
}\
"""

_TOOLS = [
    {
        "name": "get_military_aircraft_global",
        "description": "Devuelve aeronaves militares de las últimas N horas a escala global.",
        "input_schema": {
            "type": "object",
            "properties": {
                "hours": {"type": "integer", "description": "Ventana de horas (default 8)"},
            },
            "required": ["hours"],
        },
    },
    {
        "name": "compare_with_baseline_global",
        "description": "Compara total de aeronaves militares hoy vs baseline de N días.",
        "input_schema": {
            "type": "object",
            "properties": {
                "days_baseline": {"type": "integer", "description": "Días (default 7)"},
            },
        },
    },
]


class AdsbAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool) -> None:
        super().__init__(
            name="adsb_agent",
            tools=_TOOLS,
            system_prompt=_SYSTEM_PROMPT,
        )
        self.pool = pool

    async def _tool_get_military_aircraft_global(self, tool_input: dict) -> str:
        hours = int(tool_input.get("hours", 8))
        rows = await db_tools.get_aircraft_history_global(self.pool, hours, military_only=True)
        by_country: dict[str, int] = {}
        by_callsign: dict[str, int] = {}
        for r in rows:
            c = r.get("origin_country") or "UNK"
            by_country[c] = by_country.get(c, 0) + 1
            cs = (r.get("callsign") or "").strip()
            if cs:
                by_callsign[cs] = by_callsign.get(cs, 0) + 1
        log.info("[AGENT:adsb] global hours=%d → %d filas", hours, len(rows))
        return json.dumps({
            "total": len(rows),
            "by_country": by_country,
            "top_callsigns": sorted(by_callsign.items(), key=lambda x: -x[1])[:30],
        }, default=str)

    async def _tool_compare_with_baseline_global(self, tool_input: dict) -> str:
        days_baseline = int(tool_input.get("days_baseline", 7))
        today_rows = await db_tools.get_aircraft_history_global(self.pool, 24, military_only=True, limit=5000)
        baseline_rows = await db_tools.get_aircraft_history_global(
            self.pool, days_baseline * 24, military_only=True, limit=20000,
        )
        today_count = len(today_rows)
        baseline_avg = len(baseline_rows) / days_baseline if days_baseline > 0 else 0
        if baseline_avg > 0:
            ratio = today_count / baseline_avg
            assessment = "normal" if ratio < 1.3 else f"+{int((ratio - 1) * 100)}% sobre baseline"
        else:
            ratio = None
            assessment = "sin datos baseline"
        return json.dumps({
            "today_count": today_count,
            "baseline_avg_per_day": round(baseline_avg, 1),
            "ratio": round(ratio, 2) if ratio is not None else None,
            "assessment": assessment,
        })
