# Markets Section Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SEC filings MERCADOS section with a price/volume chart dashboard showing 37 assets (commodities, defense, energy, semiconductors, mining, ETFs) sourced from Yahoo Finance via yfinance.

**Architecture:** Two new FastAPI endpoints (`/markets/quotes`, `/markets/history`) fetch from yfinance synchronously in an executor thread and cache results in Redis (5 min for quotes, 1 h for history). The frontend replaces `FilingsPage.jsx` with `MarketsPage.jsx` using TradingView Lightweight Charts for candlestick + volume rendering.

**Tech Stack:** Python yfinance, FastAPI run_in_executor, Redis cache, React 18, lightweight-charts (TradingView), CSS-in-JS inline styles.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `services/api/requirements.txt` | Add yfinance dependency |
| Modify | `services/api/main.py` | Add MARKET_ASSETS constant + 2 endpoints |
| Create | `services/api/test_markets.py` | Tests for both endpoints |
| Create | `frontend/src/hooks/useMarkets.js` | Quotes polling + history fetch |
| Create | `frontend/src/pages/MarketsPage.jsx` | Full page: sidebar + chart |
| Modify | `frontend/src/App.jsx` | Swap FilingsPage → MarketsPage |
| Delete | `frontend/src/pages/FilingsPage.jsx` | Replaced by MarketsPage |
| Delete | `frontend/src/hooks/useSecFeed.js` | No longer used by frontend |

---

### Task 1: Backend — yfinance endpoints

**Files:**
- Modify: `services/api/requirements.txt`
- Modify: `services/api/main.py` (append after existing endpoints, before the `@app.websocket("/ws")` block)
- Create: `services/api/test_markets.py`

- [ ] **Step 1: Add yfinance to requirements**

Open `services/api/requirements.txt` and add the line:

```
yfinance==0.2.*
```

Final file content:
```
fastapi==0.111.*
uvicorn[standard]==0.30.*
asyncpg==0.29.*
redis==5.0.*
python-dotenv==1.0.*
PyJWT==2.8.*
bcrypt==4.1.*
python-multipart==0.0.*
httpx==0.27.*
pyyaml==6.0.*
anthropic==0.34.*
yfinance==0.2.*
```

- [ ] **Step 2: Write the failing test**

Create `services/api/test_markets.py`:

```python
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

    mock_tickers_obj = MagicMock()
    mock_tickers_obj.tickers = {"CL=F": mock_ticker, "BZ=F": mock_ticker,
                                 "CC=F": mock_ticker, "GC=F": mock_ticker,
                                 "NG=F": mock_ticker, "ZW=F": mock_ticker,
                                 "HG=F": mock_ticker, "ALI=F": mock_ticker,
                                 "LMT": mock_ticker, "RTX": mock_ticker,
                                 "BA": mock_ticker, "NOC": mock_ticker,
                                 "GD": mock_ticker, "LHX": mock_ticker,
                                 "RHM.DE": mock_ticker, "BA.L": mock_ticker,
                                 "AIR.PA": mock_ticker, "HO.PA": mock_ticker,
                                 "LDO.MI": mock_ticker, "XOM": mock_ticker,
                                 "CVX": mock_ticker, "SHEL": mock_ticker,
                                 "BP": mock_ticker, "TTE": mock_ticker,
                                 "EQNR": mock_ticker, "NVDA": mock_ticker,
                                 "TSM": mock_ticker, "ASML": mock_ticker,
                                 "INTC": mock_ticker, "FCX": mock_ticker,
                                 "VALE": mock_ticker, "RIO": mock_ticker,
                                 "USO": mock_ticker, "GLD": mock_ticker,
                                 "XLE": mock_ticker, "ITA": mock_ticker}

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
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd services/api
pip install yfinance pytest pandas
pytest test_markets.py -v
```

Expected: ImportError or AttributeError — the endpoints don't exist yet.

- [ ] **Step 4: Add markets code to `services/api/main.py`**

At the top of the file, after the existing imports, add:

```python
import yfinance as yf
```

Find the `MARKET_ASSETS` constant location: add it after the `USERS` constant (around line 60), before the first route handler. Add this block:

