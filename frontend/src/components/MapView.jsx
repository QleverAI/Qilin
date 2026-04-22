import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ZONES, CHOKEPOINTS } from '../data/zones'
import TrailPanel from './TrailPanel'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// Country name → ISO 3166-1 alpha-2 code (for flag CDN)
const COUNTRY_ISO2 = {
  'Afghanistan':'af','Albania':'al','Algeria':'dz','Argentina':'ar','Australia':'au',
  'Austria':'at','Azerbaijan':'az','Bahrain':'bh','Belarus':'by','Belgium':'be',
  'Brazil':'br','Bulgaria':'bg','Canada':'ca','Chile':'cl','China':'cn',
  'Colombia':'co','Croatia':'hr','Cyprus':'cy','Czech Republic':'cz','Denmark':'dk',
  'Egypt':'eg','Estonia':'ee','Ethiopia':'et','Finland':'fi','France':'fr',
  'Georgia':'ge','Germany':'de','Greece':'gr','Hungary':'hu','India':'in',
  'Indonesia':'id','Iran':'ir','Iraq':'iq','Ireland':'ie','Israel':'il',
  'Italy':'it','Japan':'jp','Jordan':'jo','Kazakhstan':'kz','Kuwait':'kw',
  'Latvia':'lv','Lebanon':'lb','Libya':'ly','Lithuania':'lt','Luxembourg':'lu',
  'Malaysia':'my','Malta':'mt','Mexico':'mx','Moldova':'md','Morocco':'ma',
  'Netherlands':'nl','New Zealand':'nz','Nigeria':'ng','Norway':'no','Oman':'om',
  'Pakistan':'pk','Philippines':'ph','Poland':'pl','Portugal':'pt','Qatar':'qa',
  'Romania':'ro','Russia':'ru','Saudi Arabia':'sa','Serbia':'rs','Singapore':'sg',
  'Slovakia':'sk','Slovenia':'si','South Korea':'kr','Spain':'es','Sweden':'se',
  'Switzerland':'ch','Syria':'sy','Taiwan':'tw','Thailand':'th','Tunisia':'tn',
  'Turkey':'tr','Ukraine':'ua','United Arab Emirates':'ae','United Kingdom':'gb',
  'United States':'us','Uruguay':'uy','Venezuela':'ve','Vietnam':'vn','Yemen':'ye',
}
function flagUrl(country) {
  if (!country) return null
  const code = COUNTRY_ISO2[country]
  return code ? `https://flagcdn.com/20x15/${code}.png` : null
}

// ── Icon factories ─────────────────────────────────────────────
function makePlaneIcon(color, size = 24) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  const cx = size / 2
  ctx.fillStyle = color; ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.moveTo(cx, 1)
  ctx.lineTo(cx + 7, size - 4)
  ctx.lineTo(cx, size - 8)
  ctx.lineTo(cx - 7, size - 4)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = color; ctx.lineWidth = .8; ctx.globalAlpha = .45
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

// ── GeoJSON helpers ────────────────────────────────────────────
function zonesToGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: ZONES.map(z => ({
      type: 'Feature',
      properties: { label: z.label, fill: z.color, stroke: z.border },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [z.lon[0], z.lat[0]],
          [z.lon[1], z.lat[0]],
          [z.lon[1], z.lat[1]],
          [z.lon[0], z.lat[1]],
          [z.lon[0], z.lat[0]],
        ]],
      },
    })),
  }
}

function chokesToGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: CHOKEPOINTS.map(cp => ({
      type: 'Feature',
      properties: { label: cp.label },
      geometry: { type: 'Point', coordinates: [cp.lon, cp.lat] },
    })),
  }
}

function toGeoJSON(entities, iconFn) {
  return {
    type: 'FeatureCollection',
    features: entities.map(e => ({
      type: 'Feature',
      properties: {
        id:       e.id,
        label:    e.callsign || e.name || e.id,
        type:     e.type,
        heading:  e.heading || 0,
        speed:    e.speed,
        altitude: e.altitude,
        zone:     e.zone,
        origin_country: e.origin_country,
        icon:     iconFn(e),
      },
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
    })),
  }
}

