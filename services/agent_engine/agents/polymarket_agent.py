import json
import logging

import asyncpg

from tools import db_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista especializado en mercados de predicción.
Interpretas los precios de Polymarket como probabilidades implícitas del mercado sobre
eventos futuros. Detectas movimientos significativos que pueden indicar que el mercado
está procesando nueva información antes de que aparezca en los medios convencionales.
IMPORTANTE: Las probabilidades de Polymarket reflejan la opinión agregada del mercado,
no son predicciones garantizadas. Son una señal informativa más.

Usa las herramientas disponibles para recopilar datos de la zona indicada.
Cuando hayas completado el análisis, responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "zone": "<nombre de zona>",
  "active_markets": <int>,
  "significant_moves": [
    {
      "question": "<pregunta del mercado>",
      "current_probability": <float 0-1>,
      "change_24h": <float o null>,
      "signal_type": "<MOMENTUM | STRONG_MOVE | EXTREME_HIGH | EXTREME_LOW>",
      "volume_24h": <float>
    }
  ],
  "market_sentiment": "<bullish_conflict | deescalation | neutral>",
  "polymarket_score": <0-10>,
  "summary": "<1-2 frases del hallazgo>",
  "disclaimer": "Probabilidades implícitas del mercado de predicción"
}\
"""

# Umbral para considerar un mercado de "alta convicción"
_DEFAULT_CONVICTION_THRESHOLD = 0.70

_TOOLS = [
    {
        "name": "get_active_markets_by_zone",
        "description": (
            "Obtiene señales recientes de Polymarket para una zona geopolítica, "
            "incluyendo probabilidades actuales y cambios detectados."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona (clave de zones.yaml)"},
                "hours": {"type": "integer", "description": "Horas de historial"},
            },
            "required": ["zone", "hours"],
        },
    },
    {
        "name": "get_probability_changes",
        "description": (
            "Obtiene los mercados de Polymarket de la zona ordenados por magnitud "
            "de cambio en 24h (más volátiles primero)."
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
        "name": "get_high_conviction_markets",
        "description": (
            "Obtiene mercados donde la probabilidad supera un umbral alto o está "
            "por debajo de (1 - umbral), indicando alta convicción del mercado."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "threshold": {
                    "type": "number",
                    "description": (
                        "Umbral de convicción (default 0.70). "
                        "Devuelve mercados con p > threshold o p < (1 - threshold)."
                    ),
                },
                "hours": {"type": "integer", "description": "Horas de historial"},
                "zone": {
                    "type": "string",
                    "description": "Zona opcional para filtrar (vacío = todas las zonas)",
                },
            },
            "required": ["hours"],
        },
    },
]


class PolymarketAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool, zones: dict) -> None:
        super().__init__(
            name="polymarket_agent",
            tools=_TOOLS,
            system_prompt=_SYSTEM_PROMPT,
        )
        self.pool = pool
        self.zones = zones

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _sentiment_label(self, rows: list[dict]) -> str:
        """Classify overall market sentiment from a batch of signals."""
        if not rows:
            return "neutral"
        high_prob = sum(
            1 for r in rows if (r.get("yes_price") or 0) >= 0.60
        )
        low_prob = sum(
            1 for r in rows if (r.get("yes_price") or 0) <= 0.40
        )
        strong_moves_up = sum(
            1 for r in rows
            if (r.get("change_24h") or 0) >= 0.10
        )
        strong_moves_down = sum(
            1 for r in rows
            if (r.get("change_24h") or 0) <= -0.10
        )
        if high_prob > low_prob and strong_moves_up >= 1:
            return "bullish_conflict"
        if low_prob > high_prob and strong_moves_down >= 1:
            return "deescalation"
        return "neutral"

    def _format_row(self, r: dict) -> dict:
        return {
            "market_id": r.get("market_id"),
            "question": r.get("question"),
            "category": r.get("category"),
            "yes_price": r.get("yes_price"),
            "change_1h": r.get("change_1h"),
            "change_24h": r.get("change_24h"),
            "signal_type": r.get("signal_type"),
            "volume": r.get("volume"),
            "zones": r.get("zones"),
            "time": str(r.get("time")),
            "end_date": str(r.get("end_date")) if r.get("end_date") else None,
        }

    # ── Tool implementations ──────────────────────────────────────────────────

    async def _tool_get_active_markets_by_zone(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 24))
        rows = await db_tools.get_polymarket_signals(self.pool, zone_name, hours)
        log.info(
            "[AGENT:polymarket] get_active_markets_by_zone zone=%s hours=%d → %d señales",
            zone_name, hours, len(rows),
        )
        return json.dumps([self._format_row(r) for r in rows], default=str)

    async def _tool_get_probability_changes(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        hours = int(tool_input.get("hours", 24))
        rows = await db_tools.get_polymarket_signals(self.pool, zone_name, hours)

        # Sort by absolute 24h change descending
        rows_with_change = [r for r in rows if r.get("change_24h") is not None]
        rows_with_change.sort(
            key=lambda r: abs(r.get("change_24h") or 0),
            reverse=True,
        )

        log.info(
            "[AGENT:polymarket] get_probability_changes zone=%s → %d señales con Δ24h",
            zone_name, len(rows_with_change),
        )
        return json.dumps(
            [self._format_row(r) for r in rows_with_change[:20]],
            default=str,
        )

    async def _tool_get_high_conviction_markets(self, tool_input: dict) -> str:
        threshold = float(tool_input.get("threshold", _DEFAULT_CONVICTION_THRESHOLD))
        hours = int(tool_input.get("hours", 24))
        zone_name = tool_input.get("zone", "")

        rows = await db_tools.get_polymarket_signals(self.pool, zone_name, hours)

        # If no zone specified, fetch a broader set by querying without zone filter
        if not zone_name:
            rows = await self.pool.fetch(
                """
                SELECT time, market_id, question, category, yes_price,
                       prev_1h_price, prev_24h_price, change_1h, change_24h,
                       signal_type, zones, volume, end_date
                FROM polymarket_signals
                WHERE time >= NOW() - $1::interval
                ORDER BY time DESC
                LIMIT 200
                """,
                f"{hours} hours",
            )
            rows = [dict(r) for r in rows]

        high_conviction = [
            r for r in rows
            if (r.get("yes_price") or 0) >= threshold
            or (r.get("yes_price") or 1) <= (1 - threshold)
        ]
        high_conviction.sort(
            key=lambda r: abs((r.get("yes_price") or 0.5) - 0.5),
            reverse=True,
        )

        log.info(
            "[AGENT:polymarket] get_high_conviction_markets threshold=%.2f → %d mercados",
            threshold, len(high_conviction),
        )
        return json.dumps(
            [self._format_row(r) for r in high_conviction[:20]],
            default=str,
        )