```python
# ── Market assets ─────────────────────────────────────────────────────────────
MARKET_ASSETS = [
    {"symbol": "CL=F",  "name": "WTI Crude Oil",         "group": "Materias primas"},
    {"symbol": "BZ=F",  "name": "Brent Crude",            "group": "Materias primas"},
    {"symbol": "CC=F",  "name": "Cacao",                  "group": "Materias primas"},
    {"symbol": "GC=F",  "name": "Oro",                    "group": "Materias primas"},
    {"symbol": "NG=F",  "name": "Gas natural",            "group": "Materias primas"},
    {"symbol": "ZW=F",  "name": "Trigo",                  "group": "Materias primas"},
    {"symbol": "HG=F",  "name": "Cobre",                  "group": "Materias primas"},
    {"symbol": "ALI=F", "name": "Aluminio",               "group": "Materias primas"},
    {"symbol": "LMT",   "name": "Lockheed Martin",        "group": "Defensa EEUU"},
    {"symbol": "RTX",   "name": "Raytheon",               "group": "Defensa EEUU"},
    {"symbol": "BA",    "name": "Boeing",                 "group": "Defensa EEUU"},
    {"symbol": "NOC",   "name": "Northrop Grumman",       "group": "Defensa EEUU"},
    {"symbol": "GD",    "name": "General Dynamics",       "group": "Defensa EEUU"},
    {"symbol": "LHX",   "name": "L3Harris",               "group": "Defensa EEUU"},
    {"symbol": "RHM.DE","name": "Rheinmetall",            "group": "Defensa Europa"},
    {"symbol": "BA.L",  "name": "BAE Systems",            "group": "Defensa Europa"},
    {"symbol": "AIR.PA","name": "Airbus",                 "group": "Defensa Europa"},
    {"symbol": "HO.PA", "name": "Thales",                 "group": "Defensa Europa"},
    {"symbol": "LDO.MI","name": "Leonardo",               "group": "Defensa Europa"},
    {"symbol": "XOM",   "name": "ExxonMobil",             "group": "Energía"},
    {"symbol": "CVX",   "name": "Chevron",                "group": "Energía"},
    {"symbol": "SHEL",  "name": "Shell",                  "group": "Energía"},
    {"symbol": "BP",    "name": "BP",                     "group": "Energía"},
    {"symbol": "TTE",   "name": "TotalEnergies",          "group": "Energía"},
    {"symbol": "EQNR",  "name": "Equinor",               "group": "Energía"},
    {"symbol": "NVDA",  "name": "NVIDIA",                 "group": "Semiconductores"},
    {"symbol": "TSM",   "name": "TSMC",                   "group": "Semiconductores"},
    {"symbol": "ASML",  "name": "ASML",                   "group": "Semiconductores"},
    {"symbol": "INTC",  "name": "Intel",                  "group": "Semiconductores"},
    {"symbol": "FCX",   "name": "Freeport-McMoRan",       "group": "Minería crítica"},
    {"symbol": "VALE",  "name": "Vale",                   "group": "Minería crítica"},
    {"symbol": "RIO",   "name": "Rio Tinto",              "group": "Minería crítica"},
    {"symbol": "USO",   "name": "Oil ETF",                "group": "ETFs"},
    {"symbol": "GLD",   "name": "Gold ETF",               "group": "ETFs"},
    {"symbol": "XLE",   "name": "Energy Select ETF",      "group": "ETFs"},
    {"symbol": "ITA",   "name": "Aerospace & Defense ETF","group": "ETFs"},
]

_PERIOD_INTERVAL = {"1d": "5m", "5d": "1h", "1mo": "1d", "3mo": "1d", "1y": "1wk"}
```

Then, in `services/api/main.py`, insert the two endpoints **before** the `@app.websocket("/ws")` block:

