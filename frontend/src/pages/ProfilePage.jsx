import { useState } from 'react'
import { useProfile } from '../hooks/useProfile'
import { authHeaders } from '../hooks/apiClient'

const FIELD = {
  background: 'rgba(0,200,255,0.04)',
  border: '1px solid rgba(0,200,255,0.15)',
  borderRadius: '4px',
  padding: '9px 12px',
  color: 'var(--txt-1)',
  fontSize: '13px',
  fontFamily: 'var(--mono)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', letterSpacing: '.12em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--txt-1)' }}>
        {value || '—'}
      </span>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '3px', padding: '16px 20px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.18em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '14px' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

export default function ProfilePage({ onNavigate }) {
  const { profile, loading, error } = useProfile()

  const [currentPass,  setCurrentPass]  = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [pwLoading,    setPwLoading]    = useState(false)
  const [pwError,      setPwError]      = useState('')
  const [pwSuccess,    setPwSuccess]    = useState('')

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPwError(''); setPwSuccess('')
    if (newPass !== confirmPass) { setPwError('Las contraseñas no coinciden'); return }
    if (newPass.length < 8)     { setPwError('Mínimo 8 caracteres'); return }
    setPwLoading(true)
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPass, new_password: newPass }),
      })
      const data = await res.json()
      if (!res.ok) { setPwError(data.detail || 'Error al cambiar contraseña'); return }
      setPwSuccess('Contraseña actualizada correctamente')
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
    } catch (_) {
      setPwError('Error de conexión')
    } finally {
      setPwLoading(false)
    }
  }

  const createdAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-0)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.22em', color: 'var(--txt-3)', textTransform: 'uppercase', flexShrink: 0 }}>
        MI CUENTA
      </div>

      {loading && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>Cargando…</div>
      )}

      {error && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--red)' }}>{error}</div>
      )}

      {profile && (
        <>
          <Section label="Datos de cuenta">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Row label="Usuario"       value={profile.username} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', letterSpacing: '.12em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>Plan</span>
                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.1em', color: 'var(--accent)', background: 'rgba(0,200,255,0.10)', border: '1px solid rgba(0,200,255,0.30)', borderRadius: '3px', padding: '2px 8px' }}>
                  {profile.plan?.toUpperCase()}
                </span>
              </div>
              <Row label="Email"         value={profile.email} />
              <Row label="Miembro desde" value={createdAt} />
            </div>
          </Section>

          <Section label="Cambiar contraseña">
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="password"
                placeholder="Contraseña actual"
                value={currentPass}
                onChange={e => setCurrentPass(e.target.value)}
                required
                style={FIELD}
              />
              <input
                type="password"
                placeholder="Nueva contraseña (mín. 8 caracteres)"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                required
                style={FIELD}
              />
              <input
                type="password"
                placeholder="Confirmar nueva contraseña"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                required
                style={FIELD}
              />
              {pwError && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--red)' }}>{pwError}</div>
              )}
              {pwSuccess && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--green)' }}>{pwSuccess}</div>
              )}
              <button
                type="submit"
                disabled={pwLoading}
                style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(0,200,255,0.10)',
                  border: '1px solid rgba(0,200,255,0.30)',
                  borderRadius: '4px',
                  color: 'var(--accent)',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--label-sm)',
                  fontWeight: '700',
                  letterSpacing: '.1em',
                  padding: '8px 20px',
                  cursor: pwLoading ? 'default' : 'pointer',
                  opacity: pwLoading ? 0.5 : 1,
                  transition: 'opacity .15s',
                }}
              >
                {pwLoading ? 'GUARDANDO…' : 'ACTUALIZAR CONTRASEÑA'}
              </button>
            </form>
          </Section>

          <Section label="Plan de suscripción">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '.1em' }}>
                  {profile.plan?.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', marginTop: '3px' }}>
                  Plan actual
                </div>
              </div>
              <button
                onClick={() => onNavigate('plans')}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--txt-2)',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--label-sm)',
                  fontWeight: '600',
                  letterSpacing: '.1em',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  transition: 'border-color .15s, color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt-2)' }}
              >
                CAMBIAR PLAN →
              </button>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
