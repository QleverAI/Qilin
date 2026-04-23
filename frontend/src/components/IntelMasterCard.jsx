import { useState } from 'react'

const SEV_COLOR = (s) => s >= 8 ? 'var(--red)' : s >= 6 ? 'var(--amber)' : 'var(--cyan)'

export default function IntelMasterCard({ item }) {
  const [open, setOpen] = useState(false)
  const sev = item.severity || 0
  const signals = item.signals_used || []

  return (
    <div style={{
      border: '1px solid var(--border-md)',
      borderLeft: `3px solid ${SEV_COLOR(sev)}`,
      background: 'var(--bg-1)',
      borderRadius: '4px', padding: '14px 16px', marginBottom: '10px',
      fontFamily: 'var(--mono)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
        <span style={{ color: 'var(--cyan)', fontWeight: 700, letterSpacing: '.08em' }}>⭐ MASTER</span>
        <span style={{ color: 'var(--txt-3)', fontSize: 'var(--label-sm)' }}>
          {new Date(item.time).toLocaleString('es-ES', { hour12: false, timeZone: 'UTC' })} UTC
        </span>
        <span style={{ marginLeft: 'auto', color: SEV_COLOR(sev), fontWeight: 700 }}>
          SEV {sev}/10 · {item.confidence || '—'}
        </span>
      </div>
      <div style={{ color: 'var(--txt-1)', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
        {item.headline}
      </div>
      <div style={{ color: 'var(--txt-2)', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
        {open ? item.summary : (item.summary || '').slice(0, 240) + (item.summary?.length > 240 ? '…' : '')}
      </div>
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop: '10px' }}>
        {signals.map(s => (
          <span key={s} style={{
            fontSize: '10px', color: 'var(--txt-3)', padding: '2px 6px',
            border: '1px solid var(--border)', borderRadius: '2px',
          }}>{s.replace('_agent','')}</span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--txt-3)', fontSize:'10px' }}>
          action: <b style={{ color: 'var(--txt-1)' }}>{item.recommended_action || '—'}</b>
        </span>
      </div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          marginTop: '8px', background: 'none', border: 'none',
          color: 'var(--cyan)', fontFamily: 'var(--mono)', fontSize: '11px',
          cursor: 'pointer', padding: 0,
        }}
      >{open ? '▴ collapse' : '▾ expand'}</button>
    </div>
  )
}
