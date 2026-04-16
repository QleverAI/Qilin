"""Tests unitarios del fetcher — sin dependencias de red."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))


# ── parse_rss_entries ──────────────────────────────────────────────────────────

def test_parse_rss_finds_pdf_link():
    rss = """<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Annual Report 2024</title><link>https://nato.int/report.pdf</link></item>
      <item><title>Press Release</title><link>https://nato.int/news</link></item>
    </channel></rss>"""
    from fetcher import parse_rss_entries
    results = parse_rss_entries(rss)
    assert len(results) == 1
    assert results[0]['url'] == 'https://nato.int/report.pdf'
    assert results[0]['title'] == 'Annual Report 2024'


def test_parse_rss_returns_empty_on_no_pdfs():
    rss = """<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>News item</title><link>https://nato.int/news</link></item>
    </channel></rss>"""
    from fetcher import parse_rss_entries
    assert parse_rss_entries(rss) == []


def test_parse_rss_multiple_pdfs():
    rss = """<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>Doc A</title><link>https://rand.org/a.pdf</link></item>
      <item><title>Doc B</title><link>https://rand.org/b.PDF</link></item>
    </channel></rss>"""
    from fetcher import parse_rss_entries
    results = parse_rss_entries(rss)
    assert len(results) == 2


# ── parse_html_links ───────────────────────────────────────────────────────────

def test_parse_html_finds_pdf_links():
    html = """<html><body>
      <a href="/docs/report.pdf">Annual Report</a>
      <a href="/news/release">Press Release</a>
      <a href="https://external.org/paper.pdf">External Paper</a>
    </body></html>"""
    from fetcher import parse_html_links
    results = parse_html_links(html, 'https://example.org/publications')
    assert len(results) == 2
    urls = [r['url'] for r in results]
    assert 'https://example.org/docs/report.pdf' in urls
    assert 'https://external.org/paper.pdf' in urls


def test_parse_html_no_pdfs_returns_empty():
    html = """<html><body><a href="/news">News</a></body></html>"""
    from fetcher import parse_html_links
    assert parse_html_links(html, 'https://example.org') == []


def test_parse_html_uppercase_extension():
    html = """<html><body><a href="/docs/REPORT.PDF">Report</a></body></html>"""
    from fetcher import parse_html_links
    results = parse_html_links(html, 'https://example.org')
    assert len(results) == 1
    assert results[0]['title'] == 'Report'


def test_parse_html_uses_link_text_as_title():
    html = """<html><body><a href="/doc.pdf">Strategic Analysis 2024</a></body></html>"""
    from fetcher import parse_html_links
    results = parse_html_links(html, 'https://example.org')
    assert results[0]['title'] == 'Strategic Analysis 2024'


def test_parse_html_falls_back_to_filename_if_no_text():
    html = """<html><body><a href="/documents/report-2024.pdf"></a></body></html>"""
    from fetcher import parse_html_links
    results = parse_html_links(html, 'https://example.org')
    assert results[0]['title'] == 'report-2024.pdf'
