// Terminal-style empty state — no data available

export default function EmptyState({ title, subtitle, icon }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '12px', padding: '56px 24px', animation: 'fadeIn .4s ease',
    }}>
      {/* Decorative brackets */}
      <div style={{ position: 'relative', width: '48px', height: '48px', opacity: 0.25 }}>
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: '14px', height: '14px',
          borderTop: '1px solid var(--txt-3)',
          borderLeft: '1px solid var(--txt-3)',
        }} />
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: '14px', height: '14px',
          borderTop: '1px solid var(--txt-3)',
          borderRight: '1px solid var(--txt-3)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          width: '14px', height: '14px',
          borderBottom: '1px solid var(--txt-3)',
          borderLeft: '1px solid var(--txt-3)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: '14px', height: '14px',
          borderBottom: '1px solid var(--txt-3)',
          borderRight: '1px solid var(--txt-3)',
        }} />
        {icon && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--mono)', fontSize: '16px', color: 'var(--txt-3)',
          }}>
            {icon}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--label-md)', fontWeight: '700',
          letterSpacing: '.18em', color: 'var(--txt-3)', textTransform: 'uppercase',
          marginBottom: '6px',
        }}>
          {title || 'NO SIGNAL'}
        </div>
        {subtitle && (
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--label-xs)',
            color: 'var(--txt-3)', letterSpacing: '.1em', lineHeight: 1.8,
            textTransform: 'uppercase', opacity: 0.6,
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}
