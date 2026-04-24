import { useState } from 'react'
import { useIntelTimeline } from '../hooks/useIntelTimeline'
import IntelMasterCard from '../components/IntelMasterCard'
import IntelFindingCard from '../components/IntelFindingCard'
import IntelFilters from '../components/IntelFilters'

export default function IntelPage({ topicsOnly = false }) {
  const [hours, setHours] = useState(48)
  const [minScore, setMinScore] = useState(0)
  const [domain, setDomain] = useState('all')
  const [showMasters, setShowMasters] = useState(true)
  const [showFindings, setShowFindings] = useState(true)

  const { items, loading, error, spend } = useIntelTimeline({ hours, minScore, domain, topicsOnly })

  const filtered = items.filter(it => {
    if (it.type === 'master' && !showMasters) return false
    if (it.type === 'finding' && !showFindings) return false
    return true
  })

  const masters24h = items.filter(i => i.type === 'master' && (Date.now() - new Date(i.time).getTime()) < 24*3600*1000).length
  const findings7plus24h = items.filter(i => i.type === 'finding' && i.anomaly_score >= 7 && (Date.now() - new Date(i.time).getTime()) < 24*3600*1000).length

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <IntelFilters
        hours={hours} setHours={setHours}
        minScore={minScore} setMinScore={setMinScore}
        domain={domain} setDomain={setDomain}
        showMasters={showMasters} setShowMasters={setShowMasters}
        showFindings={showFindings} setShowFindings={setShowFindings}
        spend={spend}
      />
      <main style={{ flex: 1, overflow: 'auto', padding: '20px 28px', background: 'var(--bg-0)' }}>
        <header style={{
          display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '20px',
          fontFamily: 'var(--mono)', color: 'var(--txt-2)',
        }}>
          <h1 style={{
            margin: 0, fontSize: '18px', letterSpacing: '.12em',
            color: 'var(--cyan)', fontWeight: 700,
          }}>INTEL TIMELINE</h1>
          <span style={{ fontSize: '12px', color: 'var(--txt-3)' }}>
            Masters 24h: <b style={{ color: 'var(--txt-1)' }}>{masters24h}</b>
            {' · '}
            Findings ≥7 24h: <b style={{ color: 'var(--txt-1)' }}>{findings7plus24h}</b>
          </span>
        </header>

        {loading && <div style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>Cargando…</div>}
        {error && <div style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>Error: {error}</div>}
        {topicsOnly && items.length === 0 && !loading && (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            fontFamily: 'var(--mono)', color: 'var(--txt-3)', fontSize: '13px',
          }}>
            No content matches your topics.{' '}
            <span style={{ color: 'var(--txt-2)' }}>Toggle off MY FEED to see everything.</span>
          </div>
        )}
        {!loading && filtered.length === 0 && !topicsOnly && (
          <div style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono)', padding: '40px 0', textAlign: 'center' }}>
            Sin items en el rango seleccionado.
          </div>
        )}
        {filtered.map(item => (
          item.type === 'master'
            ? <IntelMasterCard key={`m-${item.cycle_id}-${item.time}`} item={item} />
            : <IntelFindingCard key={`f-${item.cycle_id}-${item.agent_name}-${item.time}`} item={item} />
        ))}
      </main>
    </div>
  )
}
