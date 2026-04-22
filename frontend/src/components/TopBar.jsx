import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { id: 'home',       label: 'INICIO'     },
  { id: 'tactical',   label: 'TÁCTICO'    },
  { id: 'news',       label: 'NOTICIAS'   },
  { id: 'documents',  label: 'DOCUMENTOS' },
  { id: 'social',     label: 'SOCIAL'     },
  { id: 'sentinel',   label: 'SENTINEL'   },
  { id: 'markets',    label: 'MERCADOS'   },
  { id: 'polymarket', label: 'PREDICCIÓN' },
]

function LogoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="11" stroke="var(--accent)" strokeWidth="1.2" opacity=".4"/>
      <circle cx="13" cy="13" r="7"  stroke="var(--accent)" strokeWidth="1.2" opacity=".6"/>
      <circle cx="13" cy="13" r="3"  fill="var(--accent)" opacity=".9"/>
      <line x1="13" y1="2"  x2="13" y2="6"  stroke="var(--accent)" strokeWidth="1" opacity=".5"/>
      <line x1="13" y1="20" x2="13" y2="24" stroke="var(--accent)" strokeWidth="1" opacity=".5"/>
      <line x1="2"  y1="13" x2="6"  y2="13" stroke="var(--accent)" strokeWidth="1" opacity=".5"/>
      <line x1="20" y1="13" x2="24" y2="13" stroke="var(--accent)" strokeWidth="1" opacity=".5"/>
    </svg>
  )
}

export default function TopBar({ alertsTotal, wsStatus, currentView, onNavigate, activeMode, onModeChange }) {
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
  const wsLabel = wsStatus === 'connected' ? 'LIVE'  : wsStatus === 'error'     ? 'ERROR' : 'MOCK'

  const isAnalyst = activeMode === 'analyst'

  return (
    <header style={{
      gridColumn: '1 / -1',
      display: 'flex', alignItems: 'center',
      padding: '0 16px',
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--border-md)',
      height: '52px', flexShrink: 0, zIndex: 10,
      gap: '0',
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginRight:'16px', flexShrink:0 }}>
        <LogoIcon />
        <span style={{
          fontSize:'18px', fontWeight:'700', letterSpacing:'.22em',
          color:'var(--cyan)', textTransform:'uppercase', fontFamily:'var(--mono)',
        }}>
          Qilin
        </span>
      </div>

      {/* Separator */}
      <div style={{ width:'1px', height:'18px', background:'var(--border-md)', marginRight:'14px', flexShrink:0 }} />

      {/* Navigation tabs — hidden in analyst mode */}
      {!isAnalyst && (
        <nav style={{ display:'flex', alignItems:'stretch', height:'100%', gap:'1px' }}>
          {NAV_ITEMS.map(item => {
            const active = currentView === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  background: 'none', border: 'none',
                  borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
                  color: active ? 'var(--cyan)' : 'var(--txt-2)',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--label-sm)',
                  fontWeight: '600',
                  letterSpacing: '.10em',
                  padding: '0 15px',
                  cursor: 'pointer',
                  transition: 'color .15s, border-color .15s',
                  marginBottom: active ? '-1px' : 0,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--txt-1)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--txt-2)' }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      )}

      {isAnalyst && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
          letterSpacing: '.14em', color: 'var(--txt-2)', textTransform: 'uppercase',
        }}>
          ANALYST VIEW
        </div>
      )}

      {/* Right side */}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'12px' }}>

        {/* MAP / ANALYST toggle */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'var(--bg-2)',
          border: '1px solid var(--border-md)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          {[
            { id: 'map',     label: 'MAP'     },
            { id: 'analyst', label: 'ANALYST' },
          ].map(m => {
            const active = activeMode === m.id
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                style={{
                  background: active ? 'rgba(79,156,249,0.15)' : 'transparent',
                  border: 'none',
                  borderRight: m.id === 'map' ? '1px solid var(--border-md)' : 'none',
                  color: active ? 'var(--cyan)' : 'var(--txt-2)',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--label-sm)',
                  fontWeight: '600',
                  letterSpacing: '.10em',
                  padding: '5px 13px',
                  cursor: 'pointer',
                  transition: 'color .15s, background .15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--txt-1)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--txt-2)' }}
              >
                {m.label}
              </button>
            )
          })}
        </div>

        {/* WS status */}
        <div style={{
          display:'flex', alignItems:'center', gap:'5px',
          fontFamily:'var(--mono)', fontSize:'var(--label-sm)', color: wsColor,
        }}>
          <div style={{
            width:'5px', height:'5px', borderRadius:'50%',
            background: wsColor, animation: 'blink 2.4s ease-in-out infinite',
          }} />
          {wsLabel}
        </div>

        {/* Alerts badge */}
        {alertsTotal > 0 && (
          <div style={{
            display:'flex', alignItems:'center', gap:'5px',
            background:'rgba(244,63,94,0.10)',
            border:'1px solid rgba(244,63,94,0.30)',
            borderRadius:'3px', padding:'3px 8px',
            fontFamily:'var(--mono)', fontSize:'var(--label-sm)', fontWeight:'600',
            color:'var(--red)',
          }}>
            <div style={{
              width:'4px', height:'4px', borderRadius:'50%',
              background:'var(--red)', animation:'blink 1.2s ease-in-out infinite',
            }} />
            {alertsTotal} ALT
          </div>
        )}

        {/* Clock */}
        <div style={{
          fontFamily:'var(--mono)', fontSize:'var(--label-md)',
          color:'var(--txt-2)', letterSpacing:'.06em',
        }}>
          <span style={{ color:'var(--txt-3)', fontSize:'var(--label-sm)' }}>UTC </span>
          <span style={{ color:'var(--txt-1)' }}>{time}</span>
        </div>
      </div>
    </header>
  )
}
