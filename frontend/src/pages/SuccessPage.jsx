import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SuccessPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/app', { replace: true }), 5000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh', background: '#02060e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <div style={{
        textAlign: 'center', maxWidth: 480, padding: '0 24px',
      }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>✓</div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: '#f0f4f8', marginBottom: 12,
        }}>
          Pago completado
        </div>
        <div style={{
          fontSize: 14, color: 'rgba(220,230,245,0.55)', lineHeight: 1.7, marginBottom: 32,
        }}>
          Tu suscripción está activa. Redirigiendo a la plataforma…
        </div>
        <button
          onClick={() => navigate('/app', { replace: true })}
          style={{
            background: 'rgba(200,160,60,0.15)', border: '1px solid #c8a03c',
            borderRadius: 8, color: '#e8c060', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', padding: '12px 32px',
          }}
        >
          Ir a la plataforma
        </button>
      </div>
    </div>
  )
}
