import pytest
from types import SimpleNamespace

from cost_tracker import calc_cost_usd, PRICING


def test_haiku_pricing_input_only():
    usage = SimpleNamespace(input_tokens=1_000_000, output_tokens=0)
    assert calc_cost_usd("claude-haiku-4-5-20251001", usage) == pytest.approx(1.00, rel=1e-3)


def test_haiku_pricing_output_only():
    usage = SimpleNamespace(input_tokens=0, output_tokens=1_000_000)
    assert calc_cost_usd("claude-haiku-4-5-20251001", usage) == pytest.approx(5.00, rel=1e-3)


def test_haiku_pricing_mixed():
    usage = SimpleNamespace(input_tokens=500_000, output_tokens=100_000)
    # 0.5 * 1.00 + 0.1 * 5.00 = 0.5 + 0.5 = 1.00
    assert calc_cost_usd("claude-haiku-4-5-20251001", usage) == pytest.approx(1.00, rel=1e-3)


def test_sonnet_pricing_mixed():
    usage = SimpleNamespace(input_tokens=1_000_000, output_tokens=1_000_000)
    # 3.00 + 15.00 = 18.00
    assert calc_cost_usd("claude-sonnet-4-6", usage) == pytest.approx(18.00, rel=1e-3)


def test_unknown_model_returns_zero():
    usage = SimpleNamespace(input_tokens=1_000_000, output_tokens=1_000_000)
    assert calc_cost_usd("unknown-model", usage) == 0.0


def test_zero_usage():
    usage = SimpleNamespace(input_tokens=0, output_tokens=0)
    assert calc_cost_usd("claude-haiku-4-5-20251001", usage) == 0.0


def test_pricing_has_expected_models():
    assert "claude-haiku-4-5-20251001" in PRICING
    assert "claude-sonnet-4-6" in PRICING
    assert PRICING["claude-haiku-4-5-20251001"]["input"] == 1.00
    assert PRICING["claude-haiku-4-5-20251001"]["output"] == 5.00