```python
# ── Markets ────────────────────────────────────────────────────────────────────

@app.get("/markets/quotes")
async def get_market_quotes(_user: str = Depends(get_current_user)):
    redis = app.state.redis
    cached = await redis.get("cache:markets:quotes")
    if cached:
        return json.loads(cached)

    symbols = [a["symbol"] for a in MARKET_ASSETS]

    def _fetch():
        tickers_obj = yf.Tickers(" ".join(symbols))
        results = []
        for asset in MARKET_ASSETS:
            sym = asset["symbol"]
            try:
                fi = tickers_obj.tickers[sym].fast_info
                price = fi.last_price
                prev  = fi.previous_close
                pct   = round((price - prev) / prev * 100, 2) if prev else None
                results.append({
                    "symbol":     sym,
                    "name":       asset["name"],
                    "group":      asset["group"],
                    "price":      round(price, 4) if price else None,
                    "change_pct": pct,
                    "currency":   getattr(fi, "currency", None),
                })
            except Exception:
                results.append({
                    "symbol": sym, "name": asset["name"], "group": asset["group"],
                    "price": None, "change_pct": None, "currency": None,
                })
        return results

    loop = asyncio.get_event_loop()
    try:
        quotes = await loop.run_in_executor(None, _fetch)
    except Exception as e:
        log.error(f"Error fetching market quotes: {e}")
        raise HTTPException(status_code=503, detail="Error fetching market data")

    await redis.setex("cache:markets:quotes", 300, json.dumps(quotes))
    return quotes


@app.get("/markets/history")
async def get_market_history(
    symbol: str,
    period: str = "1mo",
    _user: str = Depends(get_current_user),
):
    if period not in _PERIOD_INTERVAL:
        raise HTTPException(status_code=400, detail=f"period must be one of {list(_PERIOD_INTERVAL)}")

    cache_key = f"cache:markets:history:{symbol}:{period}"
    redis = app.state.redis
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    interval = _PERIOD_INTERVAL[period]

    def _fetch():
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period=period, interval=interval)
        rows   = []
        for ts, row in hist.iterrows():
            rows.append({
                "time":   int(ts.timestamp()),
                "open":   round(float(row["Open"]),   4),
                "high":   round(float(row["High"]),   4),
                "low":    round(float(row["Low"]),    4),
                "close":  round(float(row["Close"]),  4),
                "volume": int(row["Volume"]),
            })
        return rows

    loop = asyncio.get_event_loop()
    try:
        data = await loop.run_in_executor(None, _fetch)
    except Exception as e:
        log.error(f"Error fetching history for {symbol}: {e}")
        raise HTTPException(status_code=503, detail="Error fetching market history")

    await redis.setex(cache_key, 3600, json.dumps(data))
    return data
```

- [ ] **Step 5: Run tests again — should pass**

```bash
cd services/api
pytest test_markets.py -v
```

Expected output:
```
PASSED test_markets.py::test_quotes_returns_all_assets
PASSED test_markets.py::test_quotes_returns_cached_data
PASSED test_markets.py::test_history_valid_period
PASSED test_markets.py::test_history_invalid_period
4 passed in ...
```

- [ ] **Step 6: Commit**

```bash
git add services/api/requirements.txt services/api/main.py services/api/test_markets.py
git commit -m "feat(markets): add /markets/quotes and /markets/history endpoints with Redis cache"
```

---

### Task 2: Frontend hook `useMarkets.js`

**Files:**
- Create: `frontend/src/hooks/useMarkets.js`

- [ ] **Step 1: Install lightweight-charts**

```bash
cd frontend
npm install lightweight-charts
```

Expected: `added 1 package` (or similar, no errors).

- [ ] **Step 2: Create `frontend/src/hooks/useMarkets.js`**

```js
import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from './apiClient'

export function useMarkets() {
  const [quotes,  setQuotes]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchQuotes() {
      try {
        const data = await apiFetch('/api/markets/quotes')
        if (!cancelled) {
          setQuotes(data || [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchQuotes()
    const interval = setInterval(fetchQuotes, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const fetchHistory = useCallback(async (symbol, period = '1mo') => {
    const data = await apiFetch(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&period=${period}`)
    return data || []
  }, [])

  return { quotes, loading, error, fetchHistory }
}
```

- [ ] **Step 3: Verify the hook is importable**

Open a terminal in `frontend/` and run:

```bash
node -e "import('./src/hooks/useMarkets.js').then(() => console.log('OK')).catch(e => console.error(e))"
```

Expected: `OK` (or a module error about React context — that's fine, it means the file parsed correctly).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useMarkets.js frontend/package.json frontend/package-lock.json
git commit -m "feat(markets): add useMarkets hook with quotes polling and history fetch"
```

---

### Task 3: `MarketsPage.jsx`

**Files:**
- Create: `frontend/src/pages/MarketsPage.jsx`

- [ ] **Step 1: Create `frontend/src/pages/MarketsPage.jsx`**

