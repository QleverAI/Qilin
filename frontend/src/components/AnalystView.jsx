import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAnalystData } from '../hooks/useAnalystData'
import { ZONES } from '../data/zones'

// ── Severity / confidence helpers ─────────────────────────────────────────────

const SEV_COLOR = s => s >= 7 ? '#ef4444' : s >= 4 ? '#f97316' : '#eab308'
const CONF_COLOR = c => c === 'HIGH' ? '#22c55e' : c === 'MEDIUM' ? '#f97316' : '#6b7280'

const SIGNAL_ICONS = {
  adsb:       '✈️',
  maritime:   '🚢',
  news:       '📰',
  social:     '🐦',
  market:     '📈',
  polymarket: '🎯',
  sentinel:   '🛰️',
}

function signalEmoji(name = '') {
  const key = Object.keys(SIGNAL_ICONS).find(k => name.includes(k))
  return SIGNAL_ICONS[key] || '●'
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  const hhmm = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return `ayer ${hhmm}`
  return d.toLocaleDateString('es', { month: 'short', day: 'numeric' })
}

// ── Zone polygon GeoJSON helper ───────────────────────────────────────────────

function buildZonesGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: ZONES.map(z => {
      const clat = (z.lat[0] + z.lat[1]) / 2
      const clon = (z.lon[0] + z.lon[1]) / 2
      const dlat = (z.lat[1] - z.lat[0]) / 2
      const dlon = (z.lon[1] - z.lon[0]) / 2
      const r    = Math.sqrt(dlat * dlat + dlon * dlon)
      const cos  = Math.cos(clat * Math.PI / 180)
      const pts  = []
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * 2 * Math.PI
        pts.push([clon + (r / cos) * Math.cos(a), clat + r * Math.sin(a)])
      }
      return {
        type: 'Feature',
        properties: { fill: z.color, stroke: z.border },
        geometry: { type: 'Polygon', coordinates: [pts] },
      }
    }),
  }
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

