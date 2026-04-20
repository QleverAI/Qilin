import asyncio
import logging
import os
import sys

import asyncpg
import httpx
import yaml
import redis.asyncio as aioredis

from analyst import Analyst
from orchestrator import Orchestrator
from rate_limiter import RateLimiter
from reporter import Reporter
from tools.geo_tools import load_zones

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [AGENT-ENGINE] %(message)s",
)
log = logging.getLogger(__name__)

REDIS_URL              = os.getenv("REDIS_URL", "redis://redis:6379")
DB_URL                 = os.getenv("DB_URL", "")
ANTHROPIC_API_KEY      = os.getenv("ANTHROPIC_API_KEY", "")
TELEGRAM_TOKEN         = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID       = os.getenv("TELEGRAM_CHAT_ID", "")
MAX_ANALYSES_PER_HOUR  = int(os.getenv("MAX_ANALYSES_PER_HOUR", "10"))
MAX_PARALLEL_ANALYSES  = int(os.getenv("MAX_PARALLEL_ANALYSES", "3"))
AGENT_TIMEOUT_SECONDS  = int(os.getenv("AGENT_TIMEOUT_SECONDS", "45"))

ZONES_CONFIG     = os.getenv("ZONES_CONFIG",     "/app/config/zones.yaml")
WATCHLIST_CONFIG = os.getenv("WATCHLIST_CONFIG", "/app/config/market_watchlist.yaml")

STREAMS = [
    "stream:alerts",
    "stream:market",
    "stream:polymarket",
    "stream:sentinel",
    "stream:adsb",
    "stream:ais",
]

METRICS_INTERVAL = 300  # 5 minutes


def load_watchlist(config_path: str) -> dict:
    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def parse_severity(stream: str, data: dict) -> int:
    raw = data.get("severity") or data.get("technical_score") or "5"
    try:
        val = int(float(raw))
        return max(0, min(10, val))
    except (TypeError, ValueError):
        pass
    mapping = {"high": 8, "medium": 5, "low": 3}
    return mapping.get(str(raw).lower(), 5)


async def stream_listener(
    redis_client: aioredis.Redis,
    stream_name: str,
    handler,
) -> None:
    last_id = "$"
    backoff = 1

    while True:
        try:
            results = await redis_client.xread(
                {stream_name: last_id}, count=10, block=2000
            )
            backoff = 1
            if not results:
                continue
            for _, messages in results:
                for msg_id, data in messages:
                    last_id = msg_id
                    await handler(stream_name, data)
        except (aioredis.RedisError, ConnectionError) as exc:
            log.error(
                "Redis error on %s: %s — reintentando en %ds", stream_name, exc, backoff
            )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)
        except Exception as exc:
            log.error("Error inesperado en %s: %s", stream_name, exc)
            await asyncio.sleep(5)


async def queue_drainer(
    rate_limiter: RateLimiter,
    orchestrator: Orchestrator,
    reporter: Reporter,
) -> None:
    while True:
        try:
            event = await asyncio.wait_for(rate_limiter.queue.get(), timeout=2.0)
        except asyncio.TimeoutError:
            continue

        severity = event.get("_severity", 5)
        acquired = await rate_limiter.acquire(severity=severity)
        if not acquired:
            try:
                rate_limiter.queue.put_nowait(event)
            except asyncio.QueueFull:
                log.warning("[RATELIMIT] Cola llena al reintentar, descartando evento")
            await asyncio.sleep(10)
            continue

        try:
            analysis = await orchestrator.process(event)
            if analysis:
                await reporter.report(analysis)
        except Exception as exc:
            log.error("Orchestrator/Reporter error (desde cola): %s", exc)
        finally:
            await rate_limiter.release()


async def metrics_logger(rate_limiter: RateLimiter) -> None:
    while True:
        await asyncio.sleep(METRICS_INTERVAL)
        m = rate_limiter.get_metrics()
        log.info(
            "[RATELIMIT] analyses_last_hour=%d queue_size=%d parallel=%d",
            m["analyses_last_hour"],
            m["queue_size"],
            m["parallel_active"],
        )


async def main() -> None:
    # Guard: cannot run without LLM key
    if not ANTHROPIC_API_KEY:
        log.error("[AGENT-ENGINE] ANTHROPIC_API_KEY no configurada — abortando arranque")
        sys.exit(1)

    log.info(
        "[AGENT-ENGINE] Arrancando — max_per_hour=%d max_parallel=%d timeout=%ds",
        MAX_ANALYSES_PER_HOUR,
        MAX_PARALLEL_ANALYSES,
        AGENT_TIMEOUT_SECONDS,
    )

    # Config
    try:
        zones = load_zones(ZONES_CONFIG)
        log.info("Zonas cargadas: %d", len(zones))
    except Exception as exc:
        log.warning("No se pudo cargar zones.yaml: %s", exc)
        zones = {}

    try:
        watchlist = load_watchlist(WATCHLIST_CONFIG)
        log.info("Watchlist cargado")
    except Exception as exc:
        log.warning("No se pudo cargar market_watchlist.yaml: %s", exc)
        watchlist = {}

    # Connections
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    http_client  = httpx.AsyncClient(
        timeout=30.0,
        limits=httpx.Limits(max_connections=10),
    )

    pool: asyncpg.Pool | None = None
    if DB_URL:
        try:
            pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=5)
            log.info("Pool de DB creado")
        except Exception as exc:
            log.warning("Sin conexión a DB, continuando sin persistencia: %s", exc)

    # Service objects
    rate_limiter = RateLimiter(
        max_per_hour=MAX_ANALYSES_PER_HOUR,
        max_parallel=MAX_PARALLEL_ANALYSES,
    )
    analyst      = Analyst(pool=pool)
    reporter     = Reporter(
        telegram_token=TELEGRAM_TOKEN,
        telegram_chat_id=TELEGRAM_CHAT_ID,
        http_client=http_client,
    )
    orchestrator = Orchestrator(
        pool=pool,
        rate_limiter=rate_limiter,
        analyst=analyst,
        zones=zones,
        watchlist=watchlist,
    )

    async def handle_event(stream: str, data: dict) -> None:
        severity = parse_severity(stream, data)
        acquired = await rate_limiter.acquire(severity=severity)

        if not acquired:
            event = dict(data)
            event["_stream"]   = stream
            event["_severity"] = severity
            if rate_limiter.queue.full():
                if severity < 5:
                    log.warning(
                        "[RATELIMIT] Cola llena, descartando evento severity=%d stream=%s",
                        severity, stream,
                    )
                else:
                    log.warning(
                        "[RATELIMIT] Cola llena, rechazando evento severity=%d stream=%s",
                        severity, stream,
                    )
            else:
                await rate_limiter.queue.put(event)
            return

        event = dict(data)
        event["_stream"]   = stream
        event["_severity"] = severity
        try:
            analysis = await orchestrator.process(event)
            if analysis:
                await reporter.report(analysis)
        except Exception as exc:
            log.error("Orchestrator/Reporter error: %s", exc)
        finally:
            await rate_limiter.release()

    tasks = [
        asyncio.create_task(stream_listener(redis_client, s, handle_event))
        for s in STREAMS
    ] + [
        asyncio.create_task(metrics_logger(rate_limiter)),
        asyncio.create_task(queue_drainer(rate_limiter, orchestrator, reporter)),
    ]

    log.info("Agent Engine listo, escuchando %d streams", len(STREAMS))

    try:
        await asyncio.gather(*tasks)
    finally:
        for t in tasks:
            t.cancel()
        await redis_client.aclose()
        await http_client.aclose()
        if pool:
            await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
