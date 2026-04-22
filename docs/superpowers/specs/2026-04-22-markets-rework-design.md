# Markets Section Rework — Design Spec

## Goal

Replace the SEC filings section (MERCADOS) with a market price/volume chart dashboard showing commodities, defense stocks, energy companies, semiconductors, and critical mining companies — all sourced from Yahoo Finance via yfinance.

## Architecture

### Backend

Two new endpoints added to the existing FastAPI service (`services/api/main.py`):

- `GET /markets/quotes` — returns current price + daily % change for all tracked assets. Fetched via `yfinance.download()` or `Ticker.fast_info`. Cached in Redis with 5-minute TTL.
- `GET /markets/history?symbol=CL=F&period=1mo&interval=1d` — returns OHLCV (open/high/low/close/volume) for a single symbol. Valid periods: `1d`, `5d`, `1mo`, `3mo`, `1y`. Valid intervals depend on period. Cached in Redis with 1-hour TTL per `symbol:period` key.

`yfinance` added to `services/api/requirements.txt`. No new ingestor service needed — data is fetched on demand with Redis cache providing sufficient performance.

### Cache Strategy

- Quotes: `cache:markets:quotes` → JSON of all symbols, TTL 300s (5 min)
- History: `cache:markets:history:{symbol}:{period}` → JSON OHLCV array, TTL 3600s (1h)

### SEC Filings

`ingestor_sec` service remains running (not removed) but its frontend is replaced. SEC data will be repurposed as an alert source in the alert-engine in a future task.

## Asset List

| Group | Symbol | Name |
|-------|--------|------|
| Materias primas | CL=F | WTI Crude Oil |
| Materias primas | BZ=F | Brent Crude |
| Materias primas | CC=F | Cacao |
| Materias primas | GC=F | Oro |
| Materias primas | NG=F | Gas natural |
| Materias primas | ZW=F | Trigo |
| Materias primas | HG=F | Cobre |
| Materias primas | ALI=F | Aluminio |
| Defensa (EEUU) | LMT | Lockheed Martin |
| Defensa (EEUU) | RTX | Raytheon |
| Defensa (EEUU) | BA | Boeing |
| Defensa (EEUU) | NOC | Northrop Grumman |
| Defensa (EEUU) | GD | General Dynamics |
| Defensa (EEUU) | LHX | L3Harris |
| Defensa (Europa) | RHM.DE | Rheinmetall |
| Defensa (Europa) | BA.L | BAE Systems |
| Defensa (Europa) | AIR.PA | Airbus |
| Defensa (Europa) | HO.PA | Thales |
| Defensa (Europa) | LDO.MI | Leonardo |
| Energía | XOM | ExxonMobil |
| Energía | CVX | Chevron |
| Energía | SHEL | Shell |
| Energía | BP | BP |
| Energía | TTE | TotalEnergies |
| Energía | EQNR | Equinor |
| Semiconductores | NVDA | NVIDIA |
| Semiconductores | TSM | TSMC |
| Semiconductores | ASML | ASML |
| Semiconductores | INTC | Intel |
| Minería crítica | FCX | Freeport-McMoRan |
| Minería crítica | VALE | Vale |
| Minería crítica | RIO | Rio Tinto |
| ETFs | USO | Oil ETF |
| ETFs | GLD | Gold ETF |
| ETFs | XLE | Energy Select Sector |
| ETFs | ITA | iShares Aerospace & Defense |

## Frontend

### Layout (Option C — Sidebar + Chart)

```
┌─────────────────────────────────────────────────────────┐
│  [Materias primas]                                       │
│  WTI Crude     $82.40   +1.2%  ◀ selected              │
│  Brent Crude   $84.10   +0.9%                           │
│  Cacao         $9,420   -0.4%        CANDLESTICK CHART  │
│  ...                                  + VOLUME BARS     │
│  [Defensa EEUU]                                          │
│  Lockheed      $480.50  +0.3%        1D|1W|1M|3M|1Y    │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

- Left sidebar (~280px): scrollable list of assets grouped by category. Each row: asset name + current price + daily % change (green if positive, red if negative). Selected asset highlighted with `var(--accent)` left border.
- Right panel: TradingView Lightweight Charts (`lightweight-charts` npm package). Candlestick series on top + histogram volume series below. Timeframe selector buttons: `1D | 1W | 1M | 3M | 1Y`. Asset name + current price shown in header above chart.

### Files

- Create: `frontend/src/pages/MarketsPage.jsx` — main page component
- Create: `frontend/src/hooks/useMarkets.js` — fetching quotes (5-min polling) + history (on demand)
- Delete: `frontend/src/pages/FilingsPage.jsx` — replaced entirely
- Delete: `frontend/src/hooks/useSecFeed.js` — no longer used by frontend
- Modify: `frontend/src/App.jsx` — swap FilingsPage import for MarketsPage
- Modify: `services/api/main.py` — add `/markets/quotes` and `/markets/history` endpoints
- Modify: `services/api/requirements.txt` — add `yfinance`

### Timeframe → yfinance params mapping

| Button | period | interval |
|--------|--------|----------|
| 1D | 1d | 5m |
| 1W | 5d | 1h |
| 1M | 1mo | 1d |
| 3M | 3mo | 1d |
| 1Y | 1y | 1wk |

## Error Handling

- If yfinance fetch fails for a symbol, that symbol's quote shows `—` price and grey % change. Chart shows "Sin datos disponibles" message.
- If Redis cache miss and yfinance is slow, quotes endpoint returns cached data if available or waits up to 10s.

## Out of Scope

- Adding/removing assets from the UI (future feature, subscription-gated)
- Real-time WebSocket price streaming (polling every 5 min is sufficient)
- SEC filings integration into alert-engine (separate future task)
