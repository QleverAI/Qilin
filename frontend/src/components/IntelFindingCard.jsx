import { useState } from 'react'

const DOMAIN_COLOR = {
  adsb_agent: '#ef4444',
  maritime_agent: '#4f9cf9',
  news_agent: '#f59e0b',
  social_agent: '#a855f7',
}

export default function IntelFindingCard({ item }) {
  const [open, setOpen] = useState(false)
  const color = DOMAIN_COLOR[item.agent_name] || 'var(--txt-3)'
  const score = item.anomaly_score || 0

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`,
      background: 'var(--bg-0)',
      borderRadius: '4px', padding: '10px 12px', marginBottom: '6px',
      fontFamily: 'var(--mono)',
    }}>
      <div style={{ display:'flex', gap:'8px', alignItems:'baseline', marginBottom: '4px' }}>
        <span style={{ color, fontWeight: 700, fontSize: '11px', letterSpacing: '.08em' }}>
          {item.agent_name?.replace('_agent','').toUpperCase()}
        </span>
        <span style={{ color: 'var(--txt-3)', fontSize: '10px' }}>
          {new Date(item.time).toLocaleString('es-ES', { hour12: false, timeZone: 'UTC' })} UTC
        </span>
        <span style={{ marginLeft: 'auto', color, fontWeight: 700, fontSize: '11px' }}>
          score {score}/10
        </span>
      </div>
      <div style={{ color: 'var(--txt-2)', fontSize: '12px', lineHeight: 1.5 }}>
        {item.summary}
      </div>
      {open && (
        <pre style={{
          marginTop: '8px', padding: '8px', background: 'var(--bg-2)',
          color: 'var(--txt-2)', fontSize: '11px', borderRadius: '3px',
          overflow: 'auto', maxHeight: '260px',
        }}>
          {JSON.stringify(item.raw_output || {}, null, 2)}
        </pre>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          marginTop: '4px', background: 'none', border: 'none',
          color: 'var(--txt-3)', fontFamily: 'var(--mono)', fontSize: '10px',
          cursor: 'pointer', padding: 0,
        }}
      >{open ? '▴ collapse' : `▾ ${(item.tools_called || []).length} tools · ${item.duration_ms || 0}ms`}</button>
    </div>
  )
}