function FilterBar({
  availableZones, filterZone, setFilterZone,
  filterType, setFilterType,
  filterSeverityMin, setFilterSeverityMin,
  filterHours, setFilterHours,
  loading, onRefresh, lastUpdated,
}) {
  const sel = {
    background: 'var(--bg-2)', border: '1px solid var(--border-md)',
    color: 'var(--txt-1)', borderRadius: '3px', padding: '4px 8px',
    fontSize: '11px', fontFamily: 'var(--mono)', cursor: 'pointer',
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '0 14px', height: '48px', flexShrink: 0,
      background: 'var(--bg-1)', borderBottom: '1px solid var(--border-md)',
    }}>
      <span style={{ fontSize: '10px', color: 'var(--txt-3)', letterSpacing: '.12em', fontFamily: 'var(--mono)', flexShrink: 0 }}>
        FILTROS
      </span>

      <select value={filterZone} onChange={e => setFilterZone(e.target.value)} style={sel}>
        <option value="">Todas las zonas</option>
        {availableZones.map(z => (
          <option key={z} value={z}>{z.replace(/_/g, ' ').toUpperCase()}</option>
        ))}
      </select>

      <select value={filterType} onChange={e => setFilterType(e.target.value)} style={sel}>
        <option value="">Todos los tipos</option>
        {['MILITARY', 'MARITIME', 'MARKET', 'ENVIRONMENTAL', 'COMBINED'].map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>SEV ≥</span>
        <select value={filterSeverityMin} onChange={e => setFilterSeverityMin(Number(e.target.value))} style={{ ...sel, width: '52px' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <select value={filterHours} onChange={e => setFilterHours(Number(e.target.value))} style={sel}>
        <option value={6}>Últimas 6h</option>
        <option value={24}>Últimas 24h</option>
        <option value={48}>Últimas 48h</option>
        <option value={168}>Últimos 7d</option>
      </select>

      <button
        onClick={onRefresh} disabled={loading}
        style={{
          ...sel, cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.5 : 1, padding: '4px 14px',
          borderColor: 'var(--accent)', color: 'var(--accent)',
        }}
      >
        {loading ? '…' : 'Actualizar'}
      </button>

      {lastUpdated && (
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
          {lastUpdated}
        </span>
      )}
    </div>
  )
}

// ── ZoneMap ───────────────────────────────────────────────────────────────────

const ZONES_GEOJSON = buildZonesGeoJSON()
const EMPTY_FC = { type: 'FeatureCollection', features: [] }

function ZoneMap({ eventsGeoJSON, onZoneClick }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const onClickRef   = useRef(onZoneClick)
  const [ready, setReady] = useState(false)

  useEffect(() => { onClickRef.current = onZoneClick }, [onZoneClick])

  useEffect(() => {
    if (mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [25, 20], zoom: 1.8, minZoom: 1, maxZoom: 12,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left')

    map.on('load', () => {
      map.addSource('zones', { type: 'geojson', data: ZONES_GEOJSON })
      map.addLayer({ id: 'zones-fill',   type: 'fill',   source: 'zones',
        paint: { 'fill-color': ['get', 'fill'], 'fill-opacity': 1 } })
      map.addLayer({ id: 'zones-stroke', type: 'line',   source: 'zones',
        paint: { 'line-color': ['get', 'stroke'], 'line-width': 1, 'line-dasharray': [4, 3] } })

      map.addSource('events-src', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'ev-circle', type: 'circle', source: 'events-src',
        paint: {
          'circle-radius':         ['interpolate', ['linear'], ['get', 'count'], 1, 9, 5, 15, 20, 24],
          'circle-color':          ['get', 'color'],
          'circle-opacity':        0.7,
          'circle-stroke-width':   2,
          'circle-stroke-color':   ['get', 'color'],
          'circle-stroke-opacity': 0.9,
        },
      })
      map.addLayer({
        id: 'ev-label', type: 'symbol', source: 'events-src',
        layout: {
          'text-field': ['to-string', ['get', 'count']],
          'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-allow-overlap': true,
        },
        paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.5)', 'text-halo-width': 1 },
      })

      map.on('click', 'ev-circle', e => {
        const zone = e.features[0]?.properties?.zone
        if (zone) onClickRef.current(zone)
      })
      map.on('mouseenter', 'ev-circle', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'ev-circle', () => { map.getCanvas().style.cursor = '' })
      setReady(true)
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    try { mapRef.current.getSource('events-src')?.setData(eventsGeoJSON) } catch (_) {}
  }, [eventsGeoJSON, ready])

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <style>{`
        .maplibregl-ctrl-bottom-left .maplibregl-ctrl {
          background: rgba(19,19,22,0.92) !important;
          border: 1px solid var(--border-md) !important;
          border-radius: 3px !important;
        }
        .maplibregl-ctrl button { background: transparent !important; }
        .maplibregl-ctrl button span { filter: invert(1) sepia(1) saturate(2) hue-rotate(180deg) !important; }
      `}</style>
    </div>
  )
}

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({ event, onClick }) {
  const sev    = event.severity || 0
  const color  = SEV_COLOR(sev)
  const tags   = (event.tags || []).slice(0, 4)
  const sigs   = event.signals_used || []

  return (
    <div
      onClick={() => onClick(event.id)}
      style={{
        display: 'flex', gap: '10px', padding: '10px 12px',
        borderBottom: '1px solid var(--border)', cursor: 'pointer',
        transition: 'background .12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Severity bar */}
      <div style={{ width: '3px', flexShrink: 0, borderRadius: '2px', background: color, opacity: 0.9 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: time + badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
            {timeAgo(event.time)}
          </span>
          {event.zone && (
            <span style={{
              fontSize: '9px', padding: '1px 5px', borderRadius: '2px',
              background: 'var(--bg-3)', color: 'var(--txt-2)',
              fontFamily: 'var(--mono)', letterSpacing: '.06em',
            }}>
              {event.zone.replace(/_/g, ' ').toUpperCase()}
            </span>
          )}
          {event.event_type && (
            <span style={{
              fontSize: '9px', padding: '1px 5px', borderRadius: '2px',
              background: 'rgba(79,156,249,0.1)', color: 'var(--accent)',
              fontFamily: 'var(--mono)', letterSpacing: '.06em',
            }}>
              {event.event_type}
            </span>
          )}
          <span style={{
            fontSize: '9px', fontWeight: '700', color, fontFamily: 'var(--mono)',
            marginLeft: 'auto', flexShrink: 0,
          }}>
            {sev}/10
          </span>
        </div>

        {/* Headline */}
        <div style={{
          fontSize: '12px', fontWeight: '600', color: 'var(--txt-1)',
          lineHeight: 1.35, marginBottom: '5px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {event.headline || '—'}
        </div>

        {/* Tags + signals */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {tags.map(t => (
            <span key={t} style={{
              fontSize: '9px', padding: '1px 6px', borderRadius: '10px',
              background: 'var(--bg-3)', color: 'var(--txt-3)',
              fontFamily: 'var(--mono)',
            }}>
              {t}
            </span>
          ))}
          {tags.length < (event.tags || []).length && (
            <span style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
              +{(event.tags || []).length - 4}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '3px' }}>
            {sigs.map(s => (
              <span key={s} title={s} style={{ fontSize: '11px' }}>{signalEmoji(s)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── EventDetail (drawer) ──────────────────────────────────────────────────────

function EventDetail({ event, onClose }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const sev  = event.severity || 0
  const color = SEV_COLOR(sev)
  const mkt  = event.market_implications
  const poly = event.polymarket_implications

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.35)' }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '420px', height: '100vh',
        zIndex: 200, background: 'var(--bg-1)',
        borderLeft: '1px solid var(--border-hi)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px 12px', borderBottom: '1px solid var(--border-md)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '10px', fontWeight: '700', fontFamily: 'var(--mono)',
                  padding: '2px 8px', borderRadius: '3px',
                  background: color + '22', color, border: `1px solid ${color}55`,
                }}>
                  SEV {sev}/10
                </span>
                {event.confidence && (
                  <span style={{
                    fontSize: '10px', fontFamily: 'var(--mono)', padding: '2px 8px',
                    borderRadius: '3px', color: CONF_COLOR(event.confidence),
                    background: CONF_COLOR(event.confidence) + '22',
                    border: `1px solid ${CONF_COLOR(event.confidence)}44`,
                  }}>
                    {event.confidence}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--txt-1)', lineHeight: 1.35 }}>
                {event.headline}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--txt-3)',
              fontSize: '20px', cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: '0 0 0 6px',
            }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[
              event.zone     && event.zone.replace(/_/g, ' ').toUpperCase(),
              event.event_type,
              timeAgo(event.time),
            ].filter(Boolean).map((v, i) => (
              <span key={i} style={{
                fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--txt-2)',
                padding: '1px 6px', borderRadius: '2px', background: 'var(--bg-3)',
              }}>{v}</span>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {/* Summary */}
          {event.summary && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', marginBottom: '6px' }}>
                ANÁLISIS
              </div>
              <div style={{ fontSize: '12px', color: 'var(--txt-1)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {event.summary}
              </div>
            </div>
          )}

          {/* Signals used */}
          {(event.signals_used || []).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', marginBottom: '6px' }}>
                SEÑALES
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {event.signals_used.map(s => (
                  <span key={s} style={{
                    fontSize: '11px', padding: '3px 8px', borderRadius: '3px',
                    background: 'var(--bg-3)', color: 'var(--txt-2)', fontFamily: 'var(--mono)',
                  }}>
                    {signalEmoji(s)} {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Market implications */}
          {mkt && mkt.affected_tickers?.length > 0 && (
            <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'var(--bg-2)', borderRadius: '4px', border: '1px solid var(--border-md)' }}>
              <div style={{ fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', marginBottom: '8px' }}>
                MARKET INTELLIGENCE
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {mkt.affected_tickers.map(t => {
                  const dirColor = mkt.direction === 'BULLISH' ? '#22c55e' : mkt.direction === 'BEARISH' ? '#ef4444' : 'var(--txt-2)'
                  return (
                    <span key={t} style={{
                      fontSize: '11px', fontWeight: '700', fontFamily: 'var(--mono)',
                      padding: '2px 8px', borderRadius: '3px',
                      background: dirColor + '22', color: dirColor,
                      border: `1px solid ${dirColor}44`,
                    }}>
                      {t} {mkt.direction === 'BULLISH' ? '↑' : mkt.direction === 'BEARISH' ? '↓' : '↔'}
                    </span>
                  )
                })}
              </div>
              {mkt.reasoning && (
                <div style={{ fontSize: '11px', color: 'var(--txt-2)', lineHeight: 1.55, marginBottom: '6px' }}>
                  {mkt.reasoning}
                </div>
              )}
              {mkt.disclaimer && (
                <div style={{ fontSize: '10px', color: 'var(--txt-3)', fontStyle: 'italic' }}>
                  {mkt.disclaimer}
                </div>
              )}
            </div>
          )}

          {/* Polymarket implications */}
          {poly && (poly.related_markets?.length > 0 || poly.probability_shift !== 'STABLE') && (
            <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'var(--bg-2)', borderRadius: '4px', border: '1px solid var(--border-md)' }}>
              <div style={{ fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', marginBottom: '8px' }}>
                POLYMARKET
              </div>
              {poly.probability_shift && poly.probability_shift !== 'STABLE' && (
                <div style={{ fontSize: '12px', color: poly.probability_shift === 'UP' ? '#22c55e' : '#ef4444', fontFamily: 'var(--mono)', marginBottom: '6px' }}>
                  {poly.probability_shift === 'UP' ? '⬆ SUBE' : '⬇ BAJA'}
                </div>
              )}
              {(poly.related_markets || []).slice(0, 5).map((m, i) => (
                <div key={i} style={{ fontSize: '11px', color: 'var(--txt-2)', padding: '2px 0', lineHeight: 1.4 }}>
                  • {m}
                </div>
              ))}
              {poly.reasoning && (
                <div style={{ fontSize: '11px', color: 'var(--txt-2)', lineHeight: 1.55, marginTop: '6px', marginBottom: '6px' }}>
                  {poly.reasoning}
                </div>
              )}
              {poly.disclaimer && (
                <div style={{ fontSize: '10px', color: 'var(--txt-3)', fontStyle: 'italic' }}>
                  {poly.disclaimer}
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {(event.tags || []).length > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', letterSpacing: '.1em', marginBottom: '6px' }}>
                TAGS
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {event.tags.map(t => (
                  <span key={t} style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                    background: 'var(--bg-3)', color: 'var(--txt-3)', fontFamily: 'var(--mono)',
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── SvgTimelineChart ──────────────────────────────────────────────────────────

function SvgTimelineChart({ timeline }) {
  if (!timeline.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '90px', color: 'var(--txt-3)', fontSize: '11px', fontFamily: 'var(--mono)' }}>
        Sin datos para el periodo seleccionado
      </div>
    )
  }

  const W = 800; const H = 72
  const PAD = { t: 6, r: 16, b: 22, l: 28 }
  const cw = W - PAD.l - PAD.r
  const ch = H - PAD.t - PAD.b
  const maxC = Math.max(...timeline.map(d => d.count), 1)
  const n = timeline.length

  const px = i => PAD.l + (n < 2 ? cw / 2 : (i / (n - 1)) * cw)
  const py = c => PAD.t + ch - (c / maxC) * ch

  const pts = timeline.map((d, i) => `${px(i)},${py(d.count)}`).join(' L ')
  const linePath = n < 2 ? '' : `M ${pts}`
  const areaPath = n < 2 ? '' : `M ${px(0)},${PAD.t + ch} L ${pts} L ${px(n - 1)},${PAD.t + ch} Z`

  const tickIdxs = n <= 6
    ? timeline.map((_, i) => i)
    : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '90px' }} preserveAspectRatio="none">
      {[0, 0.5, 1].map(p => (
        <line key={p}
          x1={PAD.l} y1={PAD.t + ch * (1 - p)} x2={W - PAD.r} y2={PAD.t + ch * (1 - p)}
          stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
      ))}
      {areaPath && <path d={areaPath} fill="rgba(79,156,249,0.08)" />}
      {linePath && <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" />}
      {timeline.map((d, i) => (
        <circle key={i} cx={px(i)} cy={py(d.count)} r="3"
          fill={SEV_COLOR(d.avg_severity)} stroke="var(--bg-1)" strokeWidth="1" />
      ))}
      <text x={PAD.l - 3} y={PAD.t + 4} textAnchor="end" fontSize="8" fill="rgba(200,216,232,0.35)" fontFamily="monospace">{maxC}</text>
      <text x={PAD.l - 3} y={PAD.t + ch} textAnchor="end" fontSize="8" fill="rgba(200,216,232,0.35)" fontFamily="monospace">0</text>
      {tickIdxs.map(i => {
        const ts = new Date(timeline[i].timestamp)
        const label = ts.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
        return (
          <text key={i} x={px(i)} y={H - 3} textAnchor="middle" fontSize="8" fill="rgba(200,216,232,0.35)" fontFamily="monospace">
            {label}
          </text>
        )
      })}
    </svg>
  )
}

// ── MetricsDashboard ──────────────────────────────────────────────────────────

function MetricsDashboard({ summary, timeline }) {
  const cards = useMemo(() => {
    if (!summary) return []
    const topZone = (summary.by_zone || [])[0]
    const topType = Object.entries(summary.by_type || {}).sort((a, b) => b[1] - a[1])[0]
    return [
      { label: 'EVENTOS',       value: summary.total_events ?? '—', sub: `últimas ${summary.hours ?? ''} horas` },
      { label: 'SEV. MEDIA',    value: summary.avg_severity?.toFixed(1) ?? '—', sub: 'promedio del periodo' },
      { label: 'ZONA TOP',      value: topZone?.zone?.replace(/_/g, ' ').toUpperCase() ?? '—', sub: topZone ? `${topZone.count} eventos` : '' },
      { label: 'TIPO MÁS FREC', value: topType?.[0] ?? '—', sub: topType ? `${topType[1]} eventos` : '' },
    ]
  }, [summary])

  return (
    <div style={{
      flexShrink: 0, background: 'var(--bg-1)',
      borderTop: '1px solid var(--border-md)', padding: '10px 14px',
    }}>
      {/* Cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '10px' }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: 'var(--bg-2)', borderRadius: '4px',
            border: '1px solid var(--border-md)', padding: '8px 12px',
          }}>
            <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', letterSpacing: '.12em', marginBottom: '4px' }}>
              {c.label}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--txt-1)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
              {c.value}
            </div>
            {c.sub && (
              <div style={{ fontSize: '9px', color: 'var(--txt-3)', marginTop: '3px' }}>{c.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Timeline chart */}
      <SvgTimelineChart timeline={timeline} />
    </div>
  )
}

// ── AnalystView (main) ────────────────────────────────────────────────────────

export default function AnalystView() {
  const {
    events, selectedEvent, summary, timeline, loading,
    filterZone, setFilterZone, filterSeverityMin, setFilterSeverityMin,
    filterType, setFilterType, filterHours, setFilterHours,
    selectEvent, clearSelectedEvent, refresh,
  } = useAnalystData()

  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    if (!loading) setLastUpdated(new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }))
  }, [events, loading])

  // Unique zone list for filter dropdown
  const availableZones = useMemo(() => {
    const s = new Set(events.map(e => e.zone).filter(Boolean))
    return [...s].sort()
  }, [events])

  // GeoJSON for the map: group events by zone
  const eventsGeoJSON = useMemo(() => {
    const grouped = {}
    events.forEach(ev => {
      const z = ev.zone; if (!z) return
      if (!grouped[z]) grouped[z] = { count: 0, maxSev: 0 }
      grouped[z].count++
      grouped[z].maxSev = Math.max(grouped[z].maxSev, ev.severity || 0)
    })
    return {
      type: 'FeatureCollection',
      features: Object.entries(grouped).map(([zoneName, { count, maxSev }]) => {
        const zd = ZONES.find(z => z.name === zoneName)
        if (!zd) return null
        return {
          type: 'Feature',
          properties: { zone: zoneName, count, color: SEV_COLOR(maxSev) },
          geometry: { type: 'Point', coordinates: [(zd.lon[0] + zd.lon[1]) / 2, (zd.lat[0] + zd.lat[1]) / 2] },
        }
      }).filter(Boolean),
    }
  }, [events])

  const handleZoneClick = useCallback(zoneName => {
    setFilterZone(prev => prev === zoneName ? '' : zoneName)
  }, [setFilterZone])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--bg-0)' }}>
      <FilterBar
        availableZones={availableZones}
        filterZone={filterZone} setFilterZone={setFilterZone}
        filterType={filterType} setFilterType={setFilterType}
        filterSeverityMin={filterSeverityMin} setFilterSeverityMin={setFilterSeverityMin}
        filterHours={filterHours} setFilterHours={setFilterHours}
        loading={loading} onRefresh={refresh} lastUpdated={lastUpdated}
      />

      {/* Middle: map + timeline */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', minHeight: 0 }}>
        <ZoneMap eventsGeoJSON={eventsGeoJSON} onZoneClick={handleZoneClick} />

        {/* Timeline */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--border-md)', background: 'var(--bg-1)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px', flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', letterSpacing: '.12em' }}>
              TIMELINE
            </span>
            <span style={{ fontSize: '10px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
              {events.length} eventos
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {events.length === 0 && !loading && (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
                Sin eventos en el periodo seleccionado
              </div>
            )}
            {events.map(ev => (
              <EventCard key={ev.id} event={ev} onClick={selectEvent} />
            ))}
          </div>
        </div>
      </div>

      <MetricsDashboard summary={summary} timeline={timeline} />

      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={clearSelectedEvent} />
      )}
    </div>
  )
}
