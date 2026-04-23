import asyncio
import logging
import os
import sys

import asyncpg
import httpx
import redis.asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from analyst import Analyst
from orchestrator import Orchestrator
from reporter import Reporter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [AGENT-ENGINE] %(message)s",
)
log = logging.getLogger(__name__)

REDIS_URL          = os.getenv("REDIS_URL", "redis://redis:6379")
DB_URL             = os.getenv("DB_URL", "")
ANTHROPIC_API_KEY  = os.getenv("ANTHROPIC_API_KEY", "")
TELEGRAM_TOKEN     = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "")

CYCLE_SCHEDULE     = os.getenv("CYCLE_SCHEDULE", "6,14,22")  # UTC hours
FORCE_RUN_CYCLE    = os.getenv("FORCE_RUN_CYCLE", "false").lower() == "true"


async def main() -> None:
    if not ANTHROPIC_API_KEY:
        log.error("ANTHROPIC_API_KEY no configurada — abortando")
        sys.exit(1)

    log.info("Arrancando agent_engine en modo SCHEDULED (cron=%s UTC)", CYCLE_SCHEDULE)

    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    http_client  = httpx.AsyncClient(
        timeout=30.0, limits=httpx.Limits(max_connections=10),
    )

    pool: asyncpg.Pool | None = None
    if DB_URL:
        try:
            pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=5)
            log.info("Pool DB creado")
        except Exception as exc:
            log.warning("Sin conexión DB, continuando sin persistencia: %s", exc)

    analyst  = Analyst(pool=pool)
    reporter = Reporter(
        telegram_token=TELEGRAM_TOKEN,
        telegram_chat_id=TELEGRAM_CHAT_ID,
        http_client=http_client,
    )
    orchestrator = Orchestrator(
        pool=pool, redis=redis_client, analyst=analyst, reporter=reporter,
    )

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        orchestrator.run_scheduled_cycle,
        CronTrigger.from_crontab(f"0 {CYCLE_SCHEDULE} * * *", timezone="UTC"),
        id="scheduled_cycle",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()

    log.info("Scheduler arrancado. Próximos jobs:")
    for job in scheduler.get_jobs():
        log.info("  %s → next run: %s", job.id, job.next_run_time)

    if FORCE_RUN_CYCLE:
        log.info("FORCE_RUN_CYCLE=true → disparando ciclo inicial en 10s")
        async def _delayed():
            await asyncio.sleep(10)
            await orchestrator.run_scheduled_cycle()
        asyncio.create_task(_delayed())

    try:
        # Keep running forever
        stop = asyncio.Event()
        await stop.wait()
    finally:
        scheduler.shutdown(wait=False)
        await redis_client.aclose()
        await http_client.aclose()
        if pool:
            await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
