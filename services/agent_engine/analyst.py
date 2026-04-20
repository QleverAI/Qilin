import asyncio
import json
import logging
import re
import time
import uuid
from datetime import datetime, timezone

import anthropic
import asyncpg

from tools import db_tools

log = logging.getLogger(__name__)

_MODEL = "claude-sonnet-4-6"
_TIMEOUT_SECONDS = 60
_MAX_TOKENS = 2048

_SYSTEM_PROMPT = """\
Eres un analista de inteligencia senior con experiencia en geopolítica, operaciones
militares, mercados financieros y análisis de riesgo. Sintetizas señales de múltiples
fuentes para determinar si representan un evento significativo.
Sé conciso y preciso. Distingue entre correlación y causalidad.
Indica siempre tu nivel de confianza.
Si los datos son insuficientes, indícalo explícitamente en lugar de especular.
Los análisis de mercado y Polymarket son señales informativas, no recomendaciones
de inversión ni de apuesta.\
"""

_OUTPUT_SCHEMA = """\
{
  "event_id": "<UUID proporcionado>",
  "timestamp": "<ISO8601 UTC>",
  "zone": "<nombre de zona>",
  "event_type": "<MILITARY|MARITIME|MARKET|ENVIRONMENTAL|COMBINED>",
  "severity": <entero 1-10>,
  "confidence": "<HIGH|MEDIUM|LOW>",
  "headline": "<una línea máximo — qué está pasando>",
  "summary": "<3-4 párrafos de análisis estructurado>",
  "signals_used": ["<nombre_agente>"],
  "market_implications": {
    "affected_tickers": ["<TICKER>"],
    "direction": "<BULLISH|BEARISH|NEUTRAL>",
    "reasoning": "<por qué afecta a esos tickers>",
    "confidence": "<HIGH|MEDIUM|LOW>",
    "disclaimer": "Señal informativa — no recomendación de inversión"
  },
  "polymarket_implications": {
    "related_markets": ["<pregunta de mercado>"],
    "probability_shift": "<UP|DOWN|STABLE>",
    "reasoning": "<por qué se mueve el mercado>",
    "disclaimer": "Probabilidad implícita del mercado de predicción"
  },
  "recommended_action": "<ALERT|MONITOR|IGNORE>",
  "tags": ["<etiqueta>"]
}

Reglas para severity:
  9-10: evento activo con impacto inmediato confirmado
  7-8:  señal fuerte con múltiples fuentes correlacionadas
  5-6:  señal moderada, pocas fuentes o baja confianza
  3-4:  ruido, sin correlación entre fuentes
  1-2:  sin señal real, contexto normal

Si market_implications no aplica, usa null.
Si polymarket_implications no aplica, usa null.\
"""

# Strip markdown code fences if the LLM wraps its JSON
_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _clean_json(text: str) -> str:
    return _CODE_FENCE_RE.sub("", text).strip()


class Analyst:
    def __init__(self, pool: asyncpg.Pool | None) -> None:
        self.pool = pool
        self.client = anthropic.AsyncAnthropic()

    async def analyze(
        self, event: dict, agent_results: list[dict]
    ) -> dict | None:
        start_ms = int(time.monotonic() * 1000)
        event_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        user_prompt = (
            "Analiza estos resultados de señales múltiples y produce un análisis "
            "de inteligencia estructurado.\n\n"
            f"EVENT_ID a usar: {event_id}\n\n"
            "EVENTO ORIGEN:\n"
            f"{json.dumps(event, default=str, ensure_ascii=False)}\n\n"
            "RESULTADOS DE AGENTES:\n"
            f"{json.dumps(agent_results, default=str, ensure_ascii=False)}\n\n"
            "Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:\n"
            f"{_OUTPUT_SCHEMA}"
        )

        log.info(
            "[ANALYST] Iniciando análisis event_id=%s agentes=%s",
            event_id,
            [r.get("agent_name") for r in agent_results],
        )

        try:
            response = await asyncio.wait_for(
                self.client.messages.create(
                    model=_MODEL,
                    max_tokens=_MAX_TOKENS,
                    system=_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_prompt}],
                ),
                timeout=_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            log.error("[ANALYST] Timeout (%ds) al llamar a la API", _TIMEOUT_SECONDS)
            return None
        except Exception as exc:
            log.error("[ANALYST] Error de API: %s", exc)
            return None

        raw_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw_text = block.text
                break

        try:
            analysis = json.loads(_clean_json(raw_text))
        except (json.JSONDecodeError, ValueError) as exc:
            log.error(
                "[ANALYST] JSON inválido del LLM: %s — texto raw: %.300s",
                exc, raw_text,
            )
            return None

        processing_ms = int(time.monotonic() * 1000) - start_ms
        log.info(
            "[ANALYST] Análisis completado event_id=%s severity=%s confidence=%s action=%s (%dms)",
            event_id,
            analysis.get("severity"),
            analysis.get("confidence"),
            analysis.get("recommended_action"),
            processing_ms,
        )

        # Persist to analyzed_events
        if self.pool:
            try:
                db_record = {
                    "time": datetime.now(timezone.utc),
                    "zone": analysis.get("zone") or event.get("zone", ""),
                    "event_type": analysis.get("event_type"),
                    "severity": analysis.get("severity"),
                    "confidence": analysis.get("confidence"),
                    "headline": analysis.get("headline"),
                    "summary": analysis.get("summary"),
                    "signals_used": analysis.get("signals_used") or [],
                    "market_implications": analysis.get("market_implications"),
                    "polymarket_implications": analysis.get("polymarket_implications"),
                    "recommended_action": analysis.get("recommended_action"),
                    "tags": analysis.get("tags") or [],
                    "raw_input": event,
                    "processing_time_ms": processing_ms,
                }
                saved_id = await db_tools.save_analyzed_event(self.pool, db_record)
                analysis["_db_id"] = saved_id
                log.info("[ANALYST] Persistido en analyzed_events id=%d", saved_id)
            except Exception as exc:
                log.warning("[ANALYST] Error al persistir en DB: %s", exc)

        return analysis
