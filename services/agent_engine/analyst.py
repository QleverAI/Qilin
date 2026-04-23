import asyncio
import json
import logging
import time
from datetime import datetime, timezone

import anthropic
import asyncpg

from tools import db_tools
from cost_tracker import track_spend
from json_utils import clean_json as _clean_json

log = logging.getLogger(__name__)

_MODEL = "claude-haiku-4-5-20251001"
_TIMEOUT_SECONDS = 120
_MAX_TOKENS = 3072

_SYSTEM_PROMPT = """\
Eres un analista de inteligencia senior que supervisa un equipo de agentes
especialistas (adsb, maritime, news, social). Cada 8 horas recibes:
- los findings frescos de los agentes del ciclo actual
- tus análisis previos de los últimos 3 ciclos (`previous_analyses`, 24h)
- findings propios recientes de cada agente con anomaly_score ≥ 5

Tu trabajo: sintetizar en un único análisis de panorama global. Detecta correlaciones
entre dominios (ej: news ↑ en zona X + adsb hotspot militar en X = escalada) y
continuidad entre ciclos (ej: "tercer ciclo consecutivo con findings elevados en X").

Sé conciso, distingue correlación de causalidad, indica confianza.
Si los datos son insuficientes, dilo explícitamente.\
"""

_OUTPUT_SCHEMA = """\
{
  "cycle_id": "<UUID del ciclo>",
  "timestamp": "<ISO8601 UTC>",
  "zone": "<zona principal afectada o 'GLOBAL'>",
  "event_type": "<MILITARY|MARITIME|COMBINED|DIPLOMATIC|ENVIRONMENTAL|QUIET>",
  "severity": <entero 1-10>,
  "confidence": "<HIGH|MEDIUM|LOW>",
  "headline": "<una línea: qué está pasando>",
  "summary": "<3-4 párrafos de síntesis>",
  "signals_used": ["adsb_agent", "maritime_agent", "news_agent", "social_agent"],
  "cross_domain_correlations": ["<correlación observada>"],
  "cycle_continuity": "<aumenta|estable|disminuye|primera observación>",
  "recommended_action": "<ALERT|MONITOR|IGNORE>",
  "tags": ["<etiqueta>"]
}

Reglas severity:
  9-10: evento activo con impacto inmediato confirmado y correlación multi-dominio
  7-8:  señal fuerte, múltiples fuentes correlacionadas o continuidad multi-ciclo
  5-6:  señal moderada, pocas fuentes o baja correlación
  3-4:  ruido, sin correlación
  1-2:  panorama normal, sin señal\
"""

class Analyst:
    def __init__(self, pool: asyncpg.Pool | None) -> None:
        self.pool = pool
        self.client = anthropic.AsyncAnthropic()
        self.redis = None  # injected by Orchestrator

    async def analyze(
        self,
        cycle_id: str,
        agent_findings: list[dict],
    ) -> dict | None:
        start_ms = int(time.monotonic() * 1000)
        now_iso = datetime.now(timezone.utc).isoformat()

        previous_analyses: list[dict] = []
        if self.pool:
            try:
                previous_analyses = await db_tools.fetch_analyzed_events_window(
                    self.pool, hours=24, min_severity=0, limit=10,
                )
            except Exception as exc:
                log.warning("[ANALYST] fetch previous_analyses falló: %s", exc)

        user_prompt = (
            f"CYCLE_ID: {cycle_id}\n"
            f"TIMESTAMP: {now_iso}\n\n"
            "FINDINGS DEL CICLO ACTUAL (4 agentes):\n"
            f"{json.dumps(agent_findings, default=str, ensure_ascii=False)}\n\n"
            "ANÁLISIS PREVIOS (últimas 24h, memoria del master):\n"
            f"{json.dumps(previous_analyses, default=str, ensure_ascii=False)}\n\n"
            "Responde ÚNICAMENTE con un JSON con esta estructura exacta:\n"
            f"{_OUTPUT_SCHEMA}"
        )

        log.info("[ANALYST] Iniciando cycle_id=%s agentes=%s",
                 cycle_id, [f.get("agent_name") for f in agent_findings])

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
            log.error("[ANALYST] Timeout (%ds)", _TIMEOUT_SECONDS)
            return None
        except Exception as exc:
            log.error("[ANALYST] API error: %s", exc)
            return None

        if self.redis and response.usage:
            try:
                await track_spend(self.redis, _MODEL, response.usage)
            except Exception as exc:
                log.warning("[COST] master track_spend failed: %s", exc)

        raw_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw_text = block.text
                break

        try:
            analysis = json.loads(_clean_json(raw_text))
        except (json.JSONDecodeError, ValueError) as exc:
            log.error("[ANALYST] JSON inválido: %s — raw: %.300s", exc, raw_text)
            return None

        # Ensure cycle_id is present (LLM may drop it)
        analysis["cycle_id"] = cycle_id

        processing_ms = int(time.monotonic() * 1000) - start_ms
        log.info(
            "[ANALYST] Completado cycle_id=%s severity=%s action=%s (%dms)",
            cycle_id, analysis.get("severity"),
            analysis.get("recommended_action"), processing_ms,
        )

        if self.pool:
            try:
                db_record = {
                    "time": datetime.now(timezone.utc),
                    "cycle_id": cycle_id,
                    "zone": analysis.get("zone") or "GLOBAL",
                    "event_type": analysis.get("event_type"),
                    "severity": analysis.get("severity"),
                    "confidence": analysis.get("confidence"),
                    "headline": analysis.get("headline"),
                    "summary": analysis.get("summary"),
                    "signals_used": analysis.get("signals_used") or [],
                    "market_implications": None,  # disabled in scheduled mode
                    "polymarket_implications": None,
                    "recommended_action": analysis.get("recommended_action"),
                    "tags": analysis.get("tags") or [],
                    "raw_input": json.dumps(
                        {"cycle_id": cycle_id, "findings": agent_findings},
                        default=str, ensure_ascii=False,
                    ),
                    "processing_time_ms": processing_ms,
                }
                saved_id = await db_tools.save_analyzed_event(self.pool, db_record)
                analysis["_db_id"] = saved_id
                log.info("[ANALYST] Persistido analyzed_events id=%d", saved_id)
            except Exception as exc:
                log.warning("[ANALYST] Error persistencia: %s", exc)

        return analysis
