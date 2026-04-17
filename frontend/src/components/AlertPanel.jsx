const SEV_COLOR  = { high:'var(--red)',   medium:'var(--amber)', low:'var(--green)' }
const SEV_BG     = { high:'rgba(244,63,94,0.10)',  medium:'rgba(245,158,11,0.09)', low:'rgba(52,211,153,0.08)' }
const SEV_BORDER = { high:'rgba(244,63,94,0.28)',  medium:'rgba(245,158,11,0.26)', low:'rgba(52,211,153,0.20)' }
const SEV_LEFT   = { high:'var(--red)',   medium:'var(--amber)', low:'var(--green)' }

function AlertCard({ alert, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        margin:'4px 8px',
        padding:'10px 12px',
        background:'var(--bg-2)',
        border:'1px solid var(--border)',
        borderLeft:`3px solid ${SEV_LEFT[alert.severity]}`,
        borderRadius:'2px',
        cursor:'pointer',
        transition:'border-color .15s',
      }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border-md)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
    >
      <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'5px' }}>
        <span style={{
          fontSize:'8px', fontWeight:'700', letterSpacing:'.15em',
          textTransform:'uppercase', padding:'2px 6px', borderRadius:'2px',
          fontFamily:'var(--mono)', flexShrink:0,
          background: SEV_BG[alert.severity],
          color: SEV_COLOR[alert.severity],
          border: `1px solid ${SEV_BORDER[alert.severity]}`,
        }}>
          {alert.severity.toUpperCase()}
        </span>
        <span style={{
          fontSize:'10px', fontWeight:'600', letterSpacing:'.12em',
          textTransform:'uppercase', color:'var(--txt-2)',
          fontFamily:'var(--mono)',
        }}>{alert.zone}</span>
        <span style={{ marginLeft:'auto', fontSize:'9px', color:'var(--txt-3)', fontFamily:'var(--mono)' }}>
          {alert.time} UTC
        </span>
      </div>
      <div style={{ fontSize:'12px', fontWeight:'600', letterSpacing:'.03em', color:'var(--txt-1)', lineHeight:1.3, marginBottom:'4px' }}>
        {alert.title}
      </div>
      <div style={{ fontSize:'10px', color:'var(--txt-2)', lineHeight:1.5 }}>
        {alert.desc}
      </div>
    </div>
  )
}

export default function AlertPanel({ alerts, stats, onAlertClick }) {
  return (
    <aside style={{
      gridColumn:2, gridRow:2,
      background:'var(--bg-1)',
      borderLeft:'1px solid var(--border-md)',
      display:'flex', flexDirection:'column',
      overflow:'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:'10px 14px 8px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        borderBottom:'1px solid var(--border)', flexShrink:0,
      }}>
        <span style={{ fontSize:'10px', fontWeight:'700', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--txt-2)' }}>
          Alertas activas
        </span>
        <span style={{
          fontFamily:'var(--mono)', fontSize:'10px',
          background:'var(--bg-3)', border:'1px solid var(--border-md)',
          borderRadius:'2px', padding:'1px 7px', color:'var(--accent)',
        }}>{alerts.length}</span>
      </div>

      {/* Alert list */}
      <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
        {alerts.map(a => <AlertCard key={a.id} alert={a} onClick={() => onAlertClick?.(a)} />)}
      </div>

      {/* Stats */}
      <div style={{ borderTop:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{
          padding:'8px 14px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          borderBottom:'1px solid var(--border)',
        }}>
          <span style={{ fontSize:'10px', fontWeight:'700', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--txt-2)' }}>
            Actividad actual
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:'var(--border)' }}>
          {[
            { label:'Aeronaves',   value: stats.aircraftTotal, sub:`${stats.aircraftMil} militares`,  color:'var(--accent)'  },
            { label:'Embarcaciones', value: stats.vesselsTotal, sub:`${stats.vesselsMil} militares`, color:'var(--green)' },
            { label:'Alertas high',  value: stats.alertsHigh,  sub:'últimas 6h',                     color:'var(--red)'   },
            { label:'Alertas med',   value: stats.alertsMedium,sub:'últimas 6h',                     color:'var(--amber)' },
          ].map(cell => (
            <div key={cell.label} style={{ background:'var(--bg-1)', padding:'10px 14px' }}>
              <div style={{ fontSize:'9px', fontWeight:'600', letterSpacing:'.15em', textTransform:'uppercase', color:'var(--txt-3)' }}>
                {cell.label}
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:'22px', fontWeight:'500', lineHeight:1, color:cell.color }}>
                {cell.value}
              </div>
              <div style={{ fontSize:'9px', color:'var(--txt-3)', fontFamily:'var(--mono)', marginTop:'1px' }}>
                {cell.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
