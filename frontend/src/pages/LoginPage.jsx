import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useLang } from '../hooks/useLanguage'

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
      ctx.strokeStyle = 'rgba(79,156,249,0.04)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(w, scanY); ctx.stroke()
      requestAnimationFrame(loop)
    }
    loop()
    return () => window.removeEventListener('resize', resize)
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, zIndex:0 }} />
}

export default function LoginPage() {
  const { t } = useLang()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const navigate   = useNavigate()
  const location   = useLocation()
  const next       = location.state?.next || '/app'

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const body = new URLSearchParams({ username, password })
      const res  = await fetch('/auth/login', { method:'POST', body })
      if (!res.ok) { setError(t('login.error_credentials')); return }
      const { access_token } = await res.json()
      sessionStorage.setItem('qilin_token', access_token)
      sessionStorage.setItem('qilin_user', username)
      navigate(next, { replace: true })
    } catch (_) {
      setError(t('login.error_connection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position:'relative', width:'100vw', height:'100vh',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:"'IBM Plex Mono',monospace", overflow:'hidden' }}>
      <BackgroundCanvas />
      <div style={{ position:'relative', zIndex:1, width:'340px' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ fontSize:'22px', fontWeight:'700', letterSpacing:'.3em',
            color:'#4f9cf9', textTransform:'uppercase', marginBottom:'8px' }}>◈ QILIN</div>
          <div style={{ fontSize:'10px', letterSpacing:'.2em', color:'rgba(200,216,232,0.4)',
            textTransform:'uppercase' }}>{t('login.subtitle')}</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder={t('login.username')} autoFocus required
            style={{ background:'rgba(79,156,249,0.06)', border:'1px solid rgba(79,156,249,0.2)',
              borderRadius:'4px', padding:'12px 14px', color:'#c8d8e8',
              fontSize:'13px', fontFamily:'inherit', outline:'none' }} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('login.password')} required
            style={{ background:'rgba(79,156,249,0.06)', border:'1px solid rgba(79,156,249,0.2)',
              borderRadius:'4px', padding:'12px 14px', color:'#c8d8e8',
              fontSize:'13px', fontFamily:'inherit', outline:'none' }} />
          {error && <div style={{ fontSize:'11px', color:'#ff3b4a', textAlign:'center' }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ marginTop:'4px', padding:'13px', background:'rgba(79,156,249,0.12)',
              border:'1px solid rgba(79,156,249,0.4)', borderRadius:'4px', color:'#4f9cf9',
              fontSize:'12px', letterSpacing:'.1em', textTransform:'uppercase',
              cursor: loading ? 'default' : 'pointer', fontFamily:'inherit',
              opacity: loading ? .6 : 1 }}>
            {loading ? t('login.loading') : t('login.submit')}
          </button>
        </form>
        <div style={{ textAlign:'center', marginTop:'20px', fontSize:'11px', color:'rgba(200,216,232,0.35)' }}>
          {t('login.no_account')}{' '}
          <Link to="/register" style={{ color:'rgba(79,156,249,0.7)', textDecoration:'none' }}>
            {t('login.create_account')}
          </Link>
          {' '}·{' '}
          <Link to="/" style={{ color:'rgba(200,216,232,0.3)', textDecoration:'none' }}>
            {t('login.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}
