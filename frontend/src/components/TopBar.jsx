import { useEffect, useRef, useState } from 'react'
import { useLang } from '../hooks/useLanguage'

const NAV_ITEMS = [
  { id: 'home',       key: 'nav.home'      },
  { id: 'intel',      key: 'nav.intel'     },
  { id: 'tactical',   key: 'nav.tactical'  },
  { id: 'news',       key: 'nav.news'      },
  { id: 'documents',  key: 'nav.documents' },
  { id: 'social',     key: 'nav.social'    },
  { id: 'sentinel',   key: 'nav.sentinel'  },
  { id: 'markets',    key: 'nav.markets'   },
  { id: 'polymarket', key: 'nav.polymarket'},
]


export default function TopBar({ alertsTotal, wsStatus, currentView, onNavigate, onLogout,
                                  topicsOnly, onToggleTopics, hasTopics }) {
  const [time, setTime] = useState('')
  const [username] = useState(() => sessionStorage.getItem('qilin_user') || '')
  const [ddOpen, setDdOpen] = useState(false)
  const ddRef = useRef(null)
  const { lang, switchLang, t } = useLang()

  useEffect(() => {
    if (!ddOpen) return
    function handleClick(e) {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ddOpen])

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
        <img src="/brand/qilin-logo-nobg.png" alt="" style={{ width:28, height:28, objectFit:'contain' }} />
        <span style={{
          fontSize:'18px', fontWeight:'700', letterSpacing:'.22em',
          color:'var(--cyan)', textTransform:'uppercase', fontFamily:'var(--mono)',
        }}>
          Qilin
        </span>
      </div>

      {/* Separator */}
      <div style={{ width:'1px', height:'18px', background:'var(--border-md)', marginRight:'14px', flexShrink:0 }} />

      {/* Navigation tabs */}
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
              {t(item.key)}
            </button>
          )
        })}
      </nav>

      {/* Right side */}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'12px' }}>

        {/* My feed toggle — only shown when user has topics */}
        {hasTopics && (
          <button
            onClick={onToggleTopics}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: topicsOnly ? 'rgba(0,200,255,0.12)' : 'transparent',
              border: topicsOnly
                ? '1px solid rgba(0,200,255,0.35)'
                : '1px solid var(--border-md)',
              borderRadius: '3px',
              color: topicsOnly ? 'var(--cyan)' : 'var(--txt-3)',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--label-sm)',
              fontWeight: '600',
              letterSpacing: '.08em',
              padding: '4px 10px',
              cursor: 'pointer',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { if (!topicsOnly) e.currentTarget.style.color = 'var(--txt-1)' }}
            onMouseLeave={e => { if (!topicsOnly) e.currentTarget.style.color = 'var(--txt-3)' }}
            title={topicsOnly ? 'Showing your topics — click for all' : 'Click to filter by your topics'}
          >
            {topicsOnly ? '◉' : '○'} MY FEED
          </button>
        )}

        {/* ES | EN language toggle */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'var(--bg-2)',
          border: '1px solid var(--border-md)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          {['es', 'en'].map((l, i) => {
            const active = lang === l
            return (
              <button
                key={l}
                onClick={() => switchLang(l)}
                style={{
                  background: active ? 'rgba(79,156,249,0.15)' : 'transparent',
                  border: 'none',
                  borderRight: i === 0 ? '1px solid var(--border-md)' : 'none',
                  color: active ? 'var(--cyan)' : 'var(--txt-2)',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--label-sm)',
                  fontWeight: '600',
                  letterSpacing: '.10em',
                  padding: '5px 11px',
                  cursor: 'pointer',
                  transition: 'color .15s, background .15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--txt-1)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--txt-2)' }}
              >
                {l.toUpperCase()}
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
          <button
            onClick={() => onNavigate('intel')}
            style={{
              display:'flex', alignItems:'center', gap:'5px',
              background:'rgba(244,63,94,0.10)',
              border:'1px solid rgba(244,63,94,0.30)',
              borderRadius:'3px', padding:'3px 8px',
              fontFamily:'var(--mono)', fontSize:'var(--label-sm)', fontWeight:'600',
              color:'var(--red)', cursor:'pointer',
            }}
          >
            <div style={{
              width:'4px', height:'4px', borderRadius:'50%',
              background:'var(--red)', animation:'blink 1.2s ease-in-out infinite',
            }} />
            {alertsTotal} ALT
          </button>
        )}

        {/* Clock */}
        <div style={{
          fontFamily:'var(--mono)', fontSize:'var(--label-md)',
          color:'var(--txt-2)', letterSpacing:'.06em',
        }}>
          <span style={{ color:'var(--txt-3)', fontSize:'var(--label-sm)' }}>UTC </span>
          <span style={{ color:'var(--txt-1)' }}>{time}</span>
        </div>

        {/* User dropdown */}
        <div ref={ddRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDdOpen(o => !o)}
            style={{
              background: ddOpen ? 'rgba(0,200,255,0.12)' : 'rgba(0,200,255,0.06)',
              border: '1px solid rgba(0,200,255,0.25)',
              borderRadius: '3px',
              color: 'var(--accent)',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--label-sm)',
              fontWeight: '600',
              letterSpacing: '.08em',
              padding: '4px 10px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              transition: 'background .15s',
            }}
          >
            {username}
            <span style={{ fontSize: '9px', opacity: 0.7 }}>{ddOpen ? '▴' : '▾'}</span>
          </button>

          {ddOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: 'var(--bg-1)',
              border: '1px solid var(--border-md)',
              borderRadius: '4px',
              minWidth: '200px',
              zIndex: 200,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: '700', color: 'var(--txt-1)' }}>
                  {username}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--accent)', letterSpacing: '.08em', marginTop: '3px' }}>
                  PLAN SCOUT
                </div>
              </div>
              <div style={{ padding: '4px 0' }}>
                <button
                  onClick={() => { setDdOpen(false); onNavigate('profile') }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'none', border: 'none',
                    fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                    color: 'var(--txt-2)', padding: '8px 14px',
                    cursor: 'pointer', letterSpacing: '.06em',
                    transition: 'color .1s, background .1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--txt-1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--txt-2)' }}
                >
                  ⚙ {t('topbar.profile')}
                </button>
                <button
                  onClick={() => { setDdOpen(false); onLogout?.() }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: 'none', border: 'none',
                    borderTop: '1px solid var(--border)',
                    fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                    color: 'var(--red)', padding: '8px 14px',
                    cursor: 'pointer', letterSpacing: '.06em',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {t('topbar.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
