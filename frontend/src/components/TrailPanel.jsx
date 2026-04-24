import { useState } from 'react'

export default function TrailPanel({ aircraft, trails, onAdd, onRemove, onClear }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const [hours,  setHours]  = useState(6)

  const filtered = aircraft.filter(a => {
    const q = search.toLowerCase()
    return !q
      || (a.callsign || '').toLowerCase().includes(q)
      || (a.id       || '').toLowerCase().includes(q)
      || (a.zone     || '').toLowerCase().includes(q)
  })

  const activeCount = Object.keys(trails).length

  return (
    <div style={{
      position: 'absolute', top: '12px', left: '12px', zIndex: 10,
      fontFamily: 'var(--mono)',
    }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: open ? 'rgba(19,19,22,0.97)' : 'rgba(19,19,22,0.88)',
          border: `1px solid ${activeCount > 0 ? 'rgba(79,156,249,0.5)' : 'var(--border-md)'}`,
          borderRadius: '3px', padding: '5px 10px',
          color: activeCount > 0 ? 'var(--accent)' : 'var(--txt-2)',
          fontSize: 'var(--label-xs)', fontWeight: '700', letterSpacing: '.14em',
          cursor: 'pointer', transition: 'all .15s',
        }}
      >
        <span style={{ fontSize: '11px' }}>✈</span>
        TRAYECTORIAS
        {activeCount > 0 && (
          <span style={{
            background: 'var(--accent)', color: 'var(--bg-0)',
            borderRadius: '10px', padding: '0 5px',
            fontSize: 'var(--label-xs)', fontWeight: '700',
          }}>
            {activeCount}
          </span>
        )}
        <span style={{ fontSize: '9px', opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          marginTop: '4px',
          background: 'rgba(13,13,16,0.97)',
          border: '1px solid var(--border-md)',
          borderRadius: '3px',
          width: '280px',
          maxHeight: '420px',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {/* Header */}
          <div style={{
            padding: '8px 10px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar callsign / ICAO…"
              style={{
                flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: '2px', color: 'var(--txt-1)',
                fontSize: 'var(--label-sm)', padding: '4px 7px', outline: 'none',
                fontFamily: 'var(--mono)',
              }}
            />
            {/* Hours selector */}
            <select
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                color: 'var(--txt-2)', borderRadius: '2px',
                fontSize: 'var(--label-xs)', padding: '4px 4px',
                fontFamily: 'var(--mono)', cursor: 'pointer', outline: 'none',
              }}
            >
              <option value={1}>1h</option>
              <option value={6}>6h</option>
              <option value={12}>12h</option>
              <option value={24}>24h</option>
              <option value={48}>48h</option>
            </select>
          </div>

          {/* Active trails */}
          {activeCount > 0 && (
            <div style={{ padding: '6px 10px 4px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 'var(--label-xs)', color: 'var(--txt-3)', letterSpacing: '.15em', marginBottom: '5px' }}>
                ACTIVAS
              </div>
              {Object.entries(trails).map(([icao24, trail]) => (
                <div key={icao24} style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '3px 0',
                }}>
                  <div style={{ width: '10px', height: '3px', background: trail.color, borderRadius: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--label-sm)', color: 'var(--txt-1)', flex: 1 }}>
                    {trail.aircraft?.callsign || icao24.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 'var(--label-xs)', color: 'var(--txt-3)' }}>
                    {trail.loading ? '…' : `${trail.points?.length || 0}pts`}
                  </span>
                  {trail.bases?.length > 0 && (
                    <span style={{ fontSize: 'var(--label-xs)', color: trail.bases[0].is_military ? 'var(--red)' : 'var(--txt-3)' }}>
                      {trail.bases[0].airfield_icao}
                    </span>
                  )}
                  <button
                    onClick={() => onRemove(icao24)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--txt-3)',
                      cursor: 'pointer', fontSize: '12px', padding: '0 2px', lineHeight: 1,
                    }}
                  >×</button>
                </div>
              ))}
              <button
                onClick={onClear}
                style={{
                  marginTop: '4px', width: '100%', background: 'none',
                  border: '1px solid var(--border)', borderRadius: '2px',
                  color: 'var(--txt-3)', fontSize: 'var(--label-xs)',
                  padding: '3px', cursor: 'pointer', letterSpacing: '.1em',
                }}
              >
                LIMPIAR TODAS
              </button>
            </div>
          )}

          {/* Aircraft list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: 'var(--label-xs)', color: 'var(--txt-3)' }}>
                SIN AERONAVES VISIBLES
              </div>
            )}
            {filtered.map(a => {
              const icao24  = a.id || a.icao24
              const active  = !!trails[icao24]
              const color   = trails[icao24]?.color
              const isMil   = a.type === 'military'
              return (
                <div
                  key={icao24}
                  onClick={() => onAdd(a, hours)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 10px',
                    background: active ? 'rgba(79,156,249,0.07)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'background .12s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  {active
                    ? <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isMil ? 'var(--red)' : 'var(--txt-3)', opacity: 0.4, flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--label-sm)', color: active ? 'var(--accent)' : 'var(--txt-1)', fontWeight: '600' }}>
                      {a.callsign || icao24.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 'var(--label-xs)', color: 'var(--txt-3)' }}>
                      {icao24.toUpperCase()} · {a.zone || '—'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 'var(--label-xs)', padding: '1px 5px', borderRadius: '2px',
                    background: isMil ? 'rgba(244,63,94,0.12)' : 'var(--bg-3)',
                    color: isMil ? 'var(--red)' : 'var(--txt-3)',
                    flexShrink: 0,
                  }}>
                    {isMil ? 'MIL' : 'CIV'}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={{ padding: '5px 10px', borderTop: '1px solid var(--border)', fontSize: 'var(--label-xs)', color: 'var(--txt-3)' }}>
            {filtered.length} aeronaves · máx. 15 trails simultáneos
          </div>
        </div>
      )}
    </div>
  )
}
