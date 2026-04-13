import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ZONES, CHOKEPOINTS } from '../data/zones'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

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
          [z.lon[0], z.lat[0]], [z.lon[1], z.lat[0]],
          [z.lon[1], z.lat[1]], [z.lon[0], z.lat[1]],
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
export default function MapView({ aircraft, alerts, flyTarget }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const [ready, setReady]             = useState(false)
  const [detail, setDetail]           = useState(null)
  const [route, setRoute]             = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const animRef  = useRef(null)
  const pulseRef = useRef(0)

  async function fetchRoute(callsign) {
    if (!callsign) { setRoute(null); return }
    const token = sessionStorage.getItem('qilin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    setRouteLoading(true)
    setRoute(null)
    try {
      const res  = await fetch(`/api/routes/${encodeURIComponent(callsign)}`, { headers })
      const data = res.ok ? await res.json() : {}
      setRoute(data)
    } catch (_) {
      setRoute({})
    } finally {
      setRouteLoading(false)
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

      // ── Zones ──
      map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON() })
      map.addLayer({ id:'zones-fill', type:'fill', source:'zones', paint:{ 'fill-color':'rgba(0,200,255,0.05)', 'fill-opacity':1 } })
      map.addLayer({ id:'zones-line', type:'line', source:'zones', paint:{ 'line-color':['get','stroke'], 'line-width':0.8, 'line-opacity':0.7 } })
      map.addLayer({
        id:'zones-label', type:'symbol', source:'zones',
        layout:{ 'text-field':['get','label'], 'text-font':['Noto Sans Regular'], 'text-size':9, 'text-anchor':'top-left', 'text-offset':[0.3,0.3], 'text-allow-overlap':true },
        paint:{ 'text-color':'rgba(0,200,255,0.5)', 'text-halo-color':'rgba(0,0,0,0.5)', 'text-halo-width':1 },
      })

      // ── Chokepoints ──
      map.addSource('chokes', { type: 'geojson', data: chokesToGeoJSON() })
      map.addLayer({ id:'chokes-dot', type:'circle', source:'chokes',
        paint:{ 'circle-radius':5, 'circle-color':'#ffb020', 'circle-opacity':.85,
          'circle-stroke-width':1, 'circle-stroke-color':'rgba(255,176,32,0.4)' } })
      map.addLayer({ id:'chokes-label', type:'symbol', source:'chokes',
        layout:{ 'text-field':['get','label'], 'text-font':['Noto Sans Regular'], 'text-size':9, 'text-offset':[1,0], 'text-anchor':'left', 'text-allow-overlap':true },
        paint:{ 'text-color':'rgba(255,176,32,0.75)', 'text-halo-color':'rgba(0,0,0,0.6)', 'text-halo-width':1 },
      })

      // ── Alert rings (animated) ──
      map.addSource('alerts-src', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })
      map.addLayer({ id:'alerts-outer', type:'circle', source:'alerts-src',
        paint:{ 'circle-radius':20, 'circle-color':'transparent',
          'circle-stroke-width':1.5, 'circle-stroke-color':['case',
            ['==',['get','severity'],'high'],'#ff3b4a',
            ['==',['get','severity'],'medium'],'#ffb020','#00e5a0'],
          'circle-stroke-opacity':0.5 } })
      map.addLayer({ id:'alerts-inner', type:'circle', source:'alerts-src',
        paint:{ 'circle-radius':8, 'circle-color':'transparent',
          'circle-stroke-width':2, 'circle-stroke-color':['case',
            ['==',['get','severity'],'high'],'#ff3b4a',
            ['==',['get','severity'],'medium'],'#ffb020','#00e5a0'],
          'circle-stroke-opacity':0.8 } })
      map.addLayer({ id:'alerts-dot', type:'circle', source:'alerts-src',
        paint:{ 'circle-radius':3, 'circle-color':['case',
            ['==',['get','severity'],'high'],'#ff3b4a',
            ['==',['get','severity'],'medium'],'#ffb020','#00e5a0'],
          'circle-opacity':0.95 } })

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
          setDetail({ ...props, lngLat: e.lngLat })
          fetchRoute(props.label)
        }
      })
      map.on('mouseenter', 'aircraft-layer', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'aircraft-layer', () => { map.getCanvas().style.cursor = '' })

      map.on('click', e => {
        if (!e.features?.length) {
          setDetail(null)
          setRoute(null)
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

  // Update alert source
  useEffect(() => {
    if (!ready || !mapRef.current) return
    try {
      mapRef.current.getSource('alerts-src')?.setData(alertsGeoJSON(alerts))
    } catch (_) {}
  }, [alerts, ready])

  // Animate alert rings pulse
  useEffect(() => {
    if (!ready || !mapRef.current) return
    function pulse() {
      pulseRef.current += 0.04
      const t = (Math.sin(pulseRef.current) + 1) / 2
      try {
        mapRef.current.setPaintProperty('alerts-outer', 'circle-radius', 18 + t * 10)
        mapRef.current.setPaintProperty('alerts-outer', 'circle-stroke-opacity', 0.15 + t * 0.35)
      } catch (_) {}
      animRef.current = requestAnimationFrame(pulse)
    }
    animRef.current = requestAnimationFrame(pulse)
    return () => cancelAnimationFrame(animRef.current)
  }, [ready])

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

      {/* Entity detail card */}
      {detail && (
        <div style={{
          position:'absolute', top:14, right:14, zIndex:10,
          background:'rgba(7,14,28,0.97)', border:'1px solid rgba(0,200,255,0.35)',
          borderRadius:'3px', padding:'12px 14px', minWidth:'220px',
          boxShadow:'0 4px 24px rgba(0,0,0,0.7)',
          fontFamily:"'IBM Plex Mono',monospace",
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
            <div>
              <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.45)', letterSpacing:'.15em', textTransform:'uppercase' }}>
                {detail.type?.toUpperCase()}
              </div>
              <div style={{ fontSize:'14px', fontWeight:'500', color:'#00c8ff', marginTop:'2px' }}>
                {detail.label}
              </div>
            </div>
            <button onClick={() => { setDetail(null); setRoute(null) }} style={{
              background:'none', border:'none', color:'rgba(0,200,255,0.4)',
              cursor:'pointer', fontSize:'16px', lineHeight:1, padding:'0 0 0 8px',
            }}>×</button>
          </div>

          {/* Flight data */}
          {[
            ['Zona',      detail.zone?.replace(/_/g,' ').toUpperCase()],
            ['País',      detail.origin_country],
            ['Velocidad', detail.speed ? `${Math.round(detail.speed)} m/s` : '—'],
            detail.altitude ? ['Altitud', `${Number(detail.altitude).toLocaleString()} m`] : null,
            ['Rumbo',     detail.heading ? `${Math.round(detail.heading)}°` : '—'],
          ].filter(Boolean).map(([k, v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
              <span style={{ fontSize:'9px', color:'rgba(0,200,255,0.4)', textTransform:'uppercase', letterSpacing:'.1em' }}>{k}</span>
              <span style={{ fontSize:'10px', color:'#c8d8e8' }}>{v || '—'}</span>
            </div>
          ))}

          {/* Route section */}
          <div style={{ borderTop:'1px solid rgba(0,200,255,0.15)', marginTop:'8px', paddingTop:'8px' }}>
            <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'5px' }}>
              Ruta
            </div>
            {routeLoading && (
              <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.4)' }}>Consultando…</div>
            )}
            {!routeLoading && route && (route.origin || route.destination) && (
              <div style={{ fontSize:'12px', color:'#c8d8e8', letterSpacing:'.05em' }}>
                <span style={{ color:'#00c8ff' }}>{route.origin ?? '—'}</span>
                <span style={{ color:'rgba(0,200,255,0.35)', margin:'0 6px' }}>→</span>
                <span style={{ color:'#00c8ff' }}>{route.destination ?? '—'}</span>
              </div>
            )}
            {!routeLoading && route && !route.origin && !route.destination && (
              <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.3)' }}>Sin datos de ruta</div>
            )}
            {!routeLoading && !route && (
              <div style={{ fontSize:'9px', color:'rgba(0,200,255,0.3)' }}>—</div>
            )}
          </div>
        </div>
      )}

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
