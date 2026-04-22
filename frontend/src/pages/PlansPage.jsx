import { useProfile } from '../hooks/useProfile'

const PLANS = [
  {
    id: 'scout',
    name: 'SCOUT',
    price: 'Gratis',
    color: 'var(--txt-2)',
    accentColor: 'rgba(200,216,232,0.15)',
    borderColor: 'var(--border)',
    features: [
      'ADS-B global en tiempo real',
      'Alertas geopolíticas automáticas',
      'Feed de noticias (104 medios)',
      'Feed social (40 cuentas)',
      'Mapa táctico interactivo',
      'Hasta 20 aeronaves favoritas',
      'Hasta 10 fuentes favoritas por tipo',
    ],
    cta: null,
  },
  {
    id: 'analyst',
    name: 'ANALYST',
    price: 'Próximamente',
    color: 'var(--accent)',
    accentColor: 'rgba(0,200,255,0.08)',
    borderColor: 'rgba(0,200,255,0.35)',
    features: [
      'Todo lo de Scout',
      'Informes diarios y semanales en PDF',
      'Sentinel — datos satelitales NO₂/SO₂',
      'Hasta 50 aeronaves favoritas',
      'Señales convergentes avanzadas',
      'Acceso prioritario a nuevas funciones',
    ],
    cta: 'analyst',
  },
  {
    id: 'pro',
    name: 'PRO',
    price: 'Próximamente',
    color: '#c8a03c',
    accentColor: 'rgba(200,160,60,0.08)',
    borderColor: 'rgba(200,160,60,0.35)',
    features: [
      'Todo lo de Analyst',
      'Acceso a la API REST',
      'Mercados de predicción (Polymarket)',
      'Filings SEC relevantes',
      'Sin límite de favoritos',
      'Soporte directo',
    ],
    cta: 'pro',
  },
]

export default function PlansPage({ onNavigate }) {
  const { profile } = useProfile()
  const currentPlan = profile?.plan || 'scout'

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-0)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <button
          onClick={() => onNavigate('profile')}
          style={{ background: 'none', border: 'none', color: 'var(--txt-3)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', cursor: 'pointer', padding: 0, letterSpacing: '.1em' }}
        >
          ← VOLVER
        </button>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.22em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>
          PLANES
        </div>
      </div>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', flexShrink: 0 }}>
        Elige el plan que mejor se adapta a tu actividad de análisis geopolítico.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', flexShrink: 0 }}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentPlan
          return (
            <div
              key={plan.id}
              style={{
                background: isCurrent ? plan.accentColor : 'var(--bg-1)',
                border: `1px solid ${isCurrent ? plan.borderColor : 'var(--border)'}`,
                borderRadius: '4px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                position: 'relative',
              }}
            >
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  fontFamily: 'var(--mono)', fontSize: '9px', fontWeight: '700',
                  letterSpacing: '.14em', color: plan.color,
                  background: plan.accentColor, border: `1px solid ${plan.borderColor}`,
                  borderRadius: '2px', padding: '2px 7px',
                }}>
                  ACTUAL
                </div>
              )}

              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '18px', fontWeight: '700', letterSpacing: '.15em', color: plan.color }}>
                  {plan.name}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', marginTop: '4px' }}>
                  {plan.price}
                </div>
              </div>

              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px', flex: 1 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-2)', lineHeight: 1.5 }}>
                    <span style={{ color: plan.color, flexShrink: 0, marginTop: '1px' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.cta ? (
                <a
                  href={`mailto:carlosqc.work@gmail.com?subject=Upgrade Qilin - Plan ${plan.name}`}
                  style={{
                    display: 'block', textAlign: 'center',
                    background: plan.accentColor,
                    border: `1px solid ${plan.borderColor}`,
                    borderRadius: '4px',
                    color: plan.color,
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--label-sm)',
                    fontWeight: '700',
                    letterSpacing: '.1em',
                    padding: '10px',
                    textDecoration: 'none',
                    transition: 'opacity .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '.75'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  CONTACTAR
                </a>
              ) : (
                <div style={{
                  textAlign: 'center',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--label-sm)',
                  color: 'var(--txt-3)',
                  padding: '10px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                }}>
                  PLAN ACTUAL
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
