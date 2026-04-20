"""
Qilin — Email Sender
Async email delivery using aiosmtplib with PDF attachment.
All failures are caught and logged — never raises.
"""

import logging
import os
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import aiosmtplib

log = logging.getLogger(__name__)

SMTP_HOST      = os.getenv("SMTP_HOST", "")
SMTP_PORT      = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER      = os.getenv("SMTP_USER", "")
SMTP_PASSWORD  = os.getenv("SMTP_PASSWORD", "")
RECIPIENTS_RAW = os.getenv("REPORT_RECIPIENTS", "")


def _get_recipients() -> list[str]:
    return [r.strip() for r in RECIPIENTS_RAW.split(",") if r.strip()]


def _build_message(
    recipients: list[str],
    subject: str,
    body_html: str,
    pdf_path: str,
    filename: str,
) -> MIMEMultipart:
    msg = MIMEMultipart("mixed")
    msg["From"]    = SMTP_USER
    msg["To"]      = ", ".join(recipients)
    msg["Subject"] = subject

    # HTML body part
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(body_html, "html", "utf-8"))
    msg.attach(alt)

    # PDF attachment
    pdf_data = Path(pdf_path).read_bytes()
    part = MIMEBase("application", "pdf")
    part.set_payload(pdf_data)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
    msg.attach(part)

    return msg


async def send_report_email(
    subject: str,
    body_html: str,
    pdf_path: str,
    filename: str,
) -> bool:
    """
    Sends the report PDF to all configured REPORT_RECIPIENTS.
    Returns True on success, False on any failure.
    Never raises.
    """
    if not SMTP_HOST or not SMTP_USER:
        log.info("[REPORT] Email no configurado (SMTP_HOST/SMTP_USER vacíos) — omitiendo envío")
        return False

    recipients = _get_recipients()
    if not recipients:
        log.info("[REPORT] REPORT_RECIPIENTS vacío — omitiendo envío por email")
        return False

    try:
        msg = _build_message(recipients, subject, body_html, pdf_path, filename)
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True,
        )
        log.info(f"[REPORT] Email enviado a {recipients}: {subject}")
        return True
    except Exception as e:
        log.error(f"[REPORT] Error enviando email: {e}")
        return False
