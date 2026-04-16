"""Tests unitarios del extractor de PDFs — mockea pdfplumber."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from unittest.mock import MagicMock, patch


def _make_mock_pdf(pages_text: list[str | None]):
    """Helper: crea un mock de pdfplumber con páginas de texto dado."""
    mock_pages = []
    for text in pages_text:
        p = MagicMock()
        p.extract_text.return_value = text
        mock_pages.append(p)
    ctx = MagicMock()
    ctx.__enter__ = MagicMock(return_value=ctx)
    ctx.__exit__ = MagicMock(return_value=False)
    ctx.pages = mock_pages
    return ctx


# ── extract_text_from_bytes ───────────────────────────────────────────────────

def test_extract_returns_summary_and_page_count():
    mock_pdf = _make_mock_pdf(["Nuclear nonproliferation signed by 50 nations.", "Page two text."])
    with patch('extractor.pdfplumber.open', return_value=mock_pdf):
        from extractor import extract_text_from_bytes
        result = extract_text_from_bytes(b'%PDF fake')
    assert result['page_count'] == 2
    assert 'nonproliferation' in result['summary']
    assert result['full_text'] is not None


def test_extract_empty_pages_returns_none_summary():
    mock_pdf = _make_mock_pdf([None, None])
    with patch('extractor.pdfplumber.open', return_value=mock_pdf):
        from extractor import extract_text_from_bytes
        result = extract_text_from_bytes(b'%PDF fake')
    assert result['summary'] is None
    assert result['full_text'] is None
    assert result['page_count'] == 2


def test_extract_summary_truncated_to_1500():
    long_text = 'A' * 2000
    mock_pdf = _make_mock_pdf([long_text])
    with patch('extractor.pdfplumber.open', return_value=mock_pdf):
        from extractor import extract_text_from_bytes
        result = extract_text_from_bytes(b'%PDF fake')
    assert len(result['summary']) == 1500


def test_extract_full_text_truncated_to_500k():
    huge_text = 'B' * 600_000
    mock_pdf = _make_mock_pdf([huge_text])
    with patch('extractor.pdfplumber.open', return_value=mock_pdf):
        from extractor import extract_text_from_bytes
        result = extract_text_from_bytes(b'%PDF fake')
    assert len(result['full_text']) <= 500_000


# ── download_and_extract ──────────────────────────────────────────────────────

def test_download_raises_on_http_error():
    import asyncio
    from unittest.mock import AsyncMock
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp

    from extractor import download_and_extract
    import pytest
    with pytest.raises(ValueError, match='HTTP 404'):
        asyncio.run(download_and_extract(mock_client, 'https://example.org/missing.pdf'))


def test_download_raises_on_oversized_pdf():
    import asyncio
    from unittest.mock import AsyncMock
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b'x' * (51 * 1024 * 1024)  # 51 MB
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp

    from extractor import download_and_extract
    import pytest
    with pytest.raises(ValueError, match='too large'):
        asyncio.run(download_and_extract(mock_client, 'https://example.org/huge.pdf'))
