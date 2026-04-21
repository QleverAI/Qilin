import { SEV_COLOR, SEV_BG, SEV_BORDER } from '../lib/severity'

function AlertCard({ alert, onClick }) {
  const isHigh = alert.severity === 'high'
  return (
    <div
      onClick={onClick}
      style={{
        margin: '3px 8px',
        padding: '10px 12px',
        background: 'var(--bg-2)',
        border: `1px solid ${SEV_BORDER[alert.severity]}`,
        borderLeft: `3px solid ${SEV_COLOR[alert.severity]}`,
        borderRadius: '2px',
        cursor: 'pointer',
        transition: 'border-color .15s',
        animation: isHigh ? 'alertPulse 3s ease-in-out infinite' : 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.borderLeftColor = SEV_COLOR[alert.severity] }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = SEV_BORDER[alert.severity]; e.currentTarget.style.borderLeftColor = SEV_COLOR[alert.severity] }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'5px' }}>
        <span style={{
          fontSize: 'var(--label-xs)', fontWeight:'700', letterSpacing:'.15em',
          textTransform:'uppercase', padding:'2px 6px', borderRadius:'2px',
          fontFamily:'var(--mono)', flexShrink:0,
          background: SEV_BG[alert.severity],
          color:      SEV_COLOR[alert.severity],
          border:     `1px solid ${SEV_BORDER[alert.severity]}`,
        }}>
          {alert.severity?.toUpperCase()}
        </span>
        <span style={{
          fontSize:'var(--label-md)', fontWeight:'600', letterSpacing:'.1em',
          textTransform:'uppercase', color:'var(--txt-2)', fontFamily:'var(--mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{alert.zone}</span>
        <span style={{ marginLeft:'auto', fontSize:'var(--label-xs)', color:'var(--txt-3)', fontFamily:'var(--mono)', flexShrink: 0 }}>
          {alert.time} UTC
        </span>
      </div>
      <div style={{
        fontSize: 'var(--body-sm)', fontWeight:'600', letterSpacing:'.02em',
        color:'var(--txt-1)', lineHeight:1.3, marginBottom:'4px',
      }}>
        {alert.title}
      </div>
      <div style={{ fontSize:'var(--label-sm)', color:'var(--txt-2)', lineHeight:1.5 }}>
        {alert.desc}
      </div>
    </div>
  )
}

export default function AlertPanel({ alerts, stats, onAlertClick }) {
  return (
    <aside style={{
      gridColumn: 2, gridRow: 2,
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--border-md)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '9px 14px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'var(--label-xs)', fontWeight:'700', letterSpacing:'.2em',
          textTransform:'uppercase', color:'var(--txt-3)', fontFamily: 'var(--mono)',
        }}>
          Alertas activas
        </span>
        <span style={{
          fontFamily:'var(--mono)', fontSize:'var(--label-sm)',
          background:'var(--bg-3)', border:'1px solid var(--border-md)',
          borderRadius:'2px', padding:'1px 7px',
          color: alerts.length > 0 ? 'var(--red)' : 'var(--txt-3)',
        }}>
          {alerts.length}
        </span>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
        {alerts.length === 0 ? (
          <div style={{
            padding: '32px 14px', textAlign: 'center',
            fontFamily: 'var(--mono)', fontSize: 'var(--label-xs)',
            color: 'var(--txt-3)', letterSpacing: '.14em',
            textTransform: 'uppercase', lineHeight: 2,
          }}>
            SIN ALERTAS<br />
            <span style={{ opacity: 0.5 }}>SISTEMA NOMINAL</span>
          </div>
        ) : alerts.map(a => (
          <AlertCard key={a.id} alert={a} onClick={() => onAlertClick?.(a)} />
        ))}
      </div>

      {/* Stats */}
      <div style={{ borderTop:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{
          padding:'7px 14px',
          borderBottom:'1px solid var(--border)',
          fontSize:'var(--label-xs)', fontWeight:'700',
          letterSpacing:'.2em', textTransform:'uppercase',
          color:'var(--txt-3)', fontFamily:'var(--mono)',
        }}>
          Actividad actual
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:'var(--border)' }}>
          {[
            { label:'Aeronaves',    value: stats.aircraftTotal, sub:`${stats.aircraftMil} militares`, color:'var(--accent)'  },
            { label:'Embarcaciones',value: stats.vesselsTotal,  sub:`${stats.vesselsMil} militares`, color:'var(--green)'  },
            { label:'Alertas HIGH', value: stats.alertsHigh,   sub:'últimas 6h',                    color:'var(--red)'    },
            { label:'Alertas MED',  value: stats.alertsMedium, sub:'últimas 6h',                    color:'var(--amber)'  },
          ].map(cell => (
            <div key={cell.label} style={{ background:'var(--bg-1)', padding:'9px 12px' }}>
              <div style={{
                fontSize:'var(--label-xs)', fontWeight:'600', letterSpacing:'.14em',
                textTransform:'uppercase', color:'var(--txt-3)', fontFamily:'var(--mono)',
                marginBottom: '2px',
              }}>
                {cell.label}
              </div>
              <div style={{
                fontFamily:'var(--mono)', fontSize:'20px', fontWeight:'500',
                lineHeight:1, color:cell.color,
              }}>
                {cell.value}
              </div>
              <div style={{
                fontSize:'var(--label-xs)', color:'var(--txt-3)',
                fontFamily:'var(--mono)', marginTop:'1px',
              }}>
                {cell.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