```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import { useMarkets } from '../hooks/useMarkets'

const PERIODS = [
  { label: '1D', value: '1d' },
  { label: '1S', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1A', value: '1y' },
]

function PriceChange({ pct }) {
  if (pct == null) return <span style={{ color: 'var(--txt-3)' }}>—</span>
  const color = pct >= 0 ? 'var(--green)' : 'var(--red)'
  return <span style={{ color, fontWeight: 600 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
}

function AssetRow({ asset, selected, onClick }) {
  return (
    <div
      onClick={() => onClick(asset)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px',
        cursor: 'pointer',
        background: selected ? 'var(--bg-2)' : 'transparent',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-1)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt-1)', fontFamily: 'var(--mono)' }}>
          {asset.symbol}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--txt-3)', marginTop: '1px' }}>
          {asset.name}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt-1)', fontFamily: 'var(--mono)' }}>
          {asset.price != null ? asset.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
        </div>
        <div style={{ fontSize: '10px', marginTop: '1px' }}>
          <PriceChange pct={asset.change_pct} />
        </div>
      </div>
    </div>
  )
}

function GroupSection({ group, assets, selected, onSelect }) {
  return (
    <div>
      <div style={{
        padding: '6px 12px 4px',
        fontSize: '9px', fontWeight: 700, letterSpacing: '.12em',
        textTransform: 'uppercase', color: 'var(--txt-3)',
        fontFamily: 'var(--mono)',
      }}>
        {group}
      </div>
      {assets.map(a => (
        <AssetRow
          key={a.symbol}
          asset={a}
          selected={selected?.symbol === a.symbol}
          onClick={onSelect}
        />
      ))}
    </div>
  )
}

function PriceChart({ symbol, fetchHistory }) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const candleRef    = useRef(null)
  const volumeRef    = useRef(null)
  const [period, setPeriod]   = useState('1mo')
  const [loading, setLoading] = useState(false)
  const [noData,  setNoData]  = useState(false)

  // Create chart once on mount
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: 'var(--txt-2)',
      },
      grid: {
        vertLines: { color: 'var(--border)' },
        horzLines: { color: 'var(--border)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'var(--border)' },
      timeScale: {
        borderColor: 'var(--border)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    const candle = chart.addSeries(CandlestickSeries, {
      upColor:   'var(--green)',
      downColor: 'var(--red)',
      borderUpColor:   'var(--green)',
      borderDownColor: 'var(--red)',
      wickUpColor:   'var(--green)',
      wickDownColor: 'var(--red)',
    })

    const volume = chart.addSeries(HistogramSeries, {
      color: 'rgba(100,120,160,0.35)',
      priceFormat:    { type: 'volume' },
      priceScaleId:   'volume',
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    chartRef.current  = chart
    candleRef.current = candle
    volumeRef.current = volume

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [])

  // Load data when symbol or period changes
  useEffect(() => {
    if (!symbol || !candleRef.current) return
    let cancelled = false
    setLoading(true)
    setNoData(false)

    fetchHistory(symbol, period).then(data => {
      if (cancelled) return
      setLoading(false)
      if (!data || data.length === 0) { setNoData(true); return }
      candleRef.current.setData(data.map(d => ({
        time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
      })))
      volumeRef.current.setData(data.map(d => ({
        time: d.time, value: d.volume,
        color: d.close >= d.open ? 'rgba(0,229,160,0.35)' : 'rgba(255,59,74,0.35)',
      })))
      chartRef.current.timeScale().fitContent()
    }).catch(() => {
      if (!cancelled) { setLoading(false); setNoData(true) }
    })

    return () => { cancelled = true }
  }, [symbol, period, fetchHistory])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Timeframe selector */}
      <div style={{ display: 'flex', gap: '4px', padding: '10px 16px 8px', flexShrink: 0 }}>
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              padding: '3px 10px',
              fontSize: '11px', fontFamily: 'var(--mono)', fontWeight: 600,
              background: period === p.value ? 'var(--accent)' : 'var(--bg-2)',
              color: period === p.value ? 'var(--bg-0)' : 'var(--txt-2)',
              border: '1px solid var(--border-md)',
              borderRadius: '3px', cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)', fontSize: '12px', color: 'var(--txt-2)',
          }}>
            Cargando...
          </div>
        )}
        {noData && !loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', color: 'var(--txt-3)',
          }}>
            Sin datos disponibles
          </div>
        )}
      </div>
    </div>
  )
}

export default function MarketsPage() {
  const { quotes, loading, fetchHistory } = useMarkets()
  const [selected, setSelected] = useState(null)

  // Auto-select first asset once quotes load
  useEffect(() => {
    if (quotes.length > 0 && !selected) setSelected(quotes[0])
  }, [quotes, selected])

  // Group quotes by group field
  const groups = quotes.reduce((acc, q) => {
    if (!acc[q.group]) acc[q.group] = []
    acc[q.group].push(q)
    return acc
  }, {})

  const GROUP_ORDER = [
    'Materias primas', 'Defensa EEUU', 'Defensa Europa',
    'Energía', 'Semiconductores', 'Minería crítica', 'ETFs',
  ]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: '260px', flexShrink: 0,
        borderRight: '1px solid var(--border-md)',
        overflowY: 'auto',
        background: 'var(--bg-0)',
      }}>
        {loading ? (
          <div style={{ padding: '20px 12px', color: 'var(--txt-3)', fontSize: '12px' }}>
            Cargando cotizaciones...
          </div>
        ) : (
          GROUP_ORDER.map(g => groups[g] ? (
            <GroupSection
              key={g}
              group={g}
              assets={groups[g]}
              selected={selected}
              onSelect={setSelected}
            />
          ) : null)
        )}
      </div>

      {/* Chart panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px 8px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex', alignItems: 'baseline', gap: '12px',
        }}>
          <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--txt-1)' }}>
            {selected?.name || '—'}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
            {selected?.symbol}
          </span>
          {selected && (
            <>
              <span style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--txt-1)', marginLeft: 'auto' }}>
                {selected.price != null ? selected.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
              </span>
              <PriceChange pct={selected.change_pct} />
            </>
          )}
        </div>

        {/* Chart */}
        {selected ? (
          <PriceChart
            key={selected.symbol}
            symbol={selected.symbol}
            fetchHistory={fetchHistory}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt-3)', fontSize: '13px' }}>
            Selecciona un activo
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/MarketsPage.jsx
git commit -m "feat(markets): add MarketsPage with sidebar + TradingView candlestick chart"
```

