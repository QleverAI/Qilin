import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

import asyncpg

from cost_tracker import is_over_cap, get_today_spend, DAILY_SPEND_CAP
from tools import db_tools
from agents.adsb_agent import AdsbAgent
from agents.maritime_agent import MaritimeAgent
from agents.news_agent import NewsAgent
from agents.social_agent import SocialAgent

log = logging.getLogger(__name__)

_AGENT_TIMEOUT = int(os.getenv("AGENT_TIMEOUT_SECONDS", "120"))
_CYCLE_TIMEOUT = int(os.getenv("CYCLE_TIMEOUT_SECONDS", "300"))
_HOURS_LOOKBACK = int(os.getenv("CYCLE_HOURS_LOOKBACK", "8"))
_MEMORY_FINDINGS_LIMIT = 3  # previous findings per agent

_AGENT_CLASSES = {
    "adsb": AdsbAgent,
    "maritime": MaritimeAgent,
    "news": NewsAgent,
    "social": SocialAgent,
}


def _parse_enabled_agents() -> list[str]:
    raw = os.getenv("ENABLED_AGENTS", "adsb,maritime,news,social")
    return [a.strip() for a in raw.split(",") if a.strip() in _AGENT_CLASSES]


class Orchestrator:
    def __init__(
        self,
        pool: asyncpg.Pool | None,
        redis,
        analyst,
        reporter,
    ) -> None:
        self.pool = pool
        self.redis = redis
        self.analyst = analyst
        self.reporter = reporter

        enabled = _parse_enabled_agents()
        log.info("[ORCHESTRATOR] Agentes habilitados: %s", enabled)

        self.agents = []
        for key in enabled:
            agent = _AGENT_CLASSES[key](pool)
            agent.redis = redis
            self.agents.append(agent)

        # Inject redis into analyst for spend tracking
        if self.analyst:
            self.analyst.redis = redis

    async def run_scheduled_cycle(self) -> dict | None:
        cycle_id = str(uuid.uuid4())
        cycle_start = time.monotonic()
        now_iso = datetime.now(timezone.utc).isoformat()
        log.info("[CYCLE] %s start — cycle_id=%s", now_iso, cycle_id)

        # Budget gate
        if self.redis and await is_over_cap(self.redis):
            spend = await get_today_spend(self.redis)
            log.warning("[BUDGET] Ciclo saltado — spend=%.4f ≥ cap=%.2f", spend, DAILY_SPEND_CAP)
            return None

        if not self.agents:
            log.warning("[CYCLE] Sin agentes habilitados, saltando")
            return None

        # Build context per agent (includes previous_findings)
        contexts: dict[str, dict] = {}
        for agent in self.agents:
            prev: list[dict] = []
            if self.pool:
                try:
                    prev = await db_tools.fetch_previous_findings(
                        self.pool, agent.name, hours=24, limit=_MEMORY_FINDINGS_LIMIT,
                    )
                except Exception as exc:
                    log.warning("[CYCLE] fetch previous findings para %s falló: %s", agent.name, exc)
            contexts[agent.name] = {
                "cycle_id": cycle_id,
                "hours_lookback": _HOURS_LOOKBACK,
                "previous_findings": prev,
            }

        # Run agents in parallel
        tasks = [asyncio.create_task(a.run(contexts[a.name])) for a in self.agents]
        try:
            raw_results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=_CYCLE_TIMEOUT,
            )
        except asyncio.TimeoutError:
            log.warning("[CYCLE] Timeout global (%ds)", _CYCLE_TIMEOUT)
            for t in tasks:
                t.cancel()
            raw_results = []

        # Process successful findings
        findings: list[dict] = []
        for i, result in enumerate(raw_results):
            agent_name = self.agents[i].name
            if isinstance(result, Exception):
                log.warning("[CYCLE] %s exception: %s", agent_name, result)
                continue
            if not (isinstance(result, dict) and result.get("success")):
                err = result.get("error") if isinstance(result, dict) else repr(result)
                log.warning("[CYCLE] %s sin éxito: %s", agent_name, err)
                continue
            findings.append(result)

        log.info("[CYCLE] %d/%d agentes con éxito", len(findings), len(self.agents))

        # Persist findings and send Telegram for score >= 7
        for f in findings:
            payload = f.get("result") or {}
            score = int(payload.get("anomaly_score") or 0)
            telegram_sent = False
            if score >= 7:
                try:
                    telegram_sent = await self.reporter.send_finding_telegram(
                        cycle_id=cycle_id, agent_name=f["agent_name"], payload=payload,
                    )
                except Exception as exc:
                    log.warning("[CYCLE] finding telegram error: %s", exc)

            if self.pool:
                try:
                    await db_tools.save_agent_finding(self.pool, {
                        "time": datetime.now(timezone.utc),
                        "cycle_id": cycle_id,
                        "agent_name": f["agent_name"],
                        "anomaly_score": score,
                        "summary": payload.get("summary") or "",
                        "raw_output": payload,
                        "tools_called": f.get("tools_called") or [],
                        "duration_ms": f.get("duration_ms"),
                        "telegram_sent": telegram_sent,
                    })
                except Exception as exc:
                    log.warning("[CYCLE] save_agent_finding error: %s", exc)

            # Publish on stream:intel for WebSocket consumers
            if self.redis:
                try:
                    await self.redis.xadd(
                        "stream:intel",
                        {
                            "type": "finding",
                            "cycle_id": cycle_id,
                            "agent_name": f["agent_name"],
                            "anomaly_score": str(score),
                            "payload": json.dumps(payload, default=str),
                        },
                        maxlen=500,
                    )
                except Exception as exc:
                    log.warning("[CYCLE] xadd finding error: %s", exc)

        # Master only runs if at least 2 agents succeeded
        if len(findings) < 2:
            log.warning("[CYCLE] Solo %d agentes → master no corre", len(findings))
            return None

        analysis = await self.analyst.analyze(cycle_id, findings)
        if not analysis:
            log.warning("[CYCLE] Master no produjo análisis")
            return None

        # Master Telegram (always; silent if severity < 6)
        try:
            await self.reporter.send_master_telegram(analysis)
        except Exception as exc:
            log.warning("[CYCLE] master telegram error: %s", exc)

        # Publish master on stream:intel
        if self.redis:
            try:
                await self.redis.xadd(
                    "stream:intel",
                    {
                        "type": "master",
                        "cycle_id": cycle_id,
                        "severity": str(analysis.get("severity") or 0),
                        "payload": json.dumps(analysis, default=str),
                    },
                    maxlen=500,
                )
            except Exception as exc:
                log.warning("[CYCLE] xadd master error: %s", exc)

        # Budget warning check
        if self.redis:
            try:
                await self._maybe_warn_budget()
            except Exception as exc:
                log.warning("[BUDGET] warning check error: %s", exc)

        elapsed = time.monotonic() - cycle_start
        log.info("[CYCLE] cycle_id=%s done in %.1fs", cycle_id, elapsed)
        return analysis

    async def _maybe_warn_budget(self) -> None:
        from cost_tracker import SPEND_WARN_THRESHOLD, mark_warned, get_today_spend as _get
        spend = await _get(self.redis)
        if spend >= DAILY_SPEND_CAP * SPEND_WARN_THRESHOLD and spend < DAILY_SPEND_CAP:
            first = await mark_warned(self.redis)
            if first:
                text = (
                    f"⚠️ <b>Qilin AI spend warning</b>\n\n"
                    f"Gasto hoy: <b>${spend:.2f}</b> / ${DAILY_SPEND_CAP:.2f} "
                    f"({int(spend / DAILY_SPEND_CAP * 100)}%)\n"
                    f"Los próximos ciclos se abortarán al alcanzar el cap."
                )
                await self.reporter._send_telegram(text)
