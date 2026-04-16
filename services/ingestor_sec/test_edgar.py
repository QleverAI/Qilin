"""Tests unitarios de edgar.py — sin dependencias de red."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from edgar import extract_8k_filings, build_filing_url


def _make_submissions(forms, dates=None, accessions=None, docs=None, items=None):
    n = len(forms)
    return {
        "filings": {
            "recent": {
                "form":            forms,
                "filingDate":      dates      or ["2024-01-15"] * n,
                "accessionNumber": accessions or [f"0001234567-24-{str(i).zfill(6)}" for i in range(n)],
                "primaryDocument": docs       or [f"doc{i}.htm" for i in range(n)],
                "items":           items      or [""] * n,
            }
        }
    }


def test_extract_8k_filters_form_type():
    submissions = _make_submissions(["8-K", "10-K", "8-K", "4"])
    results = extract_8k_filings(submissions)
    assert len(results) == 2
    assert all(r["form_type"] == "8-K" for r in results)


def test_extract_8k_no_match_returns_empty():
    submissions = _make_submissions(["10-K", "10-Q", "4"])
    assert extract_8k_filings(submissions) == []


def test_extract_8k_captures_items():
    submissions = _make_submissions(["8-K"], items=["1.01,5.02"])
    results = extract_8k_filings(submissions)
    assert results[0]["items"] == "1.01,5.02"


def test_extract_8k_captures_filing_date():
    submissions = _make_submissions(["8-K"], dates=["2024-03-15"])
    results = extract_8k_filings(submissions)
    assert results[0]["filing_date"] == "2024-03-15"


def test_extract_8k_handles_empty_submissions():
    assert extract_8k_filings({}) == []
    assert extract_8k_filings({"filings": {}}) == []


def test_build_filing_url_removes_dashes_from_accession():
    url = build_filing_url("0000936468", "0000936468-24-000123", "form8k.htm")
    assert "000093646824000123" in url
    assert url.endswith("form8k.htm")


def test_build_filing_url_strips_cik_leading_zeros():
    url = build_filing_url("0000789019", "0000789019-24-000001", "8k.htm")
    assert "/789019/" in url
    assert "/0000789019/" not in url


def test_build_filing_url_exact_format():
    url = build_filing_url("0001045810", "0001045810-24-000042", "nvda8k.htm")
    expected = "https://www.sec.gov/Archives/edgar/data/1045810/000104581024000042/nvda8k.htm"
    assert url == expected