---

### Task 4: Wire MarketsPage into App.jsx

**Files:**
- Modify: `frontend/src/App.jsx` (lines 17 and 123)
- Delete: `frontend/src/pages/FilingsPage.jsx`
- Delete: `frontend/src/hooks/useSecFeed.js`

- [ ] **Step 1: Update `frontend/src/App.jsx`**

Replace line 17:
```js
import FilingsPage       from './pages/FilingsPage'
```
with:
```js
import MarketsPage       from './pages/MarketsPage'
```

Replace line 123:
```jsx
{view === 'markets'    && <FilingsPage />}
```
with:
```jsx
{view === 'markets'    && <MarketsPage />}
```

- [ ] **Step 2: Delete unused files**

```bash
rm frontend/src/pages/FilingsPage.jsx
rm frontend/src/hooks/useSecFeed.js
```

- [ ] **Step 3: Verify no remaining imports**

```bash
grep -r "FilingsPage\|useSecFeed" frontend/src/
```

Expected: no output.

- [ ] **Step 4: Run dev server and verify**

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`, log in, navigate to MERCADOS. Verify:
- Sidebar shows grouped assets (Materias primas, Defensa EEUU, etc.)
- WTI Crude Oil is auto-selected and shows a candlestick chart
- Clicking another asset loads its chart
- Timeframe buttons (1D/1S/1M/3M/1A) reload the chart data
- Price and % change show in the header and sidebar rows (green/red)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(markets): wire MarketsPage into app, remove FilingsPage and useSecFeed"
```

---

### Task 5: Deploy to production

**Files:** None (deployment only)

- [ ] **Step 1: Build frontend**

```bash
cd frontend
npm run build
```

Expected: `dist/` folder created, no build errors.

- [ ] **Step 2: Push to server and restart API**

```bash
# From project root
rsync -avz --delete frontend/dist/ root@178.104.238.122:/var/www/qilin/
ssh root@178.104.238.122 "cd /opt/qilin && docker compose restart api"
```

- [ ] **Step 3: Verify on production**

Open `http://178.104.238.122`, navigate to MERCADOS. Confirm:
- Sidebar loads with real prices from Yahoo Finance
- Chart renders candlesticks for at least one asset
- Timeframe switching works

- [ ] **Step 4: Final commit tag**

```bash
git tag v-markets-rework
git push origin main --tags
```
