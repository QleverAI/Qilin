import pytest
from report_builder import generate_activity_svg, severity_label


def test_generate_activity_svg_empty():
    svg = generate_activity_svg([])
    assert "<svg" in svg
    assert "Sin datos" in svg


def test_generate_activity_svg_all_zero():
    svg = generate_activity_svg([0, 0, 0])
    assert "<svg" in svg
    assert "Sin datos" in svg


def test_generate_activity_svg_normal():
    svg = generate_activity_svg([5, 10, 3, 7])
    assert "<svg" in svg
    assert "<rect" in svg


def test_generate_activity_svg_single_peak():
    svg = generate_activity_svg([0, 0, 100, 0])
    assert "<rect" in svg
    # Peak bar should be red
    assert "#c0392b" in svg


def test_severity_label_high():
    assert severity_label(8) == "high"


def test_severity_label_medium():
    assert severity_label(5) == "medium"


def test_severity_label_low():
    assert severity_label(2) == "low"


def test_severity_label_boundary():
    assert severity_label(7) == "high"
    assert severity_label(4) == "medium"
    assert severity_label(3) == "low"
