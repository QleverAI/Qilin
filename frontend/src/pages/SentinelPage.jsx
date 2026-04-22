import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useSentinelData }                        from '../hooks/useSentinelData'
import { SENTINEL_ZONES_GEOJSON, ZONE_LABELS }    from '../data/sentinelZones'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

function ratioColor(ratio) {
  if (!ratio || ratio < 1.0) return '#166534'
  if (ratio < 1.5)           return '#854d0e'
  if (ratio < 2.0)           return '#9a3412'
  return '#991b1b'
}

function buildColorExpression(zones, activeGas) {
  if (zones.length === 0) return '#166534'
  const pairs = []
  for (const z of zones) {
    const d = activeGas === 'no2' ? z.no2 : z.so2
    pairs.push(z.zone_id, ratioColor(d?.ratio))
  }
  return ['match', ['get', 'zone_id'], ...pairs, '#166534']
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ history }) {
  if (!history || history.length === 0) {
    return (
      <div style={{ height: 40, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
          SIN HISTÓRICO
        </span>
      </div>
    )
  }
  const values = history.map(h => h.value).filter(v => v !== null)
  if (values.length === 0) return null
  const min   = Math.min(...values)
  const max   = Math.max(...values)
  const range = max - min || 1
  const W = 200, H = 40, PAD = 4
  const pts = values.map((v, i) => {
    const x = PAD + (i / Math.max(values.length - 1, 1)) * (W - 2 * PAD)
    const y = H - PAD - ((v - min) / range) * (H - 2 * PAD)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 40, display: 'block' }}>
      <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="#374151" strokeWidth="0.5" />
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── ZoneDrawer ────────────────────────────────────────────────────────────────
function ZoneDrawer({ zone, onClose }) {
  const maxRatio  = Math.max(zone.no2?.ratio ?? 0, zone.so2?.ratio ?? 0)
  const badge     = maxRatio >= 2.0
    ? { label: 'SEVERO',   color: '#991b1b', bg: 'rgba(153,27,27,0.15)'  }
    : maxRatio >= 1.5
    ? { label: 'ANOMALÍA', color: '#9a3412', bg: 'rgba(154,52,18,0.15)'  }
    : { label: 'NORMAL',   color: '#166534', bg: 'rgba(22,101,52,0.15)'  }

  return (
    <div style={{
      width: 340, flexShrink: 0,
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--border-md)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
      }}>
        <span style={{
          flex: 1, fontFamily: 'var(--mono)', fontSize: 'var(--label-md)',
          fontWeight: 700, letterSpacing: '.08em',
          color: 'var(--txt-1)', textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ZONE_LABELS[zone.zone_id] ?? zone.zone_id}
        </span>
        <span style={{
          fontSize: 'var(--label-sm)', fontWeight: 700, fontFamily: 'var(--mono)',
          padding: '2px 8px', borderRadius: 2, flexShrink: 0,
          color: badge.color, background: badge.bg,
          border: `1px solid ${badge.color}55`,
        }}>
          {badge.label}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--txt-3)',
            cursor: 'pointer', fontSize: 18, lineHeight: 1,
            padding: '2px 4px', flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* Gas panels */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {['no2', 'so2'].map(gas => {
          const d = zone[gas]
          return (
            <div key={gas} style={{
              marginBottom: 16,
              padding: '10px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 3,
            }}>
              {/* Gas header */}
              <div style={{
                display: 'flex', alignItems: 'center',
                marginBottom: d ? 10 : 0,
              }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                  fontWeight: 700, letterSpacing: '.15em', color: 'var(--txt-2)',
                }}>
                  {gas.toUpperCase()}
                </span>
                {d && (
                  <span style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--mono)', fontSize: 'var(--label-md)',
                    fontWeight: 700, color: ratioColor(d.ratio),
                  }}>
                    {d.ratio?.toFixed(2)}x
                  </span>
                )}
              </div>

              {d ? (
                <>
                  {/* Metrics grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 8, marginBottom: 12,
                  }}>
                    {[
                      { label: 'ACTUAL',   value: d.current  },
                      { label: 'BASELINE', value: d.baseline },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{
                          fontSize: 'var(--label-sm)', color: 'var(--txt-3)',
                          fontFamily: 'var(--mono)', marginBottom: 2,
                        }}>
                          {label}
                        </div>
                        <div style={{
                          fontSize: 'var(--label-md)', color: 'var(--txt-1)',
                          fontFamily: 'var(--mono)',
                        }}>
                          {value != null ? value.toExponential(2) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sparkline */}
                  <div style={{
                    fontSize: 'var(--label-sm)', color: 'var(--txt-3)',
                    fontFamily: 'var(--mono)', marginBottom: 4,
                  }}>
                    7 DÍAS
                  </div>
                  <Sparkline history={d.history} />
                </>
              ) : (
                <div style={{
                  fontSize: 'var(--label-sm)', color: 'var(--txt-3)',
                  fontFamily: 'var(--mono)',
                }}>
                  Sin observaciones recientes
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── SentinelPage ──────────────────────────────────────────────────────────────
export default function SentinelPage() {
  const mapRef         = useRef(null)
  const mapInstanceRef = useRef(null)
  const { zones, loading, error, lastUpdated } = useSentinelData()
  const [activeGas,      setActiveGas]      = useState('no2')
  const [selectedZoneId, setSelectedZoneId] = useState(null)

  const selectedZone = zones.find(z => z.zone_id === selectedZoneId) ?? null

  const hoursAgo = lastUpdated
    ? Math.round((Date.now() - new Date(lastUpdated).getTime()) / 3600000)
    : null

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current) return
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: MAP_STYLE,
      center: [20, 20],
      zoom: 1.8,
    })
    mapInstanceRef.current = map

    map.on('load', () => {
      map.addSource('sentinel-zones', {
        type: 'geojson',
        data: SENTINEL_ZONES_GEOJSON,
      })
      map.addLayer({
        id: 'sentinel-fill',
        type: 'fill',
        source: 'sentinel-zones',
        paint: { 'fill-color': '#166534', 'fill-opacity': 0.55 },
      })
      map.addLayer({
        id: 'sentinel-outline',
        type: 'line',
        source: 'sentinel-zones',
        paint: { 'line-color': '#374151', 'line-width': 1 },
      })
      map.on('click', 'sentinel-fill', e => {
        const zoneId = e.features[0]?.properties?.zone_id
        if (zoneId) setSelectedZoneId(zoneId)
      })
      map.on('mouseenter', 'sentinel-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'sentinel-fill', () => { map.getCanvas().style.cursor = '' })
    })

    return () => { map.remove(); mapInstanceRef.current = null }
  }, [])

  // Update fill colors when zones data or active gas changes
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || zones.length === 0) return
    const apply = () => {
      if (map.getLayer('sentinel-fill')) {
        map.setPaintProperty('sentinel-fill', 'fill-color', buildColorExpression(zones, activeGas))
      }
    }
    map.loaded() ? apply() : map.once('load', apply)
  }, [zones, activeGas])

  const statusLabel = error
    ? 'DATOS DESACTUALIZADOS'
    : loading
    ? 'CARGANDO...'
    : hoursAgo !== null
    ? `ÚLTIMO DATO: hace ${hoursAgo}h`
    : 'SIN DATOS'

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* NO₂ / SO₂ toggle */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 10,
          display: 'flex',
          background: 'var(--bg-1)',
          border: '1px solid var(--border-md)',
          borderRadius: 3, overflow: 'hidden',
        }}>
          {['no2', 'so2'].map(gas => (
            <button
              key={gas}
              onClick={() => setActiveGas(gas)}
              style={{
                background: activeGas === gas ? 'rgba(200,160,60,0.15)' : 'transparent',
                border: 'none',
                borderRight: gas === 'no2' ? '1px solid var(--border-md)' : 'none',
                color: activeGas === gas ? 'var(--accent)' : 'var(--txt-2)',
                fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                fontWeight: 700, letterSpacing: '.1em',
                padding: '6px 16px', cursor: 'pointer',
              }}
            >
              {gas.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Status / last updated */}
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-md)',
          borderRadius: 3, padding: '5px 10px',
          fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
          color: error ? 'var(--amber)' : 'var(--txt-3)',
        }}>
          {statusLabel}
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 24, left: 12, zIndex: 10,
          background: 'var(--bg-1)',
          border: '1px solid var(--border-md)',
          borderRadius: 3, padding: '8px 12px',
        }}>
          {[
            { color: '#166534', label: '< 1.0x  normal'    },
            { color: '#854d0e', label: '1.0–1.5x  elevado' },
            { color: '#9a3412', label: '1.5–2.0x  anomalía'},
            { color: '#991b1b', label: '> 2.0x  severo'    },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, background: color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-2)' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone Drawer */}
      {selectedZone && (
        <ZoneDrawer zone={selectedZone} onClose={() => setSelectedZoneId(null)} />
      )}
    </div>
  )
}
