import json
import logging
import math

import asyncpg

from tools import db_tools, geo_tools
from .base_agent import BaseAgent

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Eres un analista cuantitativo especializado en la correlación entre eventos geopolíticos
y mercados financieros. Analizas señales técnicas (RSI, MACD, Bollinger, volumen) y las
cruzas con contexto geopolítico para identificar patrones relevantes.
IMPORTANTE: Tus análisis son señales informativas basadas en datos públicos históricos.
No constituyen recomendación de inversión, compra o venta de ningún activo.
El usuario toma sus propias decisiones.

Usa las herramientas disponibles para recopilar datos de la zona y los tickers relevantes.
Cuando hayas completado el análisis, responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "zone": "<nombre de zona>",
  "relevant_tickers": ["<TICKER>"],
  "signals": [
    {
      "ticker": "<TICKER>",
      "technical_score": <float>,
      "direction": "<BULLISH | BEARISH | NEUTRAL>",
      "key_signals": ["<señal técnica>"],
      "geo_correlation": <float 0-1>
    }
  ],
  "market_anomaly_score": <0-10>,
  "summary": "<1-2 frases del hallazgo>",
  "disclaimer": "Señal informativa — no recomendación de inversión"
}\
"""

_TOOLS = [
    {
        "name": "get_tickers_by_zone",
        "description": "Devuelve los tickers del watchlist con relevancia geográfica para una zona.",
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona (clave de zones.yaml)"},
            },
            "required": ["zone"],
        },
    },
    {
        "name": "get_technical_signals",
        "description": "Obtiene las señales técnicas recientes (RSI, MACD, BB, SMA, ATR) de un ticker.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Símbolo del activo (ej: LMT, XOM)"},
                "hours": {"type": "integer", "description": "Horas de historial de señales"},
            },
            "required": ["ticker", "hours"],
        },
    },
    {
        "name": "get_price_history",
        "description": "Obtiene el historial OHLCV de un ticker para los últimos N días.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Símbolo del activo"},
                "days": {"type": "integer", "description": "Días de historial"},
            },
            "required": ["ticker", "days"],
        },
    },
    {
        "name": "get_market_anomalies",
        "description": (
            "Obtiene todos los tickers con señales técnicas anómalas "
            "(|technical_score| >= 6) en las últimas N horas."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "hours": {"type": "integer", "description": "Horas de historial"},
            },
            "required": ["hours"],
        },
    },
    {
        "name": "correlate_geo_with_market",
        "description": (
            "Cruza eventos geopolíticos analizados de una zona con movimientos del ticker "
            "para estimar correlación histórica entre alertas y reacción del mercado."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "zone": {"type": "string", "description": "Nombre de la zona"},
                "ticker": {"type": "string", "description": "Símbolo del activo"},
            },
            "required": ["zone", "ticker"],
        },
    },
]


class MarketAgent(BaseAgent):
    def __init__(self, pool: asyncpg.Pool, zones: dict, watchlist: dict) -> None:
        super().__init__(
            name="market_agent",
            tools=_TOOLS,
            system_prompt=_SYSTEM_PROMPT,
        )
        self.pool = pool
        self.zones = zones
        self.watchlist = watchlist

    # ── Tool implementations ──────────────────────────────────────────────────

    async def _tool_get_tickers_by_zone(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        tickers = geo_tools.get_tickers_for_zone(zone_name, self.watchlist)
        log.info(
            "[AGENT:market] get_tickers_by_zone zone=%s → %d tickers",
            zone_name, len(tickers),
        )
        return json.dumps({"zone": zone_name, "tickers": tickers})

    async def _tool_get_technical_signals(self, tool_input: dict) -> str:
        ticker = tool_input.get("ticker", "")
        hours = int(tool_input.get("hours", 24))
        rows = await db_tools.get_market_signals(self.pool, [ticker], hours)
        log.info(
            "[AGENT:market] get_technical_signals ticker=%s hours=%d → %d señales",
            ticker, hours, len(rows),
        )
        return json.dumps(
            [
                {
                    "time": str(r.get("time")),
                    "ticker": r.get("ticker"),
                    "price": r.get("price"),
                    "rsi": r.get("rsi"),
                    "macd": r.get("macd"),
                    "bb_upper": r.get("bb_upper"),
                    "bb_lower": r.get("bb_lower"),
                    "sma20": r.get("sma20"),
                    "sma50": r.get("sma50"),
                    "sma200": r.get("sma200"),
                    "atr": r.get("atr"),
                    "technical_score": r.get("technical_score"),
                    "signals": r.get("signals"),
                }
                for r in rows
            ],
            default=str,
        )

    async def _tool_get_price_history(self, tool_input: dict) -> str:
        ticker = tool_input.get("ticker", "")
        days = int(tool_input.get("days", 30))
        rows = await self.pool.fetch(
            """
            SELECT time, open, high, low, close, volume, technical_score
            FROM market_prices
            WHERE ticker = $1
              AND time >= NOW() - $2::interval
            ORDER BY time DESC
            LIMIT 200
            """,
            ticker,
            f"{days} days",
        )
        log.info(
            "[AGENT:market] get_price_history ticker=%s days=%d → %d filas",
            ticker, days, len(rows),
        )
        return json.dumps(
            [dict(r) for r in rows],
            default=str,
        )

    async def _tool_get_market_anomalies(self, tool_input: dict) -> str:
        hours = int(tool_input.get("hours", 24))
        # Fetch signals for all watchlist tickers and filter by threshold
        all_tickers: list[str] = []
        for assets in self.watchlist.get("equities", {}).values():
            all_tickers.extend(a["ticker"] for a in assets)
        for idx_entry in self.watchlist.get("indices", []):
            all_tickers.append(idx_entry["ticker"])

        rows = await db_tools.get_market_signals(self.pool, all_tickers, hours)
        anomalies = [
            r for r in rows
            if abs(r.get("technical_score") or 0) >= 6
        ]
        log.info(
            "[AGENT:market] get_market_anomalies hours=%d → %d/%d anomalías",
            hours, len(anomalies), len(rows),
        )
        return json.dumps(
            [
                {
                    "ticker": r.get("ticker"),
                    "technical_score": r.get("technical_score"),
                    "direction": (
                        "BULLISH" if (r.get("technical_score") or 0) > 0
                        else "BEARISH"
                    ),
                    "signals": r.get("signals"),
                    "time": str(r.get("time")),
                }
                for r in anomalies
            ],
            default=str,
        )

    async def _tool_correlate_geo_with_market(self, tool_input: dict) -> str:
        zone_name = tool_input.get("zone", "")
        ticker = tool_input.get("ticker", "")

        # Geo events for the zone (last 90 days, severity >= 5)
        geo_events = await db_tools.get_analyzed_events(
            self.pool, zone_name, hours=90 * 24, min_severity=5
        )

        if not geo_events:
            log.info("[AGENT:market] correlate_geo_with_market zone=%s → sin eventos geo", zone_name)
            return json.dumps({"correlation": None, "reason": "no geopolitical events in DB"})

        # Price history for the same window
        price_rows = await self.pool.fetch(
            """
            SELECT time, close
            FROM market_prices
            WHERE ticker = $1
              AND time >= NOW() - INTERVAL '90 days'
            ORDER BY time
            """,
            ticker,
        )

        if len(price_rows) < 5:
            return json.dumps({"correlation": None, "reason": "insufficient price history"})

        # Build a price map: date → close
        price_by_date: dict[str, float] = {}
        for row in price_rows:
            date_key = str(row["time"])[:10]
            price_by_date[date_key] = float(row["close"])

        price_dates = sorted(price_by_date.keys())

        # For each geo event, check if price moved > 1% in the following 2 trading days
        significant_moves = 0
        events_with_price = 0
        for event in geo_events:
            event_date = str(event.get("time", ""))[:10]
            if not event_date:
                continue
            # Find next available price date after the event
            future_dates = [d for d in price_dates if d > event_date]
            if len(future_dates) < 2:
                continue
            next_close = price_by_date.get(future_dates[0])
            later_close = price_by_date.get(future_dates[1])
            prev_dates = [d for d in price_dates if d <= event_date]
            if not prev_dates or next_close is None or later_close is None:
                continue
            base_close = price_by_date.get(prev_dates[-1])
            if not base_close or base_close == 0:
                continue
            events_with_price += 1
            move = abs(later_close - base_close) / base_close
            if move >= 0.01:
                significant_moves += 1

        correlation = (
            round(significant_moves / events_with_price, 3)
            if events_with_price > 0 else None
        )
        log.info(
            "[AGENT:market] correlate_geo_with_market zone=%s ticker=%s → corr=%s (%d/%d eventos)",
            zone_name, ticker, correlation, significant_moves, events_with_price,
        )
        return json.dumps(
            {
                "zone": zone_name,
                "ticker": ticker,
                "geo_events_analyzed": events_with_price,
                "significant_market_moves": significant_moves,
                "correlation": correlation,
                "interpretation": (
                    "high" if (correlation or 0) >= 0.5
                    else "medium" if (correlation or 0) >= 0.25
                    else "low"
                ),
            }
        )
