import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'

const PLAN_LABELS = { scout: 'Scout — Gratis', analyst: 'Analyst — $49/mes', command: 'Command — $199/mes' }

export default function RegisterPage() {
  const [username,  setUsername]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const navigate = useNavigate()
  const [params]  = useSearchParams()
  const plan      = params.get('plan') || 'scout'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== password2) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8)    { setError('Contraseña mínimo 8 caracteres'); return }
    setLoading(true)
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.toLowerCase(), email, password }),
      })
      if (res.status === 409) { setError('Usuario o email ya registrado'); return }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || 'Error al crear la cuenta'); return
      }
      const { access_token } = await res.json()
      sessionStorage.setItem('qilin_token', access_token)
      sessionStorage.setItem('qilin_user', username.toLowerCase())
      navigate('/app', { replace: true })
    } catch (_) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background:'rgba(200,160,60,0.05)', border:'1px solid rgba(200,160,60,0.18)',
    borderRadius:'6px', padding:'12px 14px', color:'#f0f4f8',
    fontSize:'14px', fontFamily:'inherit', outline:'none', width:'100%',
  }

  return (
    <div style={{ minHeight:'100vh', background:'#02060e', display:'flex',
      alignItems:'center', justifyContent:'center', padding:'24px',
      fontFamily:"'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ width:'100%', maxWidth:'420px' }}>
        <div style={{ textAlign:'center', marginBottom:'36px' }}>
          <Link to="/" style={{ textDecoration:'none' }}>
            <div style={{ fontSize:'18px', fontWeight:'700', letterSpacing:'.3em',
              color:'#c8a03c', textTransform:'uppercase', fontFamily:"'IBM Plex Mono',monospace",
              marginBottom:'8px' }}>◈ QILIN</div>
          </Link>
          <div style={{ fontSize:'22px', fontWeight:'800', color:'#fff', marginBottom:'6px' }}>
            Crear cuenta
          </div>
          {plan !== 'scout' && (
            <div style={{ display:'inline-block', padding:'4px 14px',
              background:'rgba(200,160,60,0.1)', border:'1px solid rgba(200,160,60,0.3)',
              borderRadius:'20px', fontSize:'12px', color:'#c8a03c' }}>
              Plan seleccionado: {PLAN_LABELS[plan] || plan}
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label style={{ display:'block', fontSize:'12px', color:'rgba(220,230,245,0.5)',
              marginBottom:'6px', letterSpacing:'.05em' }}>Usuario</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="nombre de usuario" required autoFocus style={inputStyle} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'12px', color:'rgba(220,230,245,0.5)',
              marginBottom:'6px', letterSpacing:'.05em' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com" required style={inputStyle} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'12px', color:'rgba(220,230,245,0.5)',
              marginBottom:'6px', letterSpacing:'.05em' }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres" required style={inputStyle} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'12px', color:'rgba(220,230,245,0.5)',
              marginBottom:'6px', letterSpacing:'.05em' }}>Confirmar contraseña</label>
            <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
              placeholder="repite la contraseña" required style={inputStyle} />
          </div>
          {error && (
            <div style={{ fontSize:'13px', color:'#ff453a', background:'rgba(255,69,58,0.08)',
              border:'1px solid rgba(255,69,58,0.2)', borderRadius:'6px',
              padding:'10px 14px', textAlign:'center' }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            marginTop:'4px', padding:'14px',
            background: loading ? 'rgba(200,160,60,0.08)' : 'rgba(200,160,60,0.15)',
            border:'1px solid #c8a03c', borderRadius:'8px', color:'#e8c060',
            fontSize:'14px', fontWeight:'600', cursor: loading ? 'default' : 'pointer',
            fontFamily:'inherit', opacity: loading ? .7 : 1, transition:'all .2s',
          }}>
            {loading ? 'Creando cuenta…' : 'Crear cuenta →'}
          </button>
        </form>
        <div style={{ textAlign:'center', marginTop:'20px', fontSize:'13px',
          color:'rgba(220,230,245,0.35)' }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color:'rgba(200,160,60,0.7)', textDecoration:'none' }}>
            Iniciar sesión
          </Link>
          {' '}·{' '}
          <Link to="/" style={{ color:'rgba(220,230,245,0.25)', textDecoration:'none' }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
