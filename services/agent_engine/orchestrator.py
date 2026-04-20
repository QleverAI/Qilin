import asyncio
import logging
import os

import asyncpg

from rate_limiter import RateLimiter
from tools import geo_tools
from agents.adsb_agent import AdsbAgent
from agents.maritime_agent import MaritimeAgent
from agents.news_agent import NewsAgent
from agents.social_agent import SocialAgent
from agents.market_agent import MarketAgent
from agents.polymarket_agent import PolymarketAgent
from agents.sentinel_agent import SentinelAgent

log = logging.getLogger(__name__)

_AGENT_TIMEOUT = int(os.getenv("AGENT_TIMEOUT_SECONDS", "45"))


class Orchestrator:
    def __init__(
        self,
        pool: asyncpg.Pool | None,
        rate_limiter: RateLimiter,
        analyst,
        zones: dict,
        watchlist: dict,
    ) -> None:
        self.pool = pool
        self.rate_limiter = rate_limiter
        self.analyst = analyst
        self.zones = zones

        self.adsb = AdsbAgent(pool, zones)
        self.maritime = MaritimeAgent(pool, zones)
        self.news = NewsAgent(pool, zones)
        self.social = SocialAgent(pool, zones)
        self.market = MarketAgent(pool, zones, watchlist)
        self.polymarket = PolymarketAgent(pool, zones)
        self.sentinel = SentinelAgent(pool, zones)

        log.info("[ORCHESTRATOR] Todos los agentes instanciados")

    # ── Agent selection ───────────────────────────────────────────────────────

    def _event_type_from_alert(self, event: dict) -> str:
        rule = (event.get("rule") or "").lower()
        if any(kw in rule for kw in ("aircraft", "asw", "military", "surge")):
            return "MILITARY"
        if any(kw in rule for kw in ("ais", "naval", "maritime", "vessel")):
            return "MARITIME"
        if "market" in rule:
            return "MARKET"
        return "ALL"

    def _select_agents(
        self, event: dict, zone: str
    ) -> tuple[list, list]:
        """Return (mandatory_agents, optional_agents) based on event source."""
        stream = event.get("_stream", "")

        if stream == "stream:alerts":
            event_type = self._event_type_from_alert(event)
            mandatory = [self.news, self.social]
            if event_type == "MILITARY":
                mandatory += [self.adsb, self.maritime]
            elif event_type == "MARITIME":
                mandatory += [self.maritime, self.adsb]
            elif event_type == "MARKET":
                mandatory += [self.market]
            else:  # ALL
                mandatory += [self.adsb, self.maritime, self.market, self.polymarket, self.sentinel]
            optional: list = []

        elif stream == "stream:market":
            mandatory = [self.market, self.news, self.social]
            optional = [self.adsb, self.maritime, self.polymarket] if zone else []

        elif stream == "stream:polymarket":
            mandatory = [self.polymarket, self.news]
            optional = [self.market, self.social]

        elif stream == "stream:sentinel":
            mandatory = [self.sentinel, self.news]
            optional = [self.adsb, self.maritime, self.market]

        elif stream == "stream:adsb":
            mandatory = [self.adsb, self.news]
            optional = [self.maritime, self.social]

        elif stream == "stream:ais":
            mandatory = [self.maritime, self.news]
            optional = [self.adsb, self.social]

        else:
            mandatory = [self.news]
            optional = []

        return mandatory, optional

    # ── Main entry point ──────────────────────────────────────────────────────

    async def process(self, event: dict) -> dict | None:
        try:
            return await self._process(event)
        except Exception as exc:
            log.error("[ORCHESTRATOR] Error inesperado: %s", exc)
            return None

    async def _process(self, event: dict) -> dict | None:
        zone = (
            event.get("zone")
            or event.get("zone_id")
            or ""
        )
        stream = event.get("_stream", "unknown")
        log.info("[ORCHESTRATOR] Procesando evento stream=%s zone=%s", stream, zone or "—")

        mandatory, optional = self._select_agents(event, zone)

        bbox = geo_tools.get_zone_bbox(zone, self.zones) if zone else {}
        context: dict = {
            "zone": zone,
            "zone_bbox": bbox,
            "event": event,
            "hours_lookback": 24,
        }

        all_agents = mandatory + optional
        if not all_agents:
            log.warning("[ORCHESTRATOR] Sin agentes seleccionados para stream=%s", stream)
            return None

        log.info(
            "[ORCHESTRATOR] Lanzando %d agentes (%d oblig + %d opcionales): %s",
            len(all_agents),
            len(mandatory),
            len(optional),
            [a.name for a in all_agents],
        )

        tasks = [asyncio.create_task(a.run(context)) for a in all_agents]

        try:
            raw_results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=_AGENT_TIMEOUT,
            )
        except asyncio.TimeoutError:
            log.warning("[ORCHESTRATOR] Timeout global (%ds), cancelando tareas", _AGENT_TIMEOUT)
            for t in tasks:
                t.cancel()
            raw_results = []

        # Filter: keep only successful agent results
        good_results: list[dict] = []
        for i, result in enumerate(raw_results):
            agent_name = all_agents[i].name if i < len(all_agents) else f"agent_{i}"
            if isinstance(result, Exception):
                log.warning("[ORCHESTRATOR] %s lanzó excepción: %s", agent_name, result)
            elif isinstance(result, dict) and result.get("success"):
                good_results.append(result)
            else:
                err = result.get("error") if isinstance(result, dict) else repr(result)
                log.warning("[ORCHESTRATOR] %s sin éxito: %s", agent_name, err)

        log.info(
            "[ORCHESTRATOR] %d/%d agentes respondieron con éxito: %s",
            len(good_results),
            len(all_agents),
            [r["agent_name"] for r in good_results],
        )

        if len(good_results) < 2:
            log.warning(
                "[ORCHESTRATOR] Solo %d agente(s) con éxito — análisis insuficiente, descartando",
                len(good_results),
            )
            return None

        return await self.analyst.analyze(event, good_results)
