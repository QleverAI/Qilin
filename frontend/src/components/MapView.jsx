import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ZONES, CHOKEPOINTS } from '../data/zones'
import TrailPanel from './TrailPanel'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

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

// ── Icon factories ─────────────────────────────────────────────────────────────

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

// Fighter: sharp delta wing, narrow body
function makeFighterIcon(color, size = 22) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  const cx = size / 2
  ctx.fillStyle = color; ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.moveTo(cx, 1)                          // nose
  ctx.lineTo(cx + size * 0.42, size * 0.72)  // right wingtip
  ctx.lineTo(cx + size * 0.12, size * 0.58)  // right fuselage shoulder
  ctx.lineTo(cx + size * 0.08, size - 3)     // right tail
  ctx.lineTo(cx - size * 0.08, size - 3)     // left tail
  ctx.lineTo(cx - size * 0.12, size * 0.58)  // left fuselage shoulder
  ctx.lineTo(cx - size * 0.42, size * 0.72)  // left wingtip
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

// Helicopter: wide rotor disc + compact body
function makeHelicopterIcon(color, size = 22) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  const cx = size / 2
  ctx.fillStyle = color; ctx.globalAlpha = 0.95
  // Rotor blade (wide horizontal bar)
  ctx.fillRect(2, size * 0.18, size - 4, size * 0.13)
  // Body (compact oval)
  ctx.beginPath()
  ctx.ellipse(cx, size * 0.6, size * 0.2, size * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()
  // Tail boom
  ctx.fillRect(cx - 1, size * 0.82, 2, size * 0.16)
  return ctx.getImageData(0, 0, size, size)
}

// Tanker/transport aircraft: wide-body elongated
function makeTransportIcon(color, size = 24) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  const cx = size / 2
  ctx.fillStyle = color; ctx.globalAlpha = 0.95
  // Wide fuselage
  ctx.beginPath()
  ctx.moveTo(cx, 1)                         // nose
  ctx.lineTo(cx + size * 0.3, size * 0.45)  // right wing root
  ctx.lineTo(cx + size * 0.45, size * 0.38) // right wingtip
  ctx.lineTo(cx + size * 0.22, size * 0.65) // right wing trailing
  ctx.lineTo(cx + size * 0.1, size - 3)     // right tail
  ctx.lineTo(cx - size * 0.1, size - 3)     // left tail
  ctx.lineTo(cx - size * 0.22, size * 0.65) // left wing trailing
  ctx.lineTo(cx - size * 0.45, size * 0.38) // left wingtip
  ctx.lineTo(cx - size * 0.3, size * 0.45)  // left wing root
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

// Surveillance/AWACS: wide low-wing + rotodome disc hint
function makeSurveillanceIcon(color, size = 22) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  const cx = size / 2
  ctx.fillStyle = color; ctx.globalAlpha = 0.95
  // Body
  ctx.beginPath()
  ctx.moveTo(cx, 2)
  ctx.lineTo(cx + size * 0.38, size * 0.52)
  ctx.lineTo(cx + size * 0.1, size * 0.58)
  ctx.lineTo(cx, size - 3)
  ctx.lineTo(cx - size * 0.1, size * 0.58)
  ctx.lineTo(cx - size * 0.38, size * 0.52)
  ctx.closePath()
  ctx.fill()
  // Rotodome stripe across middle
  ctx.globalAlpha = 0.7
  ctx.fillRect(cx - size * 0.28, size * 0.36, size * 0.56, size * 0.09)
  return ctx.getImageData(0, 0, size, size)
}

// ── Vessel icons ───────────────────────────────────────────────────────────────

// Military warship: sharp bow, narrow stern
function makeWarshipIcon(color, size = 20) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  const cx = size / 2
  ctx.fillStyle = color; ctx.globalAlpha = 0.92
  ctx.beginPath()
  ctx.moveTo(cx, 1)                          // sharp bow
  ctx.lineTo(cx + size * 0.28, size * 0.28)
  ctx.lineTo(cx + size * 0.2,  size - 3)    // stern
  ctx.lineTo(cx - size * 0.2,  size - 3)
  ctx.lineTo(cx - size * 0.28, size * 0.28)
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

// Tanker: long thin cigar hull
function makeTankerShipIcon(color, size = 20) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  const cx = size / 2
  const hw = Math.round(size * 0.18)  // thinner than generic
  ctx.fillStyle = color; ctx.globalAlpha = 0.92
  ctx.beginPath()
  ctx.moveTo(cx, 1)
  ctx.lineTo(cx + hw, size * 0.22)
  ctx.lineTo(cx + hw, size - 3)
  ctx.lineTo(cx - hw, size - 3)
  ctx.lineTo(cx - hw, size * 0.22)
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

