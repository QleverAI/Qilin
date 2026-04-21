import { useState, useMemo } from 'react'
import { usePolymarketFeed } from '../hooks/usePolymarketFeed'

const POLYMARKET_BASE = 'https://polymarket.com/event/'

const BADGE_STYLE = {
  'HIGH VALUE': { bg: 'rgba(79,156,249,0.12)', border: 'rgba(79,156,249,0.4)', color: 'var(--cyan)' },
  'WATCH':      { bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.4)', color: 'var(--amber)' },
  'PRICED IN':  { bg: 'rgba(100,100,100,0.15)', border: 'rgba(120,120,120,0.3)', color: 'var(--txt-3)' },
}

const FILTERS = [
  { id: 'all',         label: 'TODOS'      },
  { id: 'geopolitics', label: 'GEOPOLÍTICA' },
  { id: 'crypto',      label: 'CRYPTO'     },
  { id: 'elections',   label: 'ELECCIONES' },
  { id: 'conflict',    label: 'CONFLICTO'  },
]

function fmtVol(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function daysLeft(endDate) {
  if (!endDate) return null
  try {
    const diff = new Date(endDate) - new Date()
    return Math.max(0, Math.ceil(diff / 86400000))
  } catch { return null }
}

function ProbBar({ yes }) {
  const pct = Math.round((yes || 0) * 100)
  const color = pct >= 70 ? 'var(--green)' : pct <= 30 ? 'var(--red)' : 'var(--amber)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width .3s' }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: '700', color, minWidth: '36px', textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  )
}

function AnalysisPanel({ analysis, loading }) {
  if (loading) {
    return (
      <div style={{ padding: '20px 24px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cyan)', animation: 'blink 1.2s ease-in-out infinite' }} />
        Generando análisis IA…
      </div>
    )
  }
  if (!analysis || !analysis.picks?.length) {
    return (
      <div style={{ padding: '20px 24px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt-3)' }}>
        {analysis?.summary || 'Sin análisis disponible'}
      </div>
    )
  }
  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {analysis.summary && (
        <div style={{ fontSize: '11px', color: 'var(--txt-2)', lineHeight: 1.5, borderLeft: '2px solid var(--cyan)', paddingLeft: '10px' }}>
          {analysis.summary}
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {analysis.picks.map((pick, i) => {
          const bs = BADGE_STYLE[pick.badge] || BADGE_STYLE['WATCH']
          const link = pick.slug ? `${POLYMARKET_BASE}${pick.slug}` : null
          return (
            <div key={i} style={{
              flex: '1 1 260px', minWidth: '260px', maxWidth: '380px',
              background: 'var(--bg-2)', border: `1px solid ${bs.border}`,
              borderRadius: '3px', padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '8px', fontFamily: 'var(--mono)', letterSpacing: '.14em',
                  padding: '2px 7px', borderRadius: '2px',
                  background: bs.bg, border: `1px solid ${bs.border}`, color: bs.color,
                }}>
                  {pick.badge}
                </span>
                {pick.yes_price != null && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: '700', color: pick.yes_price >= 0.7 ? 'var(--green)' : pick.yes_price <= 0.3 ? 'var(--red)' : 'var(--amber)' }}>
                    {Math.round(pick.yes_price * 100)}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--txt-1)', lineHeight: 1.35, marginBottom: '6px' }}>
                {pick.question}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--txt-3)', lineHeight: 1.4, marginBottom: '8px' }}>
                {pick.reasoning}
              </div>
              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-block', fontFamily: 'var(--mono)', fontSize: '8px',
                  letterSpacing: '.12em', color: 'var(--cyan)', textDecoration: 'none',
                  padding: '3px 8px', border: '1px solid rgba(79,156,249,0.3)', borderRadius: '2px',
                }}>
                  VER EN POLYMARKET →
                </a>
              )}
            </div>
          )
        })}
      </div>
      {analysis.generated_at && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
          Análisis generado: {new Date(analysis.generated_at).toUTCString().slice(5, 22)} UTC · se actualiza cada 30 min
        </div>
      )}
    </div>
  )
}

