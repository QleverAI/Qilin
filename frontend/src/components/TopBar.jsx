import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { id: 'home',      label: 'INICIO'     },
  { id: 'tactical',  label: 'TÁCTICO'    },
  { id: 'news',      label: 'NOTICIAS'   },
  { id: 'documents', label: 'DOCUMENTOS' },
  { id: 'social',    label: 'SOCIAL'     },
]

function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
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

export default function TopBar({ alertsTotal, wsStatus, currentView, onNavigate }) {
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
  const wsLabel = wsStatus === 'connected' ? 'LIVE' : wsStatus === 'error' ? 'ERROR' : 'MOCK'

  return (
    <header style={{
      gridColumn: '1 / -1',
      display: 'flex', alignItems: 'center',
      padding: '0 16px',
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--border-md)',
      height: '44px', flexShrink: 0, zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginRight:'20px', flexShrink:0 }}>
        <LogoIcon />
        <span style={{ fontSize:'18px', fontWeight:'700', letterSpacing:'.25em', color:'var(--cyan)', textTransform:'uppercase' }}>
          Qilin
        </span>
      </div>

      {/* Separator */}
      <div style={{ width:'1px', height:'20px', background:'var(--border-md)', marginRight:'16px', flexShrink:0 }} />

      {/* Navigation tabs */}
      <nav style={{ display:'flex', alignItems:'stretch', height:'100%', gap:'2px' }}>
        {NAV_ITEMS.map(item => {
          const active = currentView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
                color: active ? 'var(--cyan)' : 'var(--txt-3)',
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                fontWeight: '600',
                letterSpacing: '.14em',
                padding: '0 12px',
                cursor: 'pointer',
                transition: 'color .15s, border-color .15s',
                marginBottom: active ? '-1px' : 0,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--txt-2)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--txt-3)' }}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Right side */}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'14px' }}>
        {/* WS status */}
        <div style={{
          display:'flex', alignItems:'center', gap:'5px',
          fontFamily:'var(--mono)', fontSize:'10px', color: wsColor,
        }}>
          <div style={{
            width:'5px', height:'5px', borderRadius:'50%',
            background: wsColor, boxShadow: `0 0 5px ${wsColor}`,
            animation: 'blink 2.4s ease-in-out infinite',
          }} />
          {wsLabel}
        </div>

        {/* Alerts badge */}
        {alertsTotal > 0 && (
          <div style={{
            display:'flex', alignItems:'center', gap:'5px',
            background:'rgba(255,59,74,0.12)', border:'1px solid rgba(255,59,74,0.35)',
            borderRadius:'3px', padding:'3px 9px',
            fontFamily:'var(--mono)', fontSize:'10px', fontWeight:'600',
            color:'var(--red)',
          }}>
            <div style={{
              width:'5px', height:'5px', borderRadius:'50%',
              background:'var(--red)', boxShadow:'0 0 5px var(--red)',
              animation:'blink 1.2s ease-in-out infinite',
            }} />
            {alertsTotal} ALERTAS
          </div>
        )}

        {/* Clock */}
        <div style={{ fontFamily:'var(--mono)', fontSize:'12px', color:'var(--txt-3)', letterSpacing:'.08em' }}>
          UTC <span style={{ color:'var(--cyan-dim)' }}>{time}</span>
        </div>
      </div>
    </header>
  )
}
