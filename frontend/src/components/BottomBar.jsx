export default function BottomBar({ stats }) {
  const now = new Date()
  const ts  = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')}`

  const items = [
    { icon:'▲', color:'var(--accent)', value: stats.aircraftTotal, label:'aeronaves' },
    { icon:'▲', color:'var(--red)',   value: stats.aircraftMil,   label:'militares' },
    { icon:'●', color:'var(--red)',   value: stats.alertsHigh,    label:'high'      },
    { icon:'●', color:'var(--amber)', value: stats.alertsMedium,  label:'medium'    },
  ]

  return (
    <footer style={{
      gridColumn:'1 / -1',
      display:'flex', alignItems:'center',
      padding:'0 16px',
      background:'var(--bg-1)',
      borderTop:'1px solid var(--border-md)',
      height:'36px', flexShrink:0,
      fontSize:'11px', fontWeight:'500', letterSpacing:'.1em',
    }}>
      {items.map((it,i) => (
        <div key={i} style={{
          display:'flex', alignItems:'center', gap:'7px',
          fontFamily:'var(--mono)', color:'var(--txt-2)',
          padding:'0 14px', height:'100%',
          borderRight:'1px solid var(--border)',
          paddingLeft: i===0 ? 0 : undefined,
        }}>
          <span style={{ fontSize:'9px', color: it.color }}>{it.icon}</span>
          <span style={{ color:'var(--txt-1)', fontWeight:'500' }}>{it.value}</span>
          <span>{it.label}</span>
        </div>
      ))}
      <div style={{
        fontFamily:'var(--mono)', color:'var(--txt-3)', fontSize:'9px',
        padding:'0 14px', borderRight:'1px solid var(--border)',
      }}>
        LAST UPDATE <span style={{ color:'var(--txt-2)' }}>{ts} UTC</span>
      </div>
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'7px',
        fontFamily:'var(--mono)', fontSize:'10px', fontWeight:'600',
        letterSpacing:'.15em', textTransform:'uppercase', color:'var(--green)',
      }}>
        <div style={{
          width:'8px', height:'8px', borderRadius:'50%',
          background:'var(--green)',
        }} />
        LIVE
      </div>
    </footer>
  )
}