function MarketCard({ market }) {
  const days = daysLeft(market.end_date)
  const link = market.slug ? `${POLYMARKET_BASE}${market.slug}` : null
  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '3px',
      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px',
      transition: 'border-color .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-md)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ fontSize: '11px', color: 'var(--txt-1)', lineHeight: 1.35, minHeight: '32px' }}>
        {market.question}
      </div>
      <ProbBar yes={market.yes_price} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
            VOL <span style={{ color: 'var(--txt-2)' }}>{fmtVol(market.volume)}</span>
          </span>
          {days != null && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
              {days}d
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '8px', fontFamily: 'var(--mono)', color: 'var(--txt-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            {market.category}
          </span>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" style={{
              fontFamily: 'var(--mono)', fontSize: '8px', color: 'rgba(79,156,249,0.5)',
              textDecoration: 'none', letterSpacing: '.1em',
            }}>
              ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PolymarketPage() {
  const { markets, analysis, loading, analysisLoading, lastUpdate } = usePolymarketFeed()
  const [activeFilter, setActiveFilter] = useState('all')

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return markets
    return markets.filter(m => {
      const cat = (m.category || '').toLowerCase()
      const tags = (m.tags || []).map(t => t.toLowerCase())
      const q    = (m.question || '').toLowerCase()
      if (activeFilter === 'geopolitics') return tags.some(t => ['geopolitics','geopolitical','conflict','war','military','energy','sanctions'].includes(t)) || cat === 'geopolitics'
      if (activeFilter === 'crypto')      return tags.some(t => ['crypto','cryptocurrency','bitcoin','ethereum'].includes(t)) || cat === 'crypto' || q.includes('bitcoin') || q.includes('btc') || q.includes('eth')
      if (activeFilter === 'elections')   return tags.some(t => ['elections','political','politics'].includes(t)) || cat === 'elections' || q.includes('election') || q.includes('president') || q.includes('win')
      if (activeFilter === 'conflict')    return tags.some(t => ['conflict','war','military'].includes(t)) || m.zones?.length > 0
      return true
    })
  }, [markets, activeFilter])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg-0)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 24px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '.18em', color: 'var(--accent)', textTransform: 'uppercase' }}>
            Mercados de Predicción
          </div>
          <div style={{ fontSize: '9px', color: 'var(--txt-3)', letterSpacing: '.1em', marginTop: '2px' }}>
            POLYMARKET · GEOPOLÍTICA · CRYPTO · ELECCIONES
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastUpdate && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
              {lastUpdate.toISOString().slice(11, 16)} UTC
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: markets.length ? 'var(--green)' : 'var(--txt-3)', animation: 'blink 2.4s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: markets.length ? 'var(--green)' : 'var(--txt-3)' }}>
              {loading ? '…' : `${markets.length} MERCADOS`}
            </span>
          </div>
        </div>
      </div>

      {/* AI Analysis panel */}
      <div style={{
        flexShrink: 0,
        background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
        maxHeight: '240px', overflowY: 'auto',
      }}>
        <div style={{
          padding: '8px 24px 6px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--cyan)', animation: analysisLoading ? 'blink 1.2s ease-in-out infinite' : 'none' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', fontWeight: '700', letterSpacing: '.16em', color: 'var(--cyan)' }}>
            ANÁLISIS IA · PICKS RECOMENDADOS
          </span>
        </div>
        <AnalysisPanel analysis={analysis} loading={analysisLoading} />
      </div>

      {/* Filters */}
      <div style={{
        padding: '10px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '6px',
        flexShrink: 0,
      }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            style={{
              fontFamily: 'var(--mono)', fontSize: '9px', fontWeight: '600',
              letterSpacing: '.12em', padding: '4px 10px', borderRadius: '2px',
              border: activeFilter === f.id ? '1px solid var(--cyan)' : '1px solid var(--border)',
              background: activeFilter === f.id ? 'rgba(79,156,249,0.1)' : 'transparent',
              color: activeFilter === f.id ? 'var(--cyan)' : 'var(--txt-3)',
              cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
          {filtered.length} mercados
        </span>
      </div>

      {/* Market grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ padding: '40px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt-3)', textAlign: 'center' }}>
            Cargando mercados…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt-3)', textAlign: 'center' }}>
            Sin mercados en esta categoría
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '10px',
          }}>
            {filtered.map(m => (
              <MarketCard key={m.market_id} market={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
