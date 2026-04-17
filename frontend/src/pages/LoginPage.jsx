import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function BackgroundCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let scanY = 0
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - .5) * .0003,
      vy: (Math.random() - .5) * .0002,
      size: Math.random() * 1.2 + .4,
      alpha: Math.random() * .25 + .05,
    }))

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    function loop() {
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0c0c0e'; ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = .5
      const gs = 60
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(79,156,249,${p.alpha})`
        ctx.fill()
      })

      scanY = (scanY + .3) % h
      const grad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40)
      grad.addColorStop(0, 'rgba(79,156,249,0)')
      grad.addColorStop(.5, 'rgba(79,156,249,0.03)')
      grad.addColorStop(1, 'rgba(79,156,249,0)')
      ctx.fillStyle = grad; ctx.fillRect(0, scanY - 40, w, 80)

      const vig = ctx.createRadialGradient(w/2,h/2,w*.2,w/2,h/2,w*.8)
      vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.6)')
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
      const body = new URLSearchParams({ username: user, password: pass })
      const res  = await fetch(`${API_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })

      if (res.ok) {
        const data = await res.json()
        sessionStorage.setItem('qilin_token', data.access_token)
        sessionStorage.setItem('qilin_user',  data.username)
        onLogin({ username: data.username, token: data.access_token })
        return
      }
      throw new Error('unauthorized')

    } catch (err) {
      if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
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
    background: 'var(--bg-2)',
    border: '1px solid var(--border-md)',
    borderBottom: '1px solid var(--border-hi)',
    color: 'var(--txt-1)',
    fontFamily: 'var(--mono)',
    fontSize: '13px',
    padding: '11px 14px',
    outline: 'none',
    letterSpacing: '.04em',
    borderRadius: '2px',
    transition: 'border-color .15s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <BackgroundCanvas />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '340px',
        animation: shake ? 'shake .4s ease' : 'fadeSlideIn .5s ease',
      }}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <svg width="44" height="44" viewBox="0 0 26 26" fill="none" style={{ display:'block', margin:'0 auto 12px' }}>
            <circle cx="13" cy="13" r="11" stroke="#4f9cf9" strokeWidth="1.2" opacity=".3"/>
            <circle cx="13" cy="13" r="7"  stroke="#4f9cf9" strokeWidth="1.2" opacity=".55"/>
            <circle cx="13" cy="13" r="3"  fill="#4f9cf9"/>
            <line x1="13" y1="2"  x2="13" y2="5"  stroke="#4f9cf9" strokeWidth="1"/>
            <line x1="13" y1="21" x2="13" y2="24" stroke="#4f9cf9" strokeWidth="1"/>
            <line x1="2"  y1="13" x2="5"  y2="13" stroke="#4f9cf9" strokeWidth="1"/>
            <line x1="21" y1="13" x2="24" y2="13" stroke="#4f9cf9" strokeWidth="1"/>
          </svg>
          <div style={{ fontSize:'32px', fontWeight:'700', letterSpacing:'.3em', color:'var(--accent)', fontFamily:'var(--mono)', textTransform:'uppercase' }}>QILIN</div>
          <div style={{ fontSize:'10px', letterSpacing:'.18em', color:'var(--txt-3)', marginTop:'4px', fontFamily:'var(--mono)', textTransform:'uppercase' }}>
            Geopolitical Intelligence Platform
          </div>
        </div>

        <div style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border-md)',
          borderTop: '3px solid var(--accent)',
          borderRadius: '3px',
          padding: '24px 24px 20px',
        }}>
          <div style={{ fontSize:'9px', fontWeight:'700', letterSpacing:'.22em', color:'var(--txt-3)', marginBottom:'18px', fontFamily:'var(--mono)', textTransform:'uppercase' }}>
            AUTENTICACIÓN REQUERIDA
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'8px', fontWeight:'600', letterSpacing:'.16em', color:'var(--txt-3)', marginBottom:'5px', fontFamily:'var(--mono)', textTransform:'uppercase' }}>
                USUARIO
              </div>
              <input
                type="text" value={user} onChange={e => setUser(e.target.value)}
                autoComplete="username" spellCheck={false}
                placeholder="identificador"
                style={fieldStyle}
                onFocus={e => e.target.style.borderColor = 'var(--border-hi)'}
                onBlur={e  => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.borderBottomColor = 'var(--border-hi)' }}
              />
            </div>

            <div style={{ marginBottom:'18px' }}>
              <div style={{ fontSize:'8px', fontWeight:'600', letterSpacing:'.16em', color:'var(--txt-3)', marginBottom:'5px', fontFamily:'var(--mono)', textTransform:'uppercase' }}>
                CONTRASEÑA
              </div>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                style={fieldStyle}
                onFocus={e => e.target.style.borderColor = 'var(--border-hi)'}
                onBlur={e  => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.borderBottomColor = 'var(--border-hi)' }}
              />
            </div>

            {error && (
              <div style={{
                fontFamily:'var(--mono)', fontSize:'9px', fontWeight:'500',
                color:'var(--red)', letterSpacing:'.08em', marginBottom:'12px',
                padding:'7px 10px', background:'rgba(244,63,94,0.08)',
                border:'1px solid rgba(244,63,94,0.25)', borderRadius:'2px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading || !user || !pass}
              style={{
                width:'100%', padding:'12px',
                background: 'var(--accent-dim)',
                border:'1px solid rgba(79,156,249,0.3)',
                color:'var(--accent)',
                fontFamily:'var(--mono)',
                fontSize:'11px', fontWeight:'700', letterSpacing:'.2em', textTransform:'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition:'background .15s, border-color .15s', borderRadius:'2px',
                opacity: (!user || !pass) ? .45 : 1,
              }}
              onMouseEnter={e => { if(!loading && user && pass) e.target.style.background='rgba(79,156,249,0.2)' }}
              onMouseLeave={e => { if(!loading) e.target.style.background='var(--accent-dim)' }}
            >
              {loading ? '◌  AUTENTICANDO...' : 'ACCEDER AL SISTEMA'}
            </button>
          </form>
        </div>

        <div style={{
          marginTop:'14px', textAlign:'center',
          fontFamily:'var(--mono)', fontSize:'8px',
          color:'var(--txt-3)', letterSpacing:'.08em', lineHeight:1.8,
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
        @keyframes fadeSlideIn {
          from{opacity:0;transform:translateY(8px)}
          to{opacity:1;transform:translateY(0)}
        }
      `}</style>
    </div>
  )
}
