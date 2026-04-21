// Terminal-style pulsing skeleton rows for loading states

const SHIMMER = {
  background: 'linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%)',
  backgroundSize: '400px 100%',
  animation: 'shimmer 1.6s ease-in-out infinite',
  borderRadius: '2px',
}

function SkeletonRow({ widths = ['60%', '40%'], height = 10, gap = 6 }) {
  return (
    <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap }}>
      {widths.map((w, i) => (
        <div key={i} style={{ ...SHIMMER, height, width: w }} />
      ))}
    </div>
  )
}

export function LoadingRows({ count = 6, variant = 'default' }) {
  const configs = {
    default: [['65%', '40%'], ['70%', '35%'], ['55%', '45%'], ['68%', '38%'], ['60%', '42%'], ['72%', '36%']],
    card:    [['80%'], ['60%', '45%'], ['50%']],
    wide:    [['75%', '50%', '30%']],
  }
  const rows = configs[variant] || configs.default
  return (
    <div style={{ animation: 'fadeIn .3s ease' }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} widths={rows[i % rows.length]} />
      ))}
    </div>
  )
}

export function LoadingCards({ count = 6 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '10px',
      animation: 'fadeIn .3s ease',
    }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderTop: '3px solid var(--bg-3)',
          borderRadius: '3px',
          padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: '8px',
          minHeight: '150px',
        }}>
          <div style={{ ...SHIMMER, height: 8, width: '40%' }} />
          <div style={{ ...SHIMMER, height: 10, width: '90%' }} />
          <div style={{ ...SHIMMER, height: 10, width: '75%' }} />
          <div style={{ ...SHIMMER, height: 10, width: '60%', marginTop: 'auto' }} />
        </div>
      ))}
    </div>
  )
}

export default function LoadingState({ message, variant = 'rows', count = 6 }) {
  if (variant === 'cards') return <LoadingCards count={count} />
  if (variant === 'rows')  return <LoadingRows  count={count} />

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '14px', padding: '48px 24px', animation: 'fadeIn .3s ease',
    }}>
      <div style={{ position: 'relative', width: '32px', height: '32px' }}>
        <div style={{
          position: 'absolute', inset: 0,
          border: '1px solid var(--border-md)', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '1px', height: '100%',
          background: 'linear-gradient(to bottom, transparent, var(--cyan), transparent)',
          animation: 'scanDown 1.2s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: '25%',
          borderRadius: '50%', background: 'var(--cyan)',
          opacity: 0.4, animation: 'blink 1.2s ease-in-out infinite',
        }} />
      </div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
        color: 'var(--txt-3)', letterSpacing: '.14em', textTransform: 'uppercase',
      }}>
        {message || 'CARGANDO DATOS…'}
      </div>
    </div>
  )
}
