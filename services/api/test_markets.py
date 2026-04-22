"""Tests for /markets/quotes and /markets/history endpoints."""
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient


def make_app():
    """Import app after patching so yfinance import doesn't fail in CI."""
    from main import app
    return app


@pytest.fixture
def client(monkeypatch):
    """TestClient with Redis mocked and auth bypassed."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.setex = AsyncMock(return_value=True)

    app = make_app()
    app.state.redis = mock_redis

    # Bypass JWT auth
    from main import get_current_user
    app.dependency_overrides[get_current_user] = lambda: "testuser"

    return TestClient(app), mock_redis


def _make_fast_info(price=80.5, prev_close=79.0, currency="USD"):
    fi = MagicMock()
    fi.last_price = price
    fi.previous_close = prev_close
    fi.currency = currency
    return fi


def test_quotes_returns_all_assets(client):
    tc, mock_redis = client
    mock_ticker = MagicMock()
    mock_ticker.fast_info = _make_fast_info(80.5, 79.0)

    all_symbols = [
        "CL=F","BZ=F","CC=F","GC=F","NG=F","ZW=F","HG=F","ALI=F",
        "LMT","RTX","BA","NOC","GD","LHX",
        "RHM.DE","BA.L","AIR.PA","HO.PA","LDO.MI",
        "XOM","CVX","SHEL","BP","TTE","EQNR",
        "NVDA","TSM","ASML","INTC",
        "FCX","VALE","RIO",
        "USO","GLD","XLE","ITA",
    ]
    mock_tickers_obj = MagicMock()
    mock_tickers_obj.tickers = {sym: mock_ticker for sym in all_symbols}

    with patch("main.yf.Tickers", return_value=mock_tickers_obj):
        resp = tc.get("/markets/quotes")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 36
    assert data[0]["symbol"] == "CL=F"
    assert data[0]["price"] == 80.5
    assert round(data[0]["change_pct"], 2) == round((80.5 - 79.0) / 79.0 * 100, 2)


def test_quotes_returns_cached_data(client):
    tc, mock_redis = client
    cached = [{"symbol": "CL=F", "name": "WTI Crude Oil", "group": "Materias primas",
               "price": 75.0, "change_pct": 1.5, "currency": "USD"}]
    mock_redis.get = AsyncMock(return_value=json.dumps(cached))

    with patch("main.yf.Tickers") as mock_yf:
        resp = tc.get("/markets/quotes")
        mock_yf.assert_not_called()

    assert resp.status_code == 200
    assert resp.json()[0]["price"] == 75.0


def test_history_valid_period(client):
    import pandas as pd
    tc, mock_redis = client

    idx = pd.DatetimeIndex(["2024-01-01", "2024-01-02"], tz="UTC")
    df = pd.DataFrame({
        "Open": [80.0, 81.0], "High": [82.0, 83.0],
        "Low": [79.0, 80.0], "Close": [81.5, 82.0], "Volume": [1000, 2000]
    }, index=idx)

    mock_ticker = MagicMock()
    mock_ticker.history = MagicMock(return_value=df)

    with patch("main.yf.Ticker", return_value=mock_ticker):
        resp = tc.get("/markets/history?symbol=CL=F&period=1mo")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["close"] == 81.5
    assert data[0]["volume"] == 1000
    assert "time" in data[0]


def test_history_invalid_period(client):
    tc, _ = client
    resp = tc.get("/markets/history?symbol=CL=F&period=10y")
    assert resp.status_code == 400
