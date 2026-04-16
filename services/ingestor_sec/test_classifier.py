"""Tests unitarios del clasificador SEC — sin dependencias externas."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from classifier import classify_severity, compute_relevance


# ── classify_severity ──────────────────────────────────────────────────────────

def test_severity_high_merger():
    assert classify_severity("Entry into Merger Agreement with XYZ Corp", "defense") == "high"

def test_severity_high_acquisition():
    assert classify_severity("Completion of acquisition of AI startup", "semiconductors") == "high"

def test_severity_high_bankruptcy():
    assert classify_severity("Voluntary bankruptcy filing under Chapter 11", "energy") == "high"

def test_severity_high_cybersecurity_incident():
    assert classify_severity("Report of material cybersecurity incident", "cyber_infra") == "high"

def test_severity_high_going_concern():
    assert classify_severity("Disclosure of going concern doubt", "financials") == "high"

def test_severity_medium_government_contract():
    assert classify_severity("Award of Department of Defense contract $2.1B", "defense") == "medium"

def test_severity_medium_ceo_departure():
    assert classify_severity("Departure of Chief Executive Officer and appointment of successor", "financials") == "medium"

def test_severity_medium_export_control():
    assert classify_severity("Receipt of export control license from BIS", "semiconductors") == "medium"

def test_severity_medium_defense_baseline():
    # Defense sector always gets at least medium for any 8-K
    assert classify_severity("Change in Fiscal Year", "defense") == "medium"

def test_severity_low_other_sector():
    assert classify_severity("Change in Fiscal Year", "financials") == "low"

def test_severity_low_empty_title():
    assert classify_severity("", "energy") == "low"

def test_severity_low_generic_filing():
    assert classify_severity("Submission of matters to a vote of security holders", "energy") == "low"


# ── compute_relevance ──────────────────────────────────────────────────────────

def test_relevance_high_priority_defense_high():
    # 30 (high priority) + 15 (defense bonus) + 20 (high severity) = 65
    assert compute_relevance("defense", "high", "high") == 65

def test_relevance_medium_priority_financials_low():
    # 15 (medium priority) + 5 (financials bonus) + 0 (low severity) = 20
    assert compute_relevance("financials", "medium", "low") == 20

def test_relevance_high_priority_semiconductors_medium():
    # 30 + 12 + 10 = 52
    assert compute_relevance("semiconductors", "high", "medium") == 52

def test_relevance_unknown_sector_returns_base():
    # 30 + 0 + 10 = 40
    assert compute_relevance("unknown", "high", "medium") == 40

def test_relevance_capped_at_100():
    # Max possible: 30 + 15 + 20 = 65 — verify always ≤ 100
    assert compute_relevance("defense", "high", "high") <= 100
