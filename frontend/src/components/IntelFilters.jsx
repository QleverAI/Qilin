const DOMAINS = ['adsb', 'maritime', 'news', 'social']
const RANGES = [
  { h: 24, label: '24h' },
  { h: 48, label: '48h' },
  { h: 72, label: '72h' },
]

export default function IntelFilters({
  hours, setHours, minScore, setMinScore, domain, setDomain,
  showMasters, setShowMasters, showFindings, setShowFindings,
  spend,
}) {
  return (
    <aside style={{
      width: 260, padding: '16px',
      borderRight: '1px solid var(--border-md)', background: 'var(--bg-1)',
      fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--txt-2)',
      overflow: 'auto',
    }}>
      <div style={{ marginBottom: '18px' }}>
        <div style={{ color: 'var(--txt-3)', fontSize: '10px', letterSpacing: '.1em', marginBottom: '6px' }}>SPEND</div>
        <div>${spend.spent_usd?.toFixed(2) || '0.00'} / ${spend.cap_usd?.toFixed(2) || '5.00'}</div>
        <div style={{ height: '4px', background: 'var(--bg-2)', borderRadius: '2px', marginTop: '6px' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, ((spend.spent_usd || 0) / (spend.cap_usd || 5)) * 100)}%`,
            background: spend.spent_usd >= spend.cap_usd * 0.8 ? 'var(--amber)' : 'var(--cyan)',
            borderRadius: '2px',
          }} />
        </div>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <div style={{ color: 'var(--txt-3)', fontSize: '10px', letterSpacing: '.1em', marginBottom: '6px' }}>TIPO</div>
        <label style={{ display: 'block', marginBottom: '4px' }}>
          <input type="checkbox" checked={showMasters} onChange={e => setShowMasters(e.target.checked)} /> Master
        </label>
        <label style={{ display: 'block' }}>
          <input type="checkbox" checked={showFindings} onChange={e => setShowFindings(e.target.checked)} /> Findings
        </label>
      </div>

      <div style={{ marginBottom: '18px' }}>
        <div style={{ color: 'var(--txt-3)', fontSize: '10px', letterSpacing: '.1em', marginBottom: '6px' }}>DOMINIO</div>
        {['all', ...DOMAINS].map(d => (
          <label key={d} style={{ display: 'block', marginBottom: '3px' }}>
            <input type="radio" name="domain" checked={domain === d} onChange={() => setDomain(d)} /> {d}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: '18px' }}>
        <div style={{ color: 'var(--txt-3)', fontSize: '10px', letterSpacing: '.1em', marginBottom: '6px' }}>SCORE MÍNIMO</div>
        <input type="range" min="0" max="10" value={minScore} onChange={e => setMinScore(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
        <div>{minScore}+</div>
      </div>

      <div>
        <div style={{ color: 'var(--txt-3)', fontSize: '10px', letterSpacing: '.1em', marginBottom: '6px' }}>RANGO</div>
        {RANGES.map(r => (
          <button
            key={r.h}
            onClick={() => setHours(r.h)}
            style={{
              marginRight: '4px', padding: '3px 8px',
              background: hours === r.h ? 'rgba(79,156,249,0.15)' : 'transparent',
              border: '1px solid var(--border-md)',
              color: hours === r.h ? 'var(--cyan)' : 'var(--txt-2)',
              fontFamily: 'var(--mono)', fontSize: '11px', cursor: 'pointer',
              borderRadius: '2px',
            }}
          >{r.label}</button>
        ))}
      </div>
    </aside>
  )
}
