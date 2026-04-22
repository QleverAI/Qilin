import { useState, useEffect, useRef, useMemo } from 'react'
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import { useMarkets } from '../hooks/useMarkets'

const PERIODS = [
  { label: '1D', value: '1d' },
  { label: '1S', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1A', value: '1y' },
]

const GROUP_ORDER = [
  'Materias primas', 'Defensa EEUU', 'Defensa Europa',
  'Energía', 'Semiconductores', 'Minería crítica', 'ETFs',
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

    // Hardcoded colors: TradingView chart renders to canvas, CSS variables don't resolve there
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    const candle = chart.addSeries(CandlestickSeries, {
      upColor:        '#00e5a0',
      downColor:      '#ff3b4a',
      borderUpColor:  '#00e5a0',
      borderDownColor:'#ff3b4a',
      wickUpColor:    '#00e5a0',
      wickDownColor:  '#ff3b4a',
    })

    const volume = chart.addSeries(HistogramSeries, {
      color:        'rgba(100,120,160,0.35)',
      priceFormat:  { type: 'volume' },
      priceScaleId: 'volume',
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
  const groups = useMemo(() => quotes.reduce((acc, q) => {
    if (!acc[q.group]) acc[q.group] = []
    acc[q.group].push(q)
    return acc
  }, {}), [quotes])

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
