"""
Qilin — Extractor de texto de PDFs.
extract_text_from_bytes: función pura, testeable sin IO.
download_and_extract: función async de alto nivel.
"""

import io
import pdfplumber
import httpx

MAX_PDF_SIZE  = 50 * 1024 * 1024   # 50 MB
MAX_TEXT_SIZE = 500_000             # ~500 KB de texto
SUMMARY_SIZE  = 1_500


def extract_text_from_bytes(pdf_bytes: bytes) -> dict:
    """
    Extrae texto y metadatos de bytes de PDF.
    Devuelve {full_text, summary, page_count}.
    Nunca lanza excepción — devuelve full_text=None si no hay texto extraíble.
    """
    text_parts = []
    total = 0
    page_count = 0

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            page_text = page.extract_text() or ''
            text_parts.append(page_text)
            total += len(page_text)
            if total >= MAX_TEXT_SIZE:
                break

    full_text = '\n'.join(text_parts).strip()[:MAX_TEXT_SIZE] or None
    summary   = full_text[:SUMMARY_SIZE] if full_text else None

    return {
        'full_text':  full_text,
        'summary':    summary,
        'page_count': page_count,
    }


async def download_and_extract(client: httpx.AsyncClient, url: str) -> dict:
    """
    Descarga un PDF y extrae su texto.
    Lanza ValueError si HTTP != 200 o el fichero supera MAX_PDF_SIZE.
    Retorna {full_text, summary, page_count, file_size_kb}.
    """
    r = await client.get(url, timeout=60)
    if r.status_code != 200:
        raise ValueError(f'HTTP {r.status_code}')

    content = r.content
    if len(content) > MAX_PDF_SIZE:
        raise ValueError(f'PDF too large: {len(content) // 1024 // 1024}MB')

    meta = extract_text_from_bytes(content)
    meta['file_size_kb'] = len(content) // 1024
    return meta