// Cargo: wide boxy hull with notched bow
function makeCargoShipIcon(color, size = 20) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const ctx = c.getContext('2d')
  const cx = size / 2
  const hw = Math.round(size * 0.32)  // wider
  ctx.fillStyle = color; ctx.globalAlpha = 0.92
  ctx.beginPath()
  ctx.moveTo(cx, 1)
  ctx.lineTo(cx + hw, size * 0.35)
  ctx.lineTo(cx + hw, size - 3)
  ctx.lineTo(cx - hw, size - 3)
  ctx.lineTo(cx - hw, size * 0.35)
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

// ── Classify aircraft military sub-type ───────────────────────────────────────

function getAircraftIcon(ac) {
  if (ac.type === 'vip') return 'plane-vip'
  if (ac.type !== 'military') return 'plane-civil'
  const tc = (ac.type_code || '').toUpperCase()
  // Helicopters
  if (/^(AH6|AH64|UH6|UH72|CH47|SH60|MH6|NH90|EC13|EC14|EC15|EC72|H225|H160|MI8|MI24|MI26|MI28|KA52|KA50|LYNX|MERL|PUMA|COUG|OH6|OH58|RAH6|WAH|BELL|CHIC|SEAH|TIGR)/.test(tc)) return 'plane-helicopter'
  // Fighters / interceptors
  if (/^(F16|F15|F22|F35|F18|FA18|F14|MIG2|MIG3|SU2[7-9]|SU3[0-7]|JAS3|EF20|M2KC|JF17|T50|TYPHO|RAFAL|GRHK|HA22|EURO|SU57|J10|J20)/.test(tc)) return 'plane-fighter'
  // Tanker / transport
  if (/^(KC13|KC10|KC46|IL78|MRTT|VC10|K130|KC76|C17|C130|C5|IL76|AN12|AN26|AN72|AN1|C2|C9|A400|CN23|CASA)/.test(tc)) return 'plane-transport'
  // Surveillance / AWACS / ISR
  if (/^(E3|E767|RC13|P8|P3|EP3|U2|RQ4|ATL2|NIM|BR11|JSTAR|TR1|ER2|S3)/.test(tc)) return 'plane-surveillance'
  return 'plane-military'
}

function makePlaneMarkerEl(color, size = 28) {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx  = size / 2
  ctx.fillStyle = color; ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.moveTo(cx, 1)
  ctx.lineTo(cx + 7, size - 4)
  ctx.lineTo(cx, size - 8)
  ctx.lineTo(cx - 7, size - 4)
  ctx.closePath()
  ctx.fill()
  // Subtle glow ring
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.arc(cx, cx, cx - 2, 0, Math.PI * 2)
  ctx.stroke()
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `width:${size}px;height:${size}px;pointer-events:none`
  wrapper.appendChild(canvas)
  return wrapper
}

// ── GeoJSON helpers ────────────────────────────────────────────────────────────

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
        label:    e.type === 'vip' ? (e.vip_owner || e.callsign || e.id) : (e.callsign || e.name || e.id),
        type:     e.type,
        heading:  e.heading || 0,
        speed:    e.speed,
        altitude: e.altitude,
        zone:     e.zone,
        origin_country: e.origin_country,
        vip_owner:    e.vip_owner    || null,
        vip_category: e.vip_category || null,
        icon:     iconFn(e),
      },
      geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
    })),
  }
}

