const FILTERS_CONFIG = [
  { key:'civil',             icon:'▲', label:'Civil',      color:'#4f9cf9' },
  { key:'military_aircraft', icon:'▲', label:'Mil. Aéreo', color:'#f43f5e' },
  { key:'alerts',            icon:'●', label:'Alertas',    color:'#f43f5e' },
]

export default function FilterPanel({ filters, onToggle, counts }) {
  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '8px 10px',
      flexShrink: 0,
    }}>
      <div style={{
        fontSize:'9px', fontWeight:'700', letterSpacing:'.2em',
        color:'var(--txt-3)', textTransform:'uppercase', marginBottom:'7px',
      }}>
        FILTROS DE ENTIDADES
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
        {FILTERS_CONFIG.map(f => {
          const active = filters[f.key]
          const count  = counts?.[f.key] ?? 0
          return (
            <button
              key={f.key}
              onClick={() => onToggle(f.key)}
              title={active ? `Ocultar ${f.label}` : `Mostrar ${f.label}`}
              style={{
                display:'flex', alignItems:'center', gap:'5px',
                padding:'4px 8px',
                background: active ? `rgba(${hexToRgb(f.color)},0.12)` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? f.color+'66' : 'rgba(255,255,255,0.08)'}`,
                borderRadius:'2px', cursor:'pointer',
                color: active ? f.color : 'var(--txt-3)',
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize:'10px', fontWeight:'500',
                transition:'all .15s',
                opacity: active ? 1 : .55,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = active ? '1' : '.55'}
            >
              <span style={{ fontSize:'7px' }}>{f.icon}</span>
              <span style={{ letterSpacing:'.05em' }}>{f.label}</span>
              {count > 0 && (
                <span style={{
                  fontSize:'9px', background:'rgba(255,255,255,0.08)',
                  borderRadius:'2px', padding:'0 4px', color:'var(--txt-2)',
                }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `${r},${g},${b}`
}
