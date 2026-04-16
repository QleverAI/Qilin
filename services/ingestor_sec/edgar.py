"""
Qilin — EDGAR API client.
Handles CIK resolution, submissions fetch, URL construction, and text extraction.
All network functions use exponential retry on 429.
"""
import asyncio
import io
import logging

import httpx
import pdfplumber
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

SEC_HEADERS = {
    "User-Agent": "Qilin/1.0 geopolitical-intelligence-platform admin@qilin.local",
    "Accept":     "application/json, text/html, application/pdf, */*",
}


async def fetch_with_retry(
    client: httpx.AsyncClient, url: str, max_retries: int = 3
) -> httpx.Response:
    """GET with exponential retry on HTTP 429 rate limit."""
    delay = 1.0
    for attempt in range(max_retries):
        r = await client.get(url, timeout=20)
        if r.status_code == 429:
            log.warning(f"429 rate limit ({url}), retry {attempt + 1}/{max_retries} in {delay}s")
            await asyncio.sleep(delay)
            delay *= 2
            continue
        return r
    raise ValueError(f"429 rate limit persists after {max_retries} retries: {url}")


async def load_cik_map(client: httpx.AsyncClient) -> dict[str, str]:
    """
    Downloads company_tickers.json from SEC once at startup.
    Returns {TICKER: CIK_10DIGITS}, e.g. {"MSFT": "0000789019"}.
    """
    url = "https://www.sec.gov/files/company_tickers.json"
    r = await fetch_with_retry(client, url)
    if r.status_code != 200:
        raise ValueError(f"company_tickers.json HTTP {r.status_code}")
    data = r.json()
    # Format: {"0": {"cik_str": 789019, "ticker": "MSFT", "title": "..."}, ...}
    return {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in data.values()}


async def fetch_submissions(client: httpx.AsyncClient, cik: str) -> dict:
    """Fetches company submissions JSON from the EDGAR submissions API."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    r = await fetch_with_retry(client, url)
    if r.status_code != 200:
        raise ValueError(f"Submissions HTTP {r.status_code} for CIK {cik}")
    return r.json()


def extract_8k_filings(submissions: dict) -> list[dict]:
    """
    Extracts 8-K filings from EDGAR submissions JSON.
    Returns list of {form_type, filing_date, accession_number, primary_doc, items}.
    """
    recent = submissions.get("filings", {}).get("recent", {})
    forms  = recent.get("form",            [])
    dates  = recent.get("filingDate",      [])
    accs   = recent.get("accessionNumber", [])
    docs   = recent.get("primaryDocument", [])
    items  = recent.get("items",           [])

    results = []
    for i, form in enumerate(forms):
        if form != "8-K":
            continue
        results.append({
            "form_type":        form,
            "filing_date":      dates[i] if i < len(dates) else None,
            "accession_number": accs[i]  if i < len(accs)  else None,
            "primary_doc":      docs[i]  if i < len(docs)  else None,
            "items":            items[i] if i < len(items) else "",
        })
    return results


def build_filing_url(cik: str, accession_number: str, primary_doc: str) -> str:
    """
    Builds the EDGAR document URL from CIK, accession_number and primary document filename.
    Example: CIK "0001045810", acc "0001045810-24-000042", doc "nvda8k.htm"
    → https://www.sec.gov/Archives/edgar/data/1045810/000104581024000042/nvda8k.htm
    """
    acc_nodash = accession_number.replace("-", "")
    cik_int    = int(cik)
    return f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{acc_nodash}/{primary_doc}"


async def download_and_extract(
    client: httpx.AsyncClient, url: str
) -> tuple[str | None, str | None]:
    """
    Downloads a filing document (HTML or PDF) and extracts plain text.
    Returns (full_text, summary) where summary is the first 1500 characters.
    Raises ValueError on HTTP error or extraction failure.
    """
    r = await fetch_with_retry(client, url)
    if r.status_code != 200:
        raise ValueError(f"HTTP {r.status_code} downloading {url}")

    content_type = r.headers.get("content-type", "")

    if "pdf" in content_type or url.lower().endswith(".pdf"):
        try:
            with pdfplumber.open(io.BytesIO(r.content)) as pdf:
                pages_text = [p.extract_text() or "" for p in pdf.pages[:30]]
                full_text  = "\n".join(pages_text).strip()
        except Exception as e:
            raise ValueError(f"PDF extraction failed: {e}")
    else:
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "head"]):
            tag.decompose()
        full_text = " ".join(soup.get_text(separator=" ").split())

    full_text = full_text[:500_000]  # cap at 500 KB
    summary   = full_text[:1500] if full_text else None
    return full_text or None, summary
