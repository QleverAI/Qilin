"""
Qilin — PDF Generator
Renders the Jinja2 HTML template with WeasyPrint to produce a PDF file.
Runs WeasyPrint in an executor to avoid blocking the asyncio loop.
"""

import asyncio
import logging
import os
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

log = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent / "templates"
REPORTS_DIR   = Path(os.getenv("REPORTS_DIR", "/app/reports"))

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def _render_pdf_sync(html_content: str, output_path: str) -> int:
    """
    Synchronous WeasyPrint rendering — called from asyncio executor.
    Returns the file size in KB.
    """
    HTML(string=html_content).write_pdf(
        output_path,
        presentational_hints=True,
    )
    return os.path.getsize(output_path) // 1024


async def generate_pdf(report_data: dict, output_filename: str) -> tuple[str, int]:
    """
    Renders the report data to PDF using Jinja2 + WeasyPrint.
    Returns (output_path, file_size_kb).
    Raises on failure — caller must handle.
    """
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = str(REPORTS_DIR / output_filename)

    template = _jinja_env.get_template("report.html.j2")
    html_content = template.render(data=report_data)

    loop = asyncio.get_running_loop()
    file_size_kb = await loop.run_in_executor(
        None, _render_pdf_sync, html_content, output_path
    )

    log.info(f"[REPORT] PDF generado: {output_path} ({file_size_kb} KB)")
    return output_path, file_size_kb