function alertsGeoJSON(alerts) {
  return {
    type: 'FeatureCollection',
    features: alerts.filter(a => a.lon && a.lat).map(a => ({
      type: 'Feature',
      properties: { id: a.id, severity: a.severity, title: a.title },
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
    })),
  }
}

// ── Component ──────────────────────────────────────────────────
export default function MapView({ aircraft, alerts, flyTarget, trails = {}, onAddTrail, onRemoveTrail, onClearTrails }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const [ready, setReady]               = useState(false)
  const [detail, setDetail]             = useState(null)  // { ...props, px, py }
  const [route, setRoute]               = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [meta, setMeta]                 = useState(null)
  const [metaLoading, setMetaLoading]   = useState(false)

  function authHdr() {
    const token = sessionStorage.getItem('qilin_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function fetchRoute(callsign) {
    if (!callsign) { setRoute(null); return }
    setRouteLoading(true)
    setRoute(null)
    try {
      const res  = await fetch(`/api/routes/${encodeURIComponent(callsign)}`, { headers: authHdr() })
      setRoute(res.ok ? await res.json() : {})
    } catch (_) {
      setRoute({})
    } finally {
      setRouteLoading(false)
    }
  }

  async function fetchMeta(icao24) {
    if (!icao24) { setMeta(null); return }
    setMetaLoading(true)
    setMeta(null)
    try {
      const res  = await fetch(`/api/meta/${encodeURIComponent(icao24)}`, { headers: authHdr() })
      setMeta(res.ok ? await res.json() : {})
    } catch (_) {
      setMeta({})
    } finally {
      setMetaLoading(false)
    }
  }

  // Init map
  useEffect(() => {
    if (mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [25, 25],
      zoom: 2.2,
      minZoom: 1,
      maxZoom: 16,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-left')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')

    map.on('load', () => {
      // ── Register icons ──
      map.addImage('plane-civil',    makePlaneIcon('#00c8ff'))
      map.addImage('plane-military', makePlaneIcon('#ff3b4a', 26))

      // ── Zones (label only) ──
      map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON() })
      map.addLayer({ id:'zones-label', type:'symbol', source:'zones',
        layout:{ 'text-field':['get','label'], 'text-font':['Noto Sans Regular'],
          'text-size':9, 'text-anchor':'center', 'text-allow-overlap':true },
        paint:{ 'text-color':['get','stroke'], 'text-halo-color':'rgba(0,0,0,0.7)', 'text-halo-width':1.5 },
      })

      // ── Chokepoints (label only) ──
      map.addSource('chokes', { type: 'geojson', data: chokesToGeoJSON() })
      map.addLayer({ id:'chokes-label', type:'symbol', source:'chokes',
        layout:{ 'text-field':['get','label'], 'text-font':['Noto Sans Regular'], 'text-size':9, 'text-anchor':'center', 'text-allow-overlap':true },
        paint:{ 'text-color':'rgba(255,176,32,0.65)', 'text-halo-color':'rgba(0,0,0,0.6)', 'text-halo-width':1 },
      })

      // ── Aircraft ──
      map.addSource('aircraft-src', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })
      map.addLayer({ id:'aircraft-layer', type:'symbol', source:'aircraft-src',
        layout:{ 'icon-image':['get','icon'], 'icon-rotate':['get','heading'],
          'icon-rotation-alignment':'map', 'icon-allow-overlap':true, 'icon-ignore-placement':true,
          'icon-size':1 },
        paint:{ 'icon-opacity':0.9 } })

      // ── Callsign labels (only at zoom >= 5) ──
      map.addLayer({ id:'aircraft-labels', type:'symbol', source:'aircraft-src',
        minzoom: 5,
        layout:{ 'text-field':['get','label'], 'text-font':['Noto Sans Regular'],
          'text-size':9, 'text-offset':[0,1.2], 'text-anchor':'top', 'text-allow-overlap':false },
        paint:{ 'text-color':'rgba(200,216,232,0.7)', 'text-halo-color':'rgba(0,0,0,0.8)', 'text-halo-width':1 } })

      // ── Click handlers ──
      map.on('click', 'aircraft-layer', e => {
        const props = e.features[0]?.properties
        if (props) {
          setDetail({ ...props, px: e.point.x, py: e.point.y })
          fetchRoute(props.label)
          fetchMeta(props.id)
        }
      })
      map.on('mouseenter', 'aircraft-layer', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'aircraft-layer', () => { map.getCanvas().style.cursor = '' })

      map.on('click', e => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['aircraft-layer'] })
        if (!hits.length) {
          setDetail(null)
          setRoute(null)
          setMeta(null)
        }
      })

      setReady(true)
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Update aircraft source
  useEffect(() => {
    if (!ready || !mapRef.current) return
    try {
      mapRef.current.getSource('aircraft-src')?.setData(
        toGeoJSON(aircraft, a => a.type === 'military' ? 'plane-military' : 'plane-civil')
      )
    } catch (_) {}
  }, [aircraft, ready])

  // Manage trail polyline layers per tracked aircraft
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return

    const trailIds = Object.keys(trails)

    // Add/update sources and layers for each trail
    trailIds.forEach(icao24 => {
      const trail = trails[icao24]
      const srcId   = `trail-src-${icao24}`
      const lineId  = `trail-line-${icao24}`
      const baseId  = `base-src-${icao24}`
      const baseDot = `base-dot-${icao24}`

      // Trail polyline
      const pts = trail.points || []
      const coords = pts.map(p => [p.lon, p.lat])
      const geojson = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
      }

      try {
        if (map.getSource(srcId)) {
          map.getSource(srcId).setData(geojson)
        } else {
          map.addSource(srcId, { type: 'geojson', data: geojson })
          map.addLayer({
            id: lineId, type: 'line', source: srcId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': trail.color,
              'line-width': 1.5,
              'line-opacity': 0.75,
            },
          }, 'aircraft-layer')
        }
      } catch (_) {}

      // Base markers
      const bases = trail.bases || []
      const basesGeo = {
        type: 'FeatureCollection',
        features: bases.map(b => ({
          type: 'Feature',
          properties: { label: b.airfield_icao, is_military: b.is_military },
          geometry: { type: 'Point', coordinates: [b.lon, b.lat] },
        })),
      }

      try {
        if (map.getSource(baseId)) {
          map.getSource(baseId).setData(basesGeo)
        } else {
          map.addSource(baseId, { type: 'geojson', data: basesGeo })
          map.addLayer({
            id: baseDot, type: 'circle', source: baseId,
            paint: {
              'circle-radius': 5,
              'circle-color': ['case', ['get', 'is_military'], '#f43f5e', trail.color],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': 'rgba(0,0,0,0.6)',
              'circle-opacity': 0.85,
            },
          })
          map.addLayer({
            id: `${baseDot}-label`, type: 'symbol', source: baseId,
            layout: {
              'text-field': ['get', 'label'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 9, 'text-offset': [0, 1.2], 'text-anchor': 'top',
            },
            paint: {
              'text-color': trail.color,
              'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1,
            },
          })
        }
      } catch (_) {}
    })

    // Remove sources/layers for trails that were removed
    try {
      const existing = map.getStyle()?.layers?.map(l => l.id) || []
      existing.forEach(layerId => {
        const m = layerId.match(/^trail-line-(.+)$/) || layerId.match(/^base-dot-(.+?)(-label)?$/)
        if (!m) return
        const icao24 = layerId.match(/^trail-line-(.+)$/)?.[1] || layerId.match(/^base-dot-([^-]+(?:-[^-]+)*?)(-label)?$/)?.[1]
        if (icao24 && !trails[icao24]) {
          try { map.removeLayer(layerId) } catch (_) {}
        }
      })
      const sources = Object.keys(map.getStyle()?.sources || {})
      sources.forEach(srcId => {
        const m = srcId.match(/^(trail-src|base-src)-(.+)$/)
        if (m && !trails[m[2]]) {
          try { map.removeSource(srcId) } catch (_) {}
        }
      })
    } catch (_) {}
  }, [trails, ready])

  // Fly to target when alert card clicked
  useEffect(() => {
    if (!ready || !flyTarget || !mapRef.current) return
    mapRef.current.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: Math.max(mapRef.current.getZoom(), 5),
      duration: 1400,
      essential: true,
    })
  }, [flyTarget, ready])

  return (
    <div style={{ position:'relative', gridColumn:1, gridRow:2, overflow:'hidden', minHeight:0 }}>
      <div ref={containerRef} style={{ width:'100%', height:'100%' }} />

      {/* Map overlay: mode label */}
      <div style={{
        position:'absolute', top:10, left:'50%', transform:'translateX(-50%)',
        fontSize:'10px', fontWeight:'600', letterSpacing:'.2em',
        color:'rgba(0,200,255,0.4)', textTransform:'uppercase',
        pointerEvents:'none', zIndex:2, fontFamily:"'Barlow Condensed',sans-serif",
      }}>TACTICAL DISPLAY · LIVE</div>

      {onAddTrail && (
        <TrailPanel
          aircraft={aircraft}
          trails={trails}
          onAdd={onAddTrail}
          onRemove={onRemoveTrail}
          onClear={onClearTrails}
        />
      )}

      {/* Entity detail card — anclado al avión */}
      {detail && (() => {
        // Posición del popup: desplazado arriba-derecha del icono
        const W = 260
        const containerW = containerRef.current?.offsetWidth  || 800
        const containerH = containerRef.current?.offsetHeight || 600
        const flipX = detail.px + W + 16 > containerW
        const flipY = detail.py - 20 < 180
        const left = flipX ? detail.px - W - 12 : detail.px + 16
        const top  = flipY ? detail.py + 16      : detail.py - 20

        return (
          <div style={{
            position:'absolute', left, top, zIndex:10, width:`${W}px`,
            background:'rgba(7,14,28,0.97)', border:'1px solid rgba(0,200,255,0.35)',
            borderRadius:'3px', boxShadow:'0 4px 24px rgba(0,0,0,0.7)',
            fontFamily:"'IBM Plex Mono',monospace", overflow:'hidden',
          }}>
            {/* Foto del avión */}
            {metaLoading && (
              <div style={{ height:'80px', background:'rgba(0,200,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'9px', color:'rgba(0,200,255,0.3)' }}>Cargando foto…</span>
              </div>
            )}
            {!metaLoading && meta?.photo_url && (() => {
              const flag = flagUrl(detail.origin_country)
              return (
                <div style={{ position:'relative' }}>
                  <img
                    src={meta.photo_url}
                    alt={meta.model || detail.label}
                    style={{ width:'100%', height:'100px', objectFit:'cover', display:'block', opacity:0.85 }}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                  {flag && (
                    <img
                      src={flag}
                      alt={detail.origin_country}
                      title={detail.origin_country}
                      style={{
                        position:'absolute', top:7, right:7,
                        width:'20px', height:'15px',
                        boxShadow:'0 1px 4px rgba(0,0,0,0.7)',
                        border:'1px solid rgba(255,255,255,0.15)',
                        borderRadius:'1px',
                        imageRendering:'crisp-edges',
                      }}
                    />
                  )}
                  {meta.photographer && (
                    <div style={{
                      position:'absolute', bottom:3, right:5,
                      fontSize:'8px', color:'rgba(255,255,255,0.4)',
                      fontFamily:"'IBM Plex Mono',monospace",
                    }}>© {meta.photographer}</div>
                  )}
                </div>
              )
            })()}

            <div style={{ padding:'10px 12px' }}>
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                <div>
                  <div style={{ fontSize:'9px', color: detail.type === 'military' ? '#ff3b4a' : 'rgba(0,200,255,0.45)', letterSpacing:'.15em', textTransform:'uppercase' }}>
                    {detail.type === 'military' ? '⬛ MILITAR' : '▲ CIVIL'}
                  </div>
                  <div style={{ fontSize:'15px', fontWeight:'600', color:'#00c8ff', marginTop:'1px', letterSpacing:'.05em' }}>
                    {detail.label || '—'}
                  </div>
                  {(meta?.model || detail.type_code) && (
                    <div style={{ fontSize:'10px', color:'rgba(200,216,232,0.6)', marginTop:'1px' }}>
                      {meta?.model || detail.type_code}
                    </div>
                  )}
                  {(meta?.registration || detail.registration) && (
                    <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.4)', marginTop:'1px' }}>
                      {meta?.registration || detail.registration}
                    </div>
                  )}
                  {detail.origin_country && (() => {
                    const flag = flagUrl(detail.origin_country)
                    return (
                      <div style={{ display:'flex', alignItems:'center', gap:'5px', marginTop:'3px' }}>
                        {flag && (
                          <img src={flag} alt={detail.origin_country}
                            style={{ width:'14px', height:'10px', borderRadius:'1px', border:'1px solid rgba(255,255,255,0.12)', flexShrink:0 }} />
                        )}
                        <span style={{ fontSize:'9px', color:'rgba(200,216,232,0.45)', letterSpacing:'.05em' }}>
                          {detail.origin_country}
                        </span>
                      </div>
                    )
                  })()}
                </div>
                <button onClick={() => { setDetail(null); setRoute(null); setMeta(null) }} style={{
                  background:'none', border:'none', color:'rgba(0,200,255,0.4)',
                  cursor:'pointer', fontSize:'16px', lineHeight:1, padding:'0 0 0 8px', flexShrink:0,
                }}>×</button>
              </div>

              {/* Datos de vuelo */}
              {[
                detail.squawk   ? ['Squawk',    detail.squawk] : null,
                ['Velocidad', detail.speed ? `${Math.round(Number(detail.speed))} m/s` : '—'],
                detail.altitude ? ['Altitud', `${Number(detail.altitude).toLocaleString()} m`] : null,
                ['Rumbo',     detail.heading ? `${Math.round(Number(detail.heading))}°` : '—'],
                ['Zona',      detail.zone?.replace(/_/g,' ').toUpperCase()],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                  <span style={{ fontSize:'9px', color:'rgba(0,200,255,0.4)', textTransform:'uppercase', letterSpacing:'.1em' }}>{k}</span>
                  <span style={{ fontSize:'10px', color:'#c8d8e8' }}>{v || '—'}</span>
                </div>
              ))}

              {/* Ruta */}
              <div style={{ borderTop:'1px solid rgba(0,200,255,0.12)', marginTop:'7px', paddingTop:'7px' }}>
                <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'4px' }}>Ruta</div>
                {routeLoading && <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.4)' }}>Consultando…</div>}
                {!routeLoading && route && (route.origin || route.destination) && (
                  <div style={{ fontSize:'12px', letterSpacing:'.05em' }}>
                    <span style={{ color:'#00c8ff' }}>{route.origin ?? '—'}</span>
                    <span style={{ color:'rgba(0,200,255,0.3)', margin:'0 6px' }}>→</span>
                    <span style={{ color:'#00c8ff' }}>{route.destination ?? '—'}</span>
                  </div>
                )}
                {!routeLoading && route && !route.origin && !route.destination && (
                  <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.3)' }}>Sin datos de ruta</div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Custom MapLibre style overrides */}
      <style>{`
        .maplibregl-ctrl-bottom-left .maplibregl-ctrl { background: rgba(7,14,28,0.92) !important; border: 1px solid rgba(0,200,255,0.2) !important; border-radius:3px !important; }
        .maplibregl-ctrl-bottom-right .maplibregl-ctrl-scale { border-color: rgba(0,200,255,0.3) !important; color: rgba(0,200,255,0.5) !important; background: rgba(3,8,17,0.8) !important; font-family:'IBM Plex Mono',monospace !important; font-size:9px !important; }
        .maplibregl-ctrl button { background-color: transparent !important; }
        .maplibregl-ctrl button span { filter: invert(1) sepia(1) saturate(3) hue-rotate(170deg) !important; }
        .maplibregl-ctrl button:hover { background-color: rgba(0,200,255,0.1) !important; }
        .maplibregl-canvas { cursor: crosshair !important; }
      `}</style>
    </div>
  )
}
