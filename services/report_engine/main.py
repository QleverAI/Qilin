"""
Qilin — Report Engine
APScheduler-driven daily/weekly PDF intelligence reports.
Delivery: disk → Telegram → email (each independent, failures don't cascade).
On-demand: polls Redis list 'reports:queue' for API-triggered generation.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

import asyncpg
import httpx
import redis.asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from report_builder import build_report_data
from pdf_generator  import generate_pdf
from email_sender   import send_report_email

logging.basicConfig(level=logging.INFO, format="%(asctime)s [REPORT] %(message)s")
log = logging.getLogger(__name__)

REDIS_URL        = os.getenv("REDIS_URL", "redis://localhost:6379")
DB_URL           = os.getenv("DB_URL", "")
TELEGRAM_TOKEN   = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
REPORTS_DIR      = Path(os.getenv("REPORTS_DIR", "/app/reports"))
DAILY_HOUR       = int(os.getenv("DAILY_REPORT_HOUR", "7"))
WEEKLY_DAY       = os.getenv("WEEKLY_REPORT_DAY", "mon")

REPORTS_QUEUE_KEY = "reports:queue"


# ── Telegram helpers ──────────────────────────────────────────────────────────

async def _tg_send_text(client: httpx.AsyncClient, text: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        r = await client.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
            timeout=15,
        )
        if r.status_code != 200:
            log.warning(f"[REPORT] Telegram sendMessage HTTP {r.status_code}")
    except Exception as e:
        log.error(f"[REPORT] Error enviando texto Telegram: {e}")


async def _tg_send_document(client: httpx.AsyncClient, pdf_path: str, caption: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        pdf_data = Path(pdf_path).read_bytes()
        filename = Path(pdf_path).name
        r = await client.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendDocument",
            data={"chat_id": TELEGRAM_CHAT_ID, "caption": caption},
            files={"document": (filename, pdf_data, "application/pdf")},
            timeout=120,
        )
        if r.status_code != 200:
            log.warning(f"[REPORT] Telegram sendDocument HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log.error(f"[REPORT] Error enviando PDF Telegram: {e}")


async def deliver_via_telegram(report_data: dict, pdf_path: str):
    """Sends text summary + PDF document. Failure is logged, never raised."""
    try:
        summary = report_data["executive_summary"]
        teaser = summary[:1000] + ("..." if len(summary) > 1000 else "")
        report_type = report_data["report_type"]
        date_str = report_data["period_start"].strftime("%d %b %Y")
        label = "Daily Brief" if report_type == "daily" else "Weekly Digest"
        caption = f"Qilin {label} — {date_str}"
        header = (
            f"<b>Qilin {label} — {date_str}</b>\n"
            f"Alertas: <b>{report_data['alert_count']}</b> | "
            f"Severidad max: <b>{report_data['top_severity']}/10</b>\n\n"
            f"{teaser}"
        )
        async with httpx.AsyncClient() as client:
            await _tg_send_text(client, header)
            await asyncio.sleep(1)
            await _tg_send_document(client, pdf_path, caption)
        log.info("[REPORT] Entregado por Telegram")
    except Exception as e:
        log.error(f"[REPORT] Error en deliver_via_telegram: {e}")


# ── DB persistence ────────────────────────────────────────────────────────────

async def save_report_record(db, report_data: dict, pdf_path: str, file_size_kb: int):
    if not db:
        return
    try:
        await db.execute(
            """
            INSERT INTO reports
                (report_type, period_start, period_end, generated_at,
                 filename, file_path, file_size_kb, alert_count, top_severity)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            """,
            report_data["report_type"],
            report_data["period_start"],
            report_data["period_end"],
            report_data["generated_at"],
            Path(pdf_path).name,
            pdf_path,
            file_size_kb,
            report_data["alert_count"],
            report_data["top_severity"],
        )
        log.info(f"[REPORT] Registro guardado en DB: {Path(pdf_path).name}")
    except Exception as e:
        log.error(f"[REPORT] Error guardando registro en DB: {e}")


# ── Core generation flow ──────────────────────────────────────────────────────

async def run_report(db, report_type: str, period_start: datetime, period_end: datetime):
    """
    Full pipeline: build → PDF → save → Telegram → email.
    Each delivery step is independent — one failure doesn't cancel the others.
    """
    log.info(f"[REPORT] Iniciando generación: {report_type} {period_start.date()}→{period_end.date()}")

    try:
        report_data = await build_report_data(db, period_start, period_end, report_type)
    except Exception as e:
        log.error(f"[REPORT] Error construyendo datos del informe: {e}")
        return

    if report_type == "daily":
        filename = f"qilin_daily_{period_start.strftime('%Y%m%d')}.pdf"
    else:
        filename = f"qilin_weekly_{period_start.strftime('%Y%m%d')}_{period_end.strftime('%Y%m%d')}.pdf"

    try:
        pdf_path, file_size_kb = await generate_pdf(report_data, filename)
    except Exception as e:
        log.error(f"[REPORT] Error generando PDF: {e}")
        return

    await save_report_record(db, report_data, pdf_path, file_size_kb)

    date_str = period_start.strftime("%d %b %Y")
    label = "Daily Brief" if report_type == "daily" else "Weekly Digest"
    email_subject = f"Qilin {label} — {date_str}"

    summary_html = "<br><br>".join(
        f"<p>{p}</p>"
        for p in report_data["executive_summary"].split("\n\n")
    )

    await deliver_via_telegram(report_data, pdf_path)
    try:
        await send_report_email(email_subject, summary_html, pdf_path, filename)
    except Exception as e:
        log.error(f"[REPORT] Error inesperado en envío email: {e}")

    log.info(f"[REPORT] Pipeline completado: {filename} ({file_size_kb} KB, {report_data['alert_count']} alertas)")


# ── Scheduled jobs ────────────────────────────────────────────────────────────

async def generate_daily_report(db):
    now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    period_end   = now
    period_start = now - timedelta(days=1)
    await run_report(db, "daily", period_start, period_end)


async def generate_weekly_report(db):
    now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    period_end   = now
    period_start = now - timedelta(days=7)
    await run_report(db, "weekly", period_start, period_end)


# ── On-demand queue ───────────────────────────────────────────────────────────

async def queue_worker(db, redis):
    """
    Polls Redis list 'reports:queue' for on-demand generation requests.
    Expected payload: {"type": "daily", "date": "2026-04-20"}
    """
    log.info("[REPORT] Queue worker iniciado (escuchando reports:queue)")
    while True:
        try:
            item = await redis.blpop(REPORTS_QUEUE_KEY, timeout=5)
            if not item:
                continue
            _, raw = item
            req = json.loads(raw)
            rtype = req.get("type", "daily")
            date_str = req.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
            date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)

            if rtype == "weekly":
                period_start = date - timedelta(days=7)
                period_end   = date
            else:
                period_start = date
                period_end   = date + timedelta(days=1)

            log.info(f"[REPORT] Generación on-demand: {rtype} para {date_str}")
            await run_report(db, rtype, period_start, period_end)
        except asyncio.CancelledError:
            break
        except Exception as e:
            log.error(f"[REPORT] Error en queue_worker: {e}")
            await asyncio.sleep(5)


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    log.info("Qilin Report Engine arrancando...")
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    redis = aioredis.from_url(REDIS_URL, decode_responses=True)

    db = None
    if DB_URL:
        try:
            db = await asyncpg.connect(DB_URL)
            log.info("Conectado a TimescaleDB.")
        except Exception as e:
            log.warning(f"No se pudo conectar a DB: {e}. Informes no se persistirán.")

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        generate_daily_report, "cron",
        hour=DAILY_HOUR, minute=0,
        args=[db],
    )
    scheduler.add_job(
        generate_weekly_report, "cron",
        day_of_week=WEEKLY_DAY, hour=8, minute=0,
        args=[db],
    )
    scheduler.start()
    log.info(f"Scheduler iniciado — daily {DAILY_HOUR:02d}:00 UTC, weekly {WEEKLY_DAY} 08:00 UTC")

    await queue_worker(db, redis)


if __name__ == "__main__":
    asyncio.run(main())
