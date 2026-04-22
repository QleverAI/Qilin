import { useState, useEffect } from 'react'
import { apiFetch } from '../hooks/apiClient'
import { useFavorites } from '../hooks/useFavorites'
import { useVesselFavorites } from '../hooks/useVesselFavorites'

const TYPE_META = {
  military: { label: 'MILITARY', color: '#f43f5e' },
  vip:      { label: 'VIP',      color: '#ffd60a' },
  civil:    { label: 'CIVIL',    color: '#4f9cf9' },
}

const VESSEL_TYPE_META = {
  military:  { label: 'MILITARY',  color: '#f43f5e' },
  tanker:    { label: 'TANKER',    color: '#f59e0b' },
  cargo:     { label: 'CARGO',     color: '#60a5fa' },
  passenger: { label: 'PASSENGER', color: '#a78bfa' },
  unknown:   { label: 'UNKNOWN',   color: '#64748b' },
}

export default function TacticalPanel({
  selectedAircraft, onClose,
  selectedVessel, onSelectVessel,
  trails, onAddTrail, onRemoveTrail,
  onFlyTo, onFlyToVessel,
}) {
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const { favorites: vesselFavs, isFavorite: isVesselFav, toggleFavorite: toggleVesselFav } = useVesselFavorites()
  const [bases,        setBases]        = useState([])
  const [routes,       setRoutes]       = useState([])
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [favTab,       setFavTab]       = useState('aircraft')
  const [vesselPorts,  setVesselPorts]  = useState([])
  const [vesselRoutes, setVesselRoutes] = useState([])
  const [vesselInfo,   setVesselInfo]   = useState(null)

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

  const mmsi = selectedVessel?.mmsi || selectedVessel?.id
  useEffect(() => {
    if (!mmsi) { setVesselPorts([]); setVesselRoutes([]); setVesselInfo(null); return }
    Promise.all([
      apiFetch(`/api/vessels/${mmsi}/ports`).catch(() => []),
      apiFetch(`/api/vessels/${mmsi}/routes`).catch(() => []),
      apiFetch(`/api/vessels/${mmsi}/info`).catch(() => null),
    ]).then(([p, r, info]) => {
      setVesselPorts(Array.isArray(p) ? p : [])
      setVesselRoutes(Array.isArray(r) ? r : [])
      setVesselInfo(info)
    })
  }, [mmsi])

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

      {/* ── Vessel detail ── */}
      {selectedVessel && (() => {
        const vc = VESSEL_TYPE_META[selectedVessel.type] || VESSEL_TYPE_META.unknown
        const vid = selectedVessel.mmsi || selectedVessel.id
        return (
          <div style={{ borderBottom: '1px solid var(--border-md)', overflowY: 'auto', flexShrink: 0, maxHeight: '65%' }}>
            {/* Header */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ flex: 1, fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 'var(--label-md)', color: 'var(--txt-1)', letterSpacing: '.06em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedVessel.label || selectedVessel.name || vid}
              </span>
              <span style={{ fontSize: 'var(--label-sm)', fontWeight: 700, fontFamily: 'var(--mono)', padding: '1px 6px', borderRadius: 2, color: vc.color, background: `${vc.color}18`, border: `1px solid ${vc.color}44`, flexShrink: 0 }}>{vc.label}</span>
              <button
                onClick={() => toggleVesselFav(selectedVessel)}
                title={isVesselFav(vid) ? 'Quitar favorito' : 'Marcar favorito'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: '2px 4px', color: isVesselFav(vid) ? '#ffd60a' : 'var(--txt-3)', flexShrink: 0, transition: 'color .15s' }}
              >★</button>
              <button
                onClick={() => onSelectVessel?.(null)}
                style={{ background: 'none', border: 'none', color: 'var(--txt-3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
              >×</button>
            </div>

            {/* Wikipedia photo */}
            {vesselInfo?.thumbnail && (
              <div style={{ padding: '8px 14px 0' }}>
                <img src={vesselInfo.thumbnail} alt={selectedVessel.name || vid} style={{ width: '100%', borderRadius: 3, objectFit: 'cover', maxHeight: 120 }} />
              </div>
            )}

            {/* Data */}
            <div style={{ padding: '10px 14px' }}>
              <SectionBlock label="IDENTIFICACIÓN">
                <Row><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>MMSI </span><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-1)' }}>{vid}</span></Row>
                {selectedVessel.flag && <Row><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>BANDERA </span><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-1)' }}>{selectedVessel.flag}</span></Row>}
                {selectedVessel.company && <Row><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>COMPAÑÍA </span><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--accent)' }}>{selectedVessel.company.toUpperCase().replace(/_/g, ' ')}</span></Row>}
                {selectedVessel.destination && <Row><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>DESTINO </span><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-1)' }}>{selectedVessel.destination}</span></Row>}
              </SectionBlock>
              <SectionBlock label="MOVIMIENTO">
                {selectedVessel.speed != null && <Row><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>VELOCIDAD </span><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-1)' }}>{Number(selectedVessel.speed).toFixed(1)} kn</span></Row>}
                {selectedVessel.heading != null && <Row><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>RUMBO </span><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-1)' }}>{Math.round(selectedVessel.heading)}°</span></Row>}
                {selectedVessel.zone && <Row><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>ZONA </span><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-1)' }}>{selectedVessel.zone}</span></Row>}
                {selectedVessel.ais_active === false && <Muted style={{ color: 'var(--red)', marginTop: 4 }}>AIS DARK — sin señal</Muted>}
              </SectionBlock>
              {vesselPorts.length > 0 && (
                <SectionBlock label="PUERTOS DETECTADOS">
                  {vesselPorts.slice(0, 4).map(p => (
                    <Row key={p.port_id}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--accent)' }}>{p.port_name}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}> {p.country} · {p.visit_count}×</span>
                    </Row>
                  ))}
                </SectionBlock>
              )}
              {vesselRoutes.length > 0 && (
                <SectionBlock label="RUTAS">
                  {vesselRoutes.slice(0, 3).map((r, i) => (
                    <Row key={i}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-1)' }}>
                        <span style={{ color: 'var(--accent)' }}>{r.origin_name}</span>
                        <span style={{ color: 'var(--txt-3)' }}> → </span>
                        <span style={{ color: 'var(--accent)' }}>{r.dest_name}</span>
                        {r.route_count > 1 && <span style={{ color: 'var(--txt-3)' }}> ({r.route_count})</span>}
                      </span>
                    </Row>
                  ))}
                </SectionBlock>
              )}
              {onFlyToVessel && (
                <button
                  onClick={() => onFlyToVessel(vid)}
                  style={{ alignSelf: 'flex-start', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 3, color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: 600, letterSpacing: '.06em', padding: '5px 12px', cursor: 'pointer', marginTop: 6 }}
                >
                  → CENTRAR MAPA
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Favorites ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[
            { id: 'aircraft', label: `AERONAVES · ${favorites.length}` },
            { id: 'vessels',  label: `BARCOS · ${vesselFavs.length}`  },
          ].map(tab => {
            const active = favTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setFavTab(tab.id)}
                style={{
                  flex: 1, background: 'none', border: 'none',
                  borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
                  color: active ? 'var(--cyan)' : 'var(--txt-3)',
                  fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: 600,
                  letterSpacing: '.10em', padding: '8px 4px 6px',
                  cursor: 'pointer', transition: 'color .15s',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Aircraft favorites list */}
        {favTab === 'aircraft' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {favorites.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
                Sin favoritos marcados
              </div>
            ) : favorites.map(fav => (
              <div
                key={fav.icao24}
                style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .12s' }}
                onClick={() => onFlyTo && onFlyTo(fav.icao24)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-md)', fontWeight: 700, color: 'var(--txt-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fav.callsign || fav.icao24}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
                    {fav.icao24}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); toggleFavorite({ id: fav.icao24, label: fav.callsign }) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffd60a', fontSize: 15, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
                >★</button>
              </div>
            ))}
          </div>
        )}

        {/* Vessel favorites list */}
        {favTab === 'vessels' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {vesselFavs.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
                Sin favoritos marcados
              </div>
            ) : vesselFavs.map(fav => (
              <div
                key={fav.mmsi}
                style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .12s' }}
                onClick={() => onFlyToVessel && onFlyToVessel(fav.mmsi)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-md)', fontWeight: 700, color: 'var(--txt-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fav.name || fav.mmsi}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
                    {fav.mmsi}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); toggleVesselFav(fav) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffd60a', fontSize: 15, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
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

function Muted({ children, style }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
      color: 'var(--txt-3)',
      ...style,
    }}>
      {children}
    </div>
  )
}
