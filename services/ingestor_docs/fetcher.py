"""
Qilin — Fetcher de documentos oficiales.
Soporta fuentes RSS (via feedparser) y scraping (via Playwright para JS-rendered).
Las funciones parse_* son puras (sin IO) para facilitar el testing.
fetch_source es la función async de alto nivel.
"""

import feedparser
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin


def _is_pdf_url(url: str) -> bool:
    return '.pdf' in url.lower()


def parse_rss_entries(feed_text: str) -> list[dict]:
    """
    Parsea texto RSS/Atom y devuelve entradas que enlacen a PDFs.
    Retorna lista de {title, url, published}.
    """
    feed = feedparser.parse(feed_text)
    results = []
    for entry in feed.entries:
        url = getattr(entry, 'link', None) or ''
        if not _is_pdf_url(url):
            continue
        pub = getattr(entry, 'published_parsed', None)
        title = getattr(entry, 'title', None) or url.split('/')[-1]
        results.append({'title': title, 'url': url, 'published': pub})
    return results


def parse_html_links(html: str, base_url: str) -> list[dict]:
    """
    Extrae enlaces a PDFs de una página HTML (estática o ya renderizada por JS).
    Retorna lista de {title, url, published=None}.
    """
    soup = BeautifulSoup(html, 'html.parser')
    results = []
    for a in soup.find_all('a', href=True):
        href = a['href']
        if not _is_pdf_url(href):
            continue
        full_url = urljoin(base_url, href)
        title = a.get_text(strip=True) or full_url.split('/')[-1]
        results.append({'title': title, 'url': full_url, 'published': None})
    return results


async def scrape_with_playwright(browser, url: str) -> list[dict]:
    """
    Renderiza la página con Playwright (headless Chromium) y extrae enlaces a PDFs.
    Espera a que no haya actividad de red (networkidle) para capturar contenido JS.
    """
    page = await browser.new_page()
    try:
        await page.goto(url, wait_until='networkidle', timeout=30_000)
        html = await page.content()
    finally:
        await page.close()
    return parse_html_links(html, url)


async def fetch_source(client: httpx.AsyncClient, source: dict, browser=None) -> list[dict]:
    """
    Descarga y parsea una fuente.
    - RSS: usa httpx + feedparser (siempre).
    - Scraping: usa Playwright si browser está disponible, httpx como fallback.
    Lanza ValueError si la petición falla.
    """
    url = source['doc_url']

    if source['fetch_type'] == 'rss':
        r = await client.get(url, timeout=20)
        if r.status_code != 200:
            raise ValueError(f"HTTP {r.status_code} en {source['slug']}")
        return parse_rss_entries(r.text)

    # Scraping — Playwright si está disponible (renderiza JS)
    if browser:
        return await scrape_with_playwright(browser, url)

    # Fallback sin Playwright
    r = await client.get(url, timeout=20)
    if r.status_code != 200:
        raise ValueError(f"HTTP {r.status_code} en {source['slug']}")
    return parse_html_links(r.text, url)
