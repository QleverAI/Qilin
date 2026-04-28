import { useNavigate } from 'react-router-dom'

export default function CancelPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh', background: '#02060e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <div style={{
        textAlign: 'center', maxWidth: 480, padding: '0 24px',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f4f8', marginBottom: 12 }}>
          Pago cancelado
        </div>
        <div style={{
          fontSize: 14, color: 'rgba(220,230,245,0.55)', lineHeight: 1.7, marginBottom: 32,
        }}>
          No se ha realizado ningún cargo. Puedes intentarlo de nuevo cuando quieras.
        </div>
        <button
          onClick={() => navigate('/register', { replace: true })}
          style={{
            background: 'rgba(200,160,60,0.15)', border: '1px solid #c8a03c',
            borderRadius: 8, color: '#e8c060', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', padding: '12px 32px',
          }}
        >
          Volver a los planes
        </button>
      </div>
    </div>
  )
}
