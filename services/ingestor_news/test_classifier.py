"""Tests unitarios del clasificador de noticias — sin dependencias externas."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from classifier import classify_sectors, classify_severity, compute_relevance


# ── False positive resistance ─────────────────────────────────────────────────

def test_no_false_positive_nuclear_medicine():
    sectors = classify_sectors("Radiation therapy trial shows cancer benefits", "New MRI technique")
    assert "nuclear" not in sectors

def test_no_false_positive_civilian_aviation():
    sectors = classify_sectors("Civilian aviation authority updates runway rules", "")
    assert "crisis_humanitaria" not in sectors

def test_no_false_positive_gas_station():
    sectors = classify_sectors("Gas station prices drop ahead of holiday weekend", "")
    assert "energia" not in sectors

def test_no_false_positive_army_bakery():
    sectors = classify_sectors("Army veteran opens artisan bakery in downtown", "")
    assert "militar" not in sectors


# ── classify_sectors ──────────────────────────────────────────────────────────

def test_classify_sectors_militar():
    sectors = classify_sectors("Airstrike kills dozens in Gaza", "Israeli forces launch missiles")
    assert "militar" in sectors

def test_classify_sectors_diplomacia():
    sectors = classify_sectors("UN Security Council imposes new sanctions", "")
    assert "diplomacia" in sectors
    assert "economia" in sectors  # sanctions también activa economia

def test_classify_sectors_multiple():
    sectors = classify_sectors("Missile strike forces emergency summit", "Troops advancing")
    assert "militar" in sectors
    assert "diplomacia" in sectors

def test_classify_sectors_nuclear():
    sectors = classify_sectors("IAEA reports uranium enrichment at 90%", "Iran denies warhead program")
    assert "nuclear" in sectors

def test_classify_sectors_ciberseguridad():
    sectors = classify_sectors("Major cyberattack hits critical infrastructure", "APT group identified")
    assert "ciberseguridad" in sectors

def test_classify_sectors_energia():
    sectors = classify_sectors("Russia cuts gas pipeline flow to Europe", "LNG shipments halted")
    assert "energia" in sectors

def test_classify_sectors_humanitaria():
    sectors = classify_sectors("Aid convoy blocked, refugees flee fighting", "")
    assert "crisis_humanitaria" in sectors

def test_classify_sectors_empty_text():
    sectors = classify_sectors("", "")
    assert sectors == []

def test_classify_sectors_no_match():
    sectors = classify_sectors("Local council approves new park", "")
    assert sectors == []


# ── classify_severity ─────────────────────────────────────────────────────────

def test_severity_high_critical_keyword():
    assert classify_severity("Russia launches invasion of Ukraine", ["militar"]) == "high"

def test_severity_high_nuclear():
    assert classify_severity("Nuclear test detected in North Korea", ["nuclear", "militar"]) == "high"

def test_severity_high_airstrike():
    assert classify_severity("Airstrike kills 40 civilians in Beirut", ["militar"]) == "high"

def test_severity_medium_two_active_sectors():
    assert classify_severity("Troops massing as sanctions imposed", ["militar", "diplomacia"]) == "medium"

def test_severity_medium_single_active_sector():
    assert classify_severity("Military exercises announced", ["militar"]) == "medium"

def test_severity_low_no_active_sector():
    assert classify_severity("Trade deal signed between EU and Mexico", ["economia"]) == "low"

def test_severity_low_empty():
    assert classify_severity("Local council meeting", []) == "low"


# ── compute_relevance ─────────────────────────────────────────────────────────

def test_relevance_high_priority_high_severity():
    source = {"priority": "high"}
    score = compute_relevance(source, ["militar", "nuclear"], "high")
    assert score == 66  # 30 (high priority) + 16 (2 sectors × 8) + 20 (high severity)

def test_relevance_medium_priority_no_sectors():
    source = {"priority": "medium"}
    score = compute_relevance(source, [], "low")
    assert score == 15

def test_relevance_capped_at_100():
    source = {"priority": "high"}
    score = compute_relevance(source, ["militar", "diplomacia", "nuclear", "economia", "energia", "ciberseguridad", "crisis_humanitaria"], "high")
    assert score == 100

def test_relevance_medium_priority_two_sectors_medium_severity():
    source = {"priority": "medium"}
    score = compute_relevance(source, ["militar", "diplomacia"], "medium")
    assert score == 15 + 16 + 10  # 41
