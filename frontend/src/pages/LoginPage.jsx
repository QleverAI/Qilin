import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function BackgroundCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let scanY = 0
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - .5) * .0003,
      vy: (Math.random() - .5) * .0002,
      size: Math.random() * 1.5 + .5,
      alpha: Math.random() * .4 + .1,
    }))

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    function loop() {
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#030811'; ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(0,200,255,0.045)'; ctx.lineWidth = .5
      const gs = 50
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,200,255,${p.alpha})`
        ctx.fill()
      })

      scanY = (scanY + .4) % h
      const grad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30)
      grad.addColorStop(0, 'rgba(0,200,255,0)')
      grad.addColorStop(.5, 'rgba(0,200,255,0.06)')
      grad.addColorStop(1, 'rgba(0,200,255,0)')
      ctx.fillStyle = grad; ctx.fillRect(0, scanY - 30, w, 60)

      const vig = ctx.createRadialGradient(w/2,h/2,w*.2,w/2,h/2,w*.8)
      vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.7)')
      ctx.fillStyle = vig; ctx.fillRect(0,0,w,h)

      requestAnimationFrame(loop)
    }
    loop()
    return () => window.removeEventListener('resize', resize)
  }, [])
  return <canvas ref={ref} style={{ position:'fixed', inset:0, zIndex:0 }} />
}

export default function LoginPage({ onLogin }) {
  const [user, setUser]       = useState('')
  const [pass, setPass]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)

    try {
      // Intentar autenticar contra la API real
      const body = new URLSearchParams({ username: user, password: pass })
      const res  = await fetch(`${API_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })

      if (res.ok) {
        const data = await res.json()
        // Guardar token en sessionStorage (desaparece al cerrar pestaña)
        sessionStorage.setItem('qilin_token', data.access_token)
        sessionStorage.setItem('qilin_user',  data.username)
        onLogin({ username: data.username, token: data.access_token })
        return
      }

      // API respondió con error (credenciales incorrectas)
      throw new Error('unauthorized')

    } catch (err) {
      // Si el backend no está corriendo, fallback a credenciales locales (solo dev)
      if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
        // Backend offline: modo desarrollo
        setTimeout(() => {
          if (user === 'carlos' && pass === '12345') {
            onLogin({ username: user, token: null })
          } else {
            setLoading(false)
            triggerError()
          }
        }, 800)
        return
      }

      setLoading(false)
      triggerError()
    }
  }

  function triggerError() {
    setError('CREDENCIALES INVÁLIDAS — ACCESO DENEGADO')
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const fieldStyle = {
    width: '100%',
    background: 'rgba(0,200,255,0.04)',
    border: '1px solid rgba(0,200,255,0.18)',
    borderBottom: '1px solid rgba(0,200,255,0.45)',
    color: '#00c8ff',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '14px',
    padding: '11px 14px',
    outline: 'none',
    letterSpacing: '.05em',
    borderRadius: '2px',
    transition: 'all .2s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Barlow Condensed',sans-serif" }}>
      <BackgroundCanvas />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '360px',
        animation: shake ? 'shake .4s ease' : 'fadeSlideIn .5s ease',
      }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <svg width="48" height="48" viewBox="0 0 26 26" fill="none" style={{ display:'block', margin:'0 auto 12px' }}>
            <circle cx="13" cy="13" r="11" stroke="#00c8ff" strokeWidth="1.2" opacity=".3"/>
            <circle cx="13" cy="13" r="7"  stroke="#00c8ff" strokeWidth="1.2" opacity=".55"/>
            <circle cx="13" cy="13" r="3"  fill="#00c8ff"/>
            <line x1="13" y1="2"  x2="13" y2="5"  stroke="#00c8ff" strokeWidth="1"/>
            <line x1="13" y1="21" x2="13" y2="24" stroke="#00c8ff" strokeWidth="1"/>
            <line x1="2"  y1="13" x2="5"  y2="13" stroke="#00c8ff" strokeWidth="1"/>
            <line x1="21" y1="13" x2="24" y2="13" stroke="#00c8ff" strokeWidth="1"/>
          </svg>
          <div style={{ fontSize:'36px', fontWeight:'700', letterSpacing:'.3em', color:'#00c8ff', textTransform:'uppercase' }}>QILIN</div>
          <div style={{ fontSize:'11px', letterSpacing:'.2em', color:'rgba(0,200,255,0.5)', marginTop:'4px', textTransform:'uppercase' }}>
            Geopolitical Intelligence Platform
          </div>
        </div>

        <div style={{
          background: 'rgba(7,14,28,0.92)',
          border: '1px solid rgba(0,200,255,0.18)',
          borderRadius: '4px',
          padding: '28px 28px 24px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 0 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,200,255,0.05)',
        }}>
          <div style={{ fontSize:'10px', fontWeight:'700', letterSpacing:'.25em', color:'rgba(0,200,255,0.45)', marginBottom:'20px', textTransform:'uppercase' }}>
            AUTENTICACIÓN REQUERIDA
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:'14px' }}>
              <div style={{ fontSize:'9px', fontWeight:'600', letterSpacing:'.18em', color:'rgba(0,200,255,0.5)', marginBottom:'6px', textTransform:'uppercase' }}>
                USUARIO
              </div>
              <input
                type="text" value={user} onChange={e => setUser(e.target.value)}
                autoComplete="username" spellCheck={false}
                placeholder="identificador"
                style={fieldStyle}
                onFocus={e => { e.target.style.borderColor = '#00c8ff'; e.target.style.boxShadow = '0 0 15px rgba(0,200,255,0.1)' }}
                onBlur={e  => { e.target.style.borderColor = ''; e.target.style.boxShadow = '' }}
              />
            </div>

            <div style={{ marginBottom:'20px' }}>
              <div style={{ fontSize:'9px', fontWeight:'600', letterSpacing:'.18em', color:'rgba(0,200,255,0.5)', marginBottom:'6px', textTransform:'uppercase' }}>
                CONTRASEÑA
              </div>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                style={fieldStyle}
                onFocus={e => { e.target.style.borderColor = '#00c8ff'; e.target.style.boxShadow = '0 0 15px rgba(0,200,255,0.1)' }}
                onBlur={e  => { e.target.style.borderColor = ''; e.target.style.boxShadow = '' }}
              />
            </div>

            {error && (
              <div style={{
                fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', fontWeight:'500',
                color:'#ff3b4a', letterSpacing:'.1em', marginBottom:'14px',
                padding:'8px 10px', background:'rgba(255,59,74,0.08)',
                border:'1px solid rgba(255,59,74,0.25)', borderRadius:'2px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading || !user || !pass}
              style={{
                width:'100%', padding:'13px',
                background: loading ? 'rgba(0,200,255,0.08)' : 'transparent',
                border:'1px solid #00c8ff',
                color:'#00c8ff',
                fontFamily:"'Barlow Condensed',sans-serif",
                fontSize:'13px', fontWeight:'700', letterSpacing:'.3em', textTransform:'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition:'all .2s', borderRadius:'2px',
                opacity: (!user || !pass) ? .5 : 1,
              }}
              onMouseEnter={e => { if(!loading) e.target.style.background='rgba(0,200,255,0.1)' }}
              onMouseLeave={e => { if(!loading) e.target.style.background='transparent' }}
            >
              {loading ? '◌  AUTENTICANDO...' : 'ACCEDER AL SISTEMA'}
            </button>
          </form>
        </div>

        <div style={{
          marginTop:'16px', textAlign:'center',
          fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px',
          color:'rgba(0,200,255,0.2)', letterSpacing:'.1em', lineHeight:1.8,
        }}>
          SISTEMA RESTRINGIDO · ACCESO NO AUTORIZADO PROHIBIDO<br />
          TODAS LAS SESIONES SON REGISTRADAS Y MONITORIZADAS
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }
      `}</style>
    </div>
  )
}
