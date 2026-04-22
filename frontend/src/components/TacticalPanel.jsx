import { useState, useEffect } from 'react'
import { apiFetch } from '../hooks/apiClient'
import { useFavorites } from '../hooks/useFavorites'

const TYPE_META = {
  military: { label: 'MILITARY', color: '#f43f5e' },
  vip:      { label: 'VIP',      color: '#ffd60a' },
  civil:    { label: 'CIVIL',    color: '#4f9cf9' },
}

export default function TacticalPanel({
  selectedAircraft, onClose,
  trails, onAddTrail, onRemoveTrail,
  onFlyTo,
}) {
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const [bases,        setBases]        = useState([])
  const [routes,       setRoutes]       = useState([])
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [favOpen,      setFavOpen]      = useState(true)

  const icao24 = selectedAircraft?.id
  const hasTrail = !!(icao24 && trails[icao24])
  const tc = TYPE_META[selectedAircraft?.type] || TYPE_META.civil

  useEffect(() => {
    if (!icao24) { setBases([]); setRoutes([]); return }
    setLoadingExtra(true)
    Promise.all([
      apiFetch(`/api/aircraft/${icao24}/bases`).catch(() => []),
      apiFetch(`/api/aircraft/${icao24}/routes`).catch(() => []),
    ]).then(([b, r]) => {
      setBases(Array.isArray(b) ? b : [])
      setRoutes(Array.isArray(r) ? r : [])
    }).finally(() => setLoadingExtra(false))
  }, [icao24])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--bg-1)', overflow: 'hidden',
    }}>

      {/* ── Aircraft detail ── */}
      {selectedAircraft && (
        <div style={{
          borderBottom: '1px solid var(--border-md)',
          overflowY: 'auto', flexShrink: 0, maxHeight: '65%',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0,
          }}>
            <span style={{
              flex: 1, fontFamily: 'var(--mono)', fontWeight: 700,
              fontSize: 'var(--label-md)', color: 'var(--txt-1)',
              letterSpacing: '.06em', textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {selectedAircraft.label || selectedAircraft.id}
            </span>
            <span style={{
              fontSize: 'var(--label-sm)', fontWeight: 700,
              fontFamily: 'var(--mono)', padding: '1px 6px', borderRadius: 2,
              color: tc.color, background: `${tc.color}18`,
              border: `1px solid ${tc.color}44`, flexShrink: 0,
            }}>{tc.label}</span>
            <button
              onClick={() => toggleFavorite(selectedAircraft)}
              title={isFavorite(icao24) ? 'Quitar favorito' : 'Marcar favorito'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 17, lineHeight: 1, padding: '2px 4px',
                color: isFavorite(icao24) ? '#ffd60a' : 'var(--txt-3)',
                flexShrink: 0, transition: 'color .15s',
              }}
            >★</button>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--txt-3)',
                cursor: 'pointer', fontSize: 18, lineHeight: 1,
                padding: '2px 4px', flexShrink: 0,
              }}
            >×</button>
          </div>

          {/* Body */}
          <div style={{ padding: '10px 14px' }}>
            {/* Metrics grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '6px 12px', marginBottom: 12,
            }}>
              {[
                { label: 'ALTITUD',   value: selectedAircraft.altitude != null ? `${selectedAircraft.altitude} ft` : '—' },
                { label: 'VELOCIDAD', value: selectedAircraft.speed     != null ? `${Math.round(selectedAircraft.speed)} kt` : '—' },
                { label: 'HEADING',   value: selectedAircraft.heading   != null ? `${selectedAircraft.heading}°` : '—' },
                { label: 'ZONA',      value: selectedAircraft.zone || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{
                    fontSize: 'var(--label-sm)', color: 'var(--txt-3)',
                    fontFamily: 'var(--mono)', marginBottom: 1,
                  }}>{label}</div>
                  <div style={{
                    fontSize: 'var(--label-md)', color: 'var(--txt-1)',
                    fontFamily: 'var(--mono)',
                  }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Trail button */}
            <button
              onClick={() => hasTrail ? onRemoveTrail(icao24) : onAddTrail(selectedAircraft)}
              style={{
                width: '100%', padding: '7px 0', marginBottom: 14,
                background: hasTrail ? 'rgba(79,156,249,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${hasTrail ? 'rgba(79,156,249,0.5)' : 'var(--border)'}`,
                borderRadius: 2,
                color: hasTrail ? 'var(--accent)' : 'var(--txt-2)',
                fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                fontWeight: 700, letterSpacing: '.1em', cursor: 'pointer',
              }}
            >
              {hasTrail ? 'TRAIL ON — DESACTIVAR' : 'TRAIL — ACTIVAR'}
            </button>

            {/* Bases */}
            <SectionBlock label="BASES DETECTADAS">
              {loadingExtra ? <Muted>Cargando…</Muted>
                : bases.length === 0 ? <Muted>Sin bases detectadas</Muted>
                : bases.slice(0, 5).map(b => (
                  <Row key={b.airfield_icao}>
                    <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)' }}>
                      {b.airfield_icao}
                    </span>
                    {b.airfield_name && (
                      <span style={{ color: 'var(--txt-3)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', marginLeft: 6 }}>
                        {b.airfield_name}
                      </span>
                    )}
                  </Row>
                ))
              }
            </SectionBlock>

            {/* Routes */}
            <SectionBlock label="RUTAS DETECTADAS">
              {loadingExtra ? <Muted>Cargando…</Muted>
                : routes.length === 0 ? <Muted>Sin rutas detectadas</Muted>
                : routes.slice(0, 5).map((r, i) => (
                  <Row key={i}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-1)' }}>
                      <span style={{ color: 'var(--accent)' }}>{r.origin_icao}</span>
                      <span style={{ color: 'var(--txt-3)' }}> → </span>
                      <span style={{ color: 'var(--accent)' }}>{r.dest_icao}</span>
                      {r.flight_count > 1 && (
                        <span style={{ color: 'var(--txt-3)' }}> ({r.flight_count})</span>
                      )}
                    </span>
                  </Row>
                ))
              }
            </SectionBlock>
          </div>
        </div>
      )}

      {/* ── Favorites ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', minHeight: 0,
      }}>
        {/* Favorites header / toggle */}
        <button
          onClick={() => setFavOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '10px 14px',
            background: 'none', border: 'none',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer', width: '100%', flexShrink: 0,
          }}
        >
          <span style={{
            flex: 1, textAlign: 'left',
            fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
            fontWeight: 700, letterSpacing: '.16em',
            color: 'var(--txt-2)', textTransform: 'uppercase',
          }}>
            FAVORITOS · {favorites.length}
          </span>
          <span style={{ color: 'var(--txt-3)', fontSize: 11 }}>
            {favOpen ? '▴' : '▾'}
          </span>
        </button>

        {/* Favorites list */}
        {favOpen && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {favorites.length === 0 ? (
              <div style={{
                padding: '20px 14px', textAlign: 'center',
                fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                color: 'var(--txt-3)',
              }}>
                Sin favoritos marcados
              </div>
            ) : favorites.map(fav => (
              <div
                key={fav.icao24}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '8px 14px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background .12s',
                }}
                onClick={() => onFlyTo && onFlyTo(fav.icao24)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--label-md)',
                    fontWeight: 700, color: 'var(--txt-1)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {fav.callsign || fav.icao24}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                    color: 'var(--txt-3)',
                  }}>
                    {fav.icao24}
                  </div>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    toggleFavorite({ id: fav.icao24, label: fav.callsign })
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ffd60a', fontSize: 15, lineHeight: 1,
                    padding: '2px 4px', flexShrink: 0,
                  }}
                >★</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function SectionBlock({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 'var(--label-sm)', fontWeight: 700, letterSpacing: '.15em',
        color: 'var(--txt-2)', fontFamily: 'var(--mono)', marginBottom: 6,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Row({ children }) {
  return (
    <div style={{
      padding: '3px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

function Muted({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
      color: 'var(--txt-3)',
    }}>
      {children}
    </div>
  )
}
