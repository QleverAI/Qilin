// Shared sidebar filter group — used by NewsPage, DocumentsPage, SocialPage, MarketsPage

export default function FilterGroup({ label, options, value, onChange, labelFn, accentColor, allLabel = 'TODOS', hideLabel = false }) {
  const accent = accentColor || 'var(--accent)'
  const accentBg = accentColor
    ? `${accentColor}14`
    : 'var(--accent-dim)'

  return (
    <div>
      {!hideLabel && (
        <div style={{
          fontSize: 'var(--label-xs)', fontWeight: '700', letterSpacing: '.2em',
          color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px',
          fontFamily: 'var(--mono)',
        }}>
          {label}
        </div>
      )}
      {[allLabel, ...options].map(opt => {
        const active = value === opt
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: active ? accentBg : 'none',
              border: 'none',
              borderLeft: `2px solid ${active ? accent : 'transparent'}`,
              color: active ? accent : 'var(--txt-3)',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--label-sm)',
              letterSpacing: '.06em',
              padding: '4px 8px',
              cursor: 'pointer',
              transition: 'color .15s, background .15s',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textTransform: 'uppercase',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--txt-2)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--txt-3)' }}
          >
            {opt === allLabel ? allLabel : (labelFn ? labelFn(opt) : opt.replace(/_/g, ' '))}
          </button>
        )
      })}
    </div>
  )
}
