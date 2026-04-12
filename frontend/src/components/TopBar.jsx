import { useEffect, useState } from 'react'

const s = {
  bar: {
    gridColumn: '1 / -1',
    display: 'flex', alignItems: 'center',
    padding: '0 16px',
    background: 'var(--bg-1)',
    borderBottom: '1px solid var(--border-md)',
    height: '44px', flexShrink: 0, zIndex: 10,
    gap: 0,
  },
  logo: { display:'flex', alignItems:'center', gap:'10px', marginRight:'28px' },
  logoText: {
    fontSize:'20px', fontWeight:'700', letterSpacing:'.25em',
    color:'var(--cyan)', textTransform:'uppercase',
  },
  sep: { width:'1px', height:'24px', background:'var(--border-md)', margin:'0 16px' },
  statusItem: {
    display:'flex', alignItems:'center', gap:'6px',
    fontSize:'11px', fontWeight:'500', letterSpacing:'.12em',
    textTransform:'uppercase', color:'var(--txt-2)',
    fontFamily:'var(--mono)', marginRight:'20px',
  },
  dot: (color='var(--green)') => ({
    width:'6px', height:'6px', borderRadius:'50%',
    background: color,
    boxShadow: `0 0 6px ${color}`,
    animation: 'blink 2.4s ease-in-out infinite',
  }),
  right: { marginLeft:'auto', display:'flex', alignItems:'center', gap:'16px' },
  alertBadge: {
    display:'flex', alignItems:'center', gap:'6px',
    background:'rgba(255,59,74,0.12)', border:'1px solid rgba(255,59,74,0.35)',
    borderRadius:'3px', padding:'3px 10px',
    fontSize:'11px', fontWeight:'600', letterSpacing:'.10em',
    color:'var(--red)', fontFamily:'var(--mono)',
  },
  alertDot: {
    width:'5px', height:'5px', borderRadius:'50%',
    background:'var(--red)', boxShadow:'0 0 5px var(--red)',
    animation:'blink 1.2s ease-in-out infinite',
  },
  clock: { fontFamily:'var(--mono)', fontSize:'13px', color:'var(--txt-2)', letterSpacing:'.08em' },
  meta: { fontSize:'10px', letterSpacing:'.12em', color:'var(--txt-3)', fontWeight:'500' },
}

function LogoIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="11" stroke="#00c8ff" strokeWidth="1.2" opacity=".4"/>
      <circle cx="13" cy="13" r="7"  stroke="#00c8ff" strokeWidth="1.2" opacity=".6"/>
      <circle cx="13" cy="13" r="3"  fill="#00c8ff" opacity=".9"/>
      <line x1="13" y1="2"  x2="13" y2="6"  stroke="#00c8ff" strokeWidth="1" opacity=".5"/>
      <line x1="13" y1="20" x2="13" y2="24" stroke="#00c8ff" strokeWidth="1" opacity=".5"/>
      <line x1="2"  y1="13" x2="6"  y2="13" stroke="#00c8ff" strokeWidth="1" opacity=".5"/>
      <line x1="20" y1="13" x2="24" y2="13" stroke="#00c8ff" strokeWidth="1" opacity=".5"/>
    </svg>
  )
}

export default function TopBar({ alertsTotal, wsStatus }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const hh = String(now.getUTCHours()).padStart(2,'0')
      const mm = String(now.getUTCMinutes()).padStart(2,'0')
      const ss = String(now.getUTCSeconds()).padStart(2,'0')
      setTime(`${hh}:${mm}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const wsColor = wsStatus === 'connected' ? 'var(--green)' : wsStatus === 'error' ? 'var(--red)' : 'var(--amber)'
  const wsLabel = wsStatus === 'connected' ? 'CONNECTED' : wsStatus === 'error' ? 'ERROR' : 'MOCK DATA'

  return (
    <header style={s.bar}>
      <div style={s.logo}>
        <LogoIcon />
        <span style={s.logoText}>Qilin</span>
      </div>

      <div style={s.sep} />

      <div style={s.statusItem}><div style={s.dot('var(--green)')} />ADS-B LIVE</div>
      <div style={s.statusItem}><div style={s.dot('var(--green)')} />AIS LIVE</div>
      <div style={s.statusItem}><div style={s.dot('var(--amber)')} />NEWS FEED</div>

      <div style={s.sep} />
      <div style={{ ...s.statusItem, color:'var(--txt-3)', marginRight:0 }}>10 ZONAS · 8 CHOKEPOINTS</div>

      <div style={s.right}>
        <div style={{ ...s.statusItem, color: wsColor, marginRight:0 }}>
          <div style={s.dot(wsColor)} />{wsLabel}
        </div>
        <div style={s.alertBadge}>
          <div style={s.alertDot} />
          <span>{alertsTotal}</span> ALERTAS ACTIVAS
        </div>
        <div style={s.clock}>UTC <span style={{ color:'var(--cyan-dim)' }}>{time}</span></div>
      </div>
    </header>
  )
}