function vesselsToGeoJSON(vessels) {
  return {
    type: 'FeatureCollection',
    features: vessels.map(v => ({
      type: 'Feature',
      properties: {
        id:          v.id,
        mmsi:        v.mmsi,
        label:       v.name || v.mmsi,
        type:        v.type,
        heading:     v.heading || 0,
        speed:       v.speed,
        flag:        v.flag,
        company:     v.company,
        destination: v.destination,
        ais_active:  v.ais_active,
        zone:        v.zone,
        icon: v.type === 'military'  ? 'ship-military'
             : v.type === 'tanker'   ? 'ship-tanker'
             : v.type === 'cargo'    ? 'ship-cargo'
             : v.type === 'passenger'? 'ship-cargo'
             : 'ship-cargo',
      },
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
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

// ── Component ──────────────────────────────────────────────────────────────────
export default function MapView({
  aircraft, vessels = [], alerts, flyTarget,
  trails = {}, onAddTrail, onRemoveTrail, onClearTrails,
  vesselTrails = {},
  onSelectAircraft, onSelectVessel,
  playback,
}) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const [ready, setReady] = useState(false)
  const playbackMarkersRef = useRef({})

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
      // ── Register aircraft icons ──
      map.addImage('plane-civil',        makePlaneIcon('#00c8ff'))
      map.addImage('plane-military',     makePlaneIcon('#ff3b4a', 26))
      map.addImage('plane-vip',          makePlaneIcon('#ffd60a', 26))
      map.addImage('plane-fighter',      makeFighterIcon('#ff3b4a', 22))
      map.addImage('plane-helicopter',   makeHelicopterIcon('#ff7a45', 22))
      map.addImage('plane-transport',    makeTransportIcon('#ff3b4a', 24))
      map.addImage('plane-surveillance', makeSurveillanceIcon('#c084fc', 22))

      // ── Register vessel icons ──
      map.addImage('ship-military',  makeWarshipIcon('#f43f5e', 20))
      map.addImage('ship-tanker',    makeTankerShipIcon('#f59e0b', 20))
      map.addImage('ship-cargo',     makeCargoShipIcon('#60a5fa', 20))

      // ── Zones ──
      map.addSource('zones', { type: 'geojson', data: zonesToGeoJSON() })
      map.addLayer({ id:'zones-label', type:'symbol', source:'zones',
        layout:{ 'text-field':['get','label'], 'text-font':['Noto Sans Regular'],
          'text-size':9, 'text-anchor':'center', 'text-allow-overlap':true },
        paint:{ 'text-color':['get','stroke'], 'text-halo-color':'rgba(0,0,0,0.7)', 'text-halo-width':1.5 },
      })

      // ── Chokepoints ──
      map.addSource('chokes', { type: 'geojson', data: chokesToGeoJSON() })
      map.addLayer({ id:'chokes-label', type:'symbol', source:'chokes',
        layout:{ 'text-field':['get','label'], 'text-font':['Noto Sans Regular'], 'text-size':9, 'text-anchor':'center', 'text-allow-overlap':true },
        paint:{ 'text-color':'rgba(255,176,32,0.65)', 'text-halo-color':'rgba(0,0,0,0.6)', 'text-halo-width':1 },
      })

      // ── Vessels ──
      map.addSource('vessels-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'vessels-layer', type: 'symbol', source: 'vessels-src',
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': 1,
        },
        paint: { 'icon-opacity': 0.9 },
      })
      map.addLayer({ id: 'vessels-labels', type: 'symbol', source: 'vessels-src',
        minzoom: 6,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 9,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: { 'text-color': 'rgba(200,216,232,0.65)', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 },
      })

      // ── Aircraft ──
      map.addSource('aircraft-src', { type:'geojson', data:{ type:'FeatureCollection', features:[] } })
      map.addLayer({ id:'aircraft-layer', type:'symbol', source:'aircraft-src',
        layout:{ 'icon-image':['get','icon'], 'icon-rotate':['get','heading'],
          'icon-rotation-alignment':'map', 'icon-allow-overlap':true, 'icon-ignore-placement':true,
          'icon-size':1 },
        paint:{ 'icon-opacity':0.9 } })
      map.addLayer({ id:'aircraft-labels', type:'symbol', source:'aircraft-src',
        minzoom: 5,
        layout:{ 'text-field':['get','label'], 'text-font':['Noto Sans Regular'],
          'text-size':9, 'text-offset':[0,1.2], 'text-anchor':'top', 'text-allow-overlap':false },
        paint:{ 'text-color':'rgba(200,216,232,0.7)', 'text-halo-color':'rgba(0,0,0,0.8)', 'text-halo-width':1 } })

      // ── Click handlers ──
      map.on('click', 'vessels-layer', e => {
        const props = e.features[0]?.properties
        if (props && onSelectVessel) onSelectVessel({ ...props, lon: e.lngLat.lng, lat: e.lngLat.lat })
      })
      map.on('mouseenter', 'vessels-layer', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'vessels-layer', () => { map.getCanvas().style.cursor = '' })

      map.on('click', 'aircraft-layer', e => {
        const props = e.features[0]?.properties
        if (props && onSelectAircraft) onSelectAircraft({ ...props, lon: e.lngLat.lng, lat: e.lngLat.lat })
      })
      map.on('mouseenter', 'aircraft-layer', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'aircraft-layer', () => { map.getCanvas().style.cursor = '' })

      map.on('click', e => {
        const acHits     = map.queryRenderedFeatures(e.point, { layers: ['aircraft-layer'] })
        const vesselHits = map.queryRenderedFeatures(e.point, { layers: ['vessels-layer'] })
        if (!acHits.length && onSelectAircraft)   onSelectAircraft(null)
        if (!vesselHits.length && onSelectVessel) onSelectVessel(null)
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
      mapRef.current.getSource('aircraft-src')?.setData(toGeoJSON(aircraft, getAircraftIcon))
    } catch (_) {}
  }, [aircraft, ready])

  // Update vessels source
  useEffect(() => {
    if (!ready || !mapRef.current) return
    try {
      mapRef.current.getSource('vessels-src')?.setData(vesselsToGeoJSON(vessels))
    } catch (_) {}
  }, [vessels, ready])

  // Aircraft trail layers
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return

    const trailIds = Object.keys(trails)

    trailIds.forEach(icao24 => {
      const trail  = trails[icao24]
      const srcId  = `trail-src-${icao24}`
      const lineId = `trail-line-${icao24}`
      const baseId = `base-src-${icao24}`
      const baseDot = `base-dot-${icao24}`

      const pts    = trail.points || []
      const coords = pts.map(p => [p.lon, p.lat])
      const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }

      try {
        if (map.getSource(srcId)) {
          map.getSource(srcId).setData(geojson)
        } else {
          map.addSource(srcId, { type: 'geojson', data: geojson })
          map.addLayer({
            id: lineId, type: 'line', source: srcId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': trail.color, 'line-width': 1.5, 'line-opacity': 0.75 },
          }, 'aircraft-layer')
        }
      } catch (_) {}

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
              'circle-stroke-width': 1.5, 'circle-stroke-color': 'rgba(0,0,0,0.6)', 'circle-opacity': 0.85,
            },
          })
          map.addLayer({
            id: `${baseDot}-label`, type: 'symbol', source: baseId,
            layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 9, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
            paint: { 'text-color': trail.color, 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 },
          })
        }
      } catch (_) {}
    })

    try {
      const existing = map.getStyle()?.layers?.map(l => l.id) || []
      existing.forEach(layerId => {
        const m1 = layerId.match(/^trail-line-(.+)$/)
        const m2 = layerId.match(/^base-dot-([^-]+(?:-[^-]+)*?)(-label)?$/)
        const icao24 = m1?.[1] || m2?.[1]
        if (icao24 && !trails[icao24]) {
          try { map.removeLayer(layerId) } catch (_) {}
        }
      })
      Object.keys(map.getStyle()?.sources || {}).forEach(srcId => {
        const m = srcId.match(/^(trail-src|base-src)-(.+)$/)
        if (m && !trails[m[2]]) {
          try { map.removeSource(srcId) } catch (_) {}
        }
      })
    } catch (_) {}
  }, [trails, ready])

  // Vessel trail layers
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return

    Object.keys(vesselTrails).forEach(mmsi => {
      const trail  = vesselTrails[mmsi]
      const srcId  = `vessel-trail-src-${mmsi}`
      const lineId = `vessel-trail-line-${mmsi}`
      const pts    = trail.points || []
      const geojson = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: pts.map(p => [p.lon, p.lat]) },
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
              'line-width': 2,
              'line-opacity': 0.8,
              'line-dasharray': [3, 1.5],
            },
          }, 'vessels-layer')
        }
      } catch (_) {}
    })

    // Remove stale vessel trail layers
    try {
      const existing = map.getStyle()?.layers?.map(l => l.id) || []
      existing.forEach(layerId => {
        const m = layerId.match(/^vessel-trail-line-(.+)$/)
        if (m && !vesselTrails[m[1]]) {
          try { map.removeLayer(layerId) } catch (_) {}
        }
      })
      Object.keys(map.getStyle()?.sources || {}).forEach(srcId => {
        const m = srcId.match(/^vessel-trail-src-(.+)$/)
        if (m && !vesselTrails[m[1]]) {
          try { map.removeSource(srcId) } catch (_) {}
        }
      })
    } catch (_) {}
  }, [vesselTrails, ready])

  // Animated playback markers
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !playback) return
    const { positions } = playback

    for (const [icao24, pos] of Object.entries(positions)) {
      const existing = playbackMarkersRef.current[icao24]
      if (pos == null) {
        if (existing) { existing.remove(); delete playbackMarkersRef.current[icao24] }
        continue
      }
      if (existing) {
        existing.setLngLat([pos.lon, pos.lat])
        existing.setRotation(pos.heading ?? 0)
      } else {
        const el = makePlaneMarkerEl(pos.color || '#4f9cf9', 28)
        playbackMarkersRef.current[icao24] = new maplibregl.Marker({
          element: el, rotation: pos.heading ?? 0, rotationAlignment: 'map',
        }).setLngLat([pos.lon, pos.lat]).addTo(map)
      }
    }

    // Remove markers for trails that were removed
    for (const icao24 of Object.keys(playbackMarkersRef.current)) {
      if (!(icao24 in positions)) {
        playbackMarkersRef.current[icao24].remove()
        delete playbackMarkersRef.current[icao24]
      }
    }
  }, [playback?.positions, ready])

  useEffect(() => {
    return () => {
      for (const m of Object.values(playbackMarkersRef.current)) m.remove()
      playbackMarkersRef.current = {}
    }
  }, [])

  // Fly to target
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
