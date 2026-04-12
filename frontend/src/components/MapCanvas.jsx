import { useEffect, useRef, useState } from 'react'
import { ZONES, CHOKEPOINTS } from '../data/zones'

function latLonToXY(lat, lon, w, h) {
  return { x: (lon + 180) / 360 * w, y: (90 - lat) / 180 * h }
}
function xyToLatLon(x, y, w, h) {
  return { lat: 90 - (y / h) * 180, lon: (x / w) * 360 - 180 }
}

export default function MapCanvas({ aircraft, vessels, alerts }) {
  const canvasRef   = useRef(null)
  const areaRef     = useRef(null)
  const scanYRef    = useRef(0)
  const frameRef    = useRef(0)
  const rafRef      = useRef(null)
  const [tooltip, setTooltip]   = useState(null)
  const [coords,  setCoords]    = useState(null)
  const entitiesRef = useRef([])

  // Keep entities ref in sync
  useEffect(() => { entitiesRef.current = [...aircraft, ...vessels] }, [aircraft, vessels])

  useEffect(() => {
    const canvas = canvasRef.current
    const area   = areaRef.current
    if (!canvas || !area) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width  = area.clientWidth
      canvas.height = area.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(area)

    function drawGrid(w, h) {
      ctx.strokeStyle = 'rgba(0,200,255,0.045)'
      ctx.lineWidth = .5
      for (let lat = -90; lat <= 90; lat += 30) {
        const {y} = latLonToXY(lat, 0, w, h)
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke()
      }
      for (let lon = -180; lon <= 180; lon += 30) {
        const {x} = latLonToXY(0, lon, w, h)
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(0,200,255,0.10)'
      ctx.lineWidth = .8
      const {y: eq} = latLonToXY(0, 0, w, h)
      ctx.beginPath(); ctx.moveTo(0,eq); ctx.lineTo(w,eq); ctx.stroke()
      const {x: pm} = latLonToXY(0, 0, w, h)
      ctx.beginPath(); ctx.moveTo(pm,0); ctx.lineTo(pm,h); ctx.stroke()
    }

    function drawZones(w, h) {
      ZONES.forEach(zone => {
        const p1 = latLonToXY(zone.lat[1], zone.lon[0], w, h)
        const p2 = latLonToXY(zone.lat[0], zone.lon[1], w, h)
        const zw = p2.x - p1.x, zh = p2.y - p1.y
        ctx.fillStyle = zone.color
        ctx.fillRect(p1.x, p1.y, zw, zh)
        ctx.strokeStyle = zone.border
        ctx.lineWidth = .7
        ctx.strokeRect(p1.x, p1.y, zw, zh)
        ctx.fillStyle = zone.border
        ctx.font = '500 8px "Barlow Condensed",sans-serif'
        ctx.fillText(zone.label, p1.x + 4, p1.y + 11)
      })
    }

    function drawChokepoints(w, h) {
      CHOKEPOINTS.forEach(cp => {
        const {x,y} = latLonToXY(cp.lat, cp.lon, w, h)
        const s = 4
        ctx.fillStyle = 'rgba(255,176,32,0.85)'
        ctx.beginPath()
        ctx.moveTo(x,y-s); ctx.lineTo(x+s,y); ctx.lineTo(x,y+s); ctx.lineTo(x-s,y)
        ctx.closePath(); ctx.fill()
        ctx.fillStyle = 'rgba(255,176,32,0.65)'
        ctx.font = '500 7.5px "IBM Plex Mono",monospace'
        ctx.fillText(cp.label, x+7, y+3)
      })
    }

    function drawAlertRings(w, h, frame) {
      alerts.forEach(a => {
        const {x,y} = latLonToXY(a.lat, a.lon, w, h)
        const col = a.severity==='high' ? '255,59,74' : a.severity==='medium' ? '255,176,32' : '0,229,160'
        const pulse = (Math.sin(frame * 0.04) + 1) / 2
        ctx.beginPath()
        ctx.arc(x, y, 18 + pulse*8, 0, Math.PI*2)
        ctx.strokeStyle = `rgba(${col},${0.15 + pulse*.15})`
        ctx.lineWidth = 1; ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, Math.PI*2)
        ctx.strokeStyle = `rgba(${col},0.6)`
        ctx.lineWidth = 1.5; ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${col},0.9)`; ctx.fill()
      })
    }

    function drawAircraft(list, w, h) {
      list.forEach(ac => {
        const {x,y} = latLonToXY(ac.lat, ac.lon, w, h)
        const isMil = ac.type==='military'
        const color = isMil ? '#ff3b4a' : '#00c8ff'
        const size  = isMil ? 5 : 3.5
        ctx.save()
        ctx.translate(x,y)
        ctx.rotate(ac.heading * Math.PI/180)
        ctx.beginPath()
        ctx.moveTo(0, -size*2); ctx.lineTo(size, size); ctx.lineTo(-size, size)
        ctx.closePath()
        ctx.fillStyle = color
        ctx.globalAlpha = isMil ? .95 : .7
        ctx.fill()
        ctx.restore()
      })
    }

    function drawVessels(list, w, h) {
      list.forEach(v => {
        const {x,y} = latLonToXY(v.lat, v.lon, w, h)
        const isMil = v.type==='military'
        const color = isMil ? '#b06dff' : '#00e5a0'
        const size  = isMil ? 5 : 3
        ctx.save()
        ctx.translate(x,y)
        ctx.rotate(v.heading * Math.PI/180)
        ctx.fillStyle = color
        ctx.globalAlpha = isMil ? .9 : .65
        ctx.fillRect(-size/2, -size, size, size*2.2)
        ctx.beginPath()
        ctx.moveTo(0,-size*1.5); ctx.lineTo(size/2,-size); ctx.lineTo(-size/2,-size)
        ctx.closePath(); ctx.fill()
        ctx.restore()
      })
    }

    function drawScanLine(w, h) {
      scanYRef.current = (scanYRef.current + .5) % h
      const sy = scanYRef.current
      const grad = ctx.createLinearGradient(0, sy-20, 0, sy+20)
      grad.addColorStop(0,'rgba(0,200,255,0)')
      grad.addColorStop(.5,'rgba(0,200,255,0.04)')
      grad.addColorStop(1,'rgba(0,200,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, sy-20, w, 40)
    }

    function loop() {
      const w = canvas.width, h = canvas.height
      frameRef.current++

      ctx.clearRect(0,0,w,h)
      ctx.fillStyle = '#030811'; ctx.fillRect(0,0,w,h)

      // Vignette
      const vig = ctx.createRadialGradient(w/2,h/2,w*.3,w/2,h/2,w*.75)
      vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.45)')
      ctx.fillStyle = vig; ctx.fillRect(0,0,w,h)

      drawGrid(w,h)
      drawZones(w,h)
      drawChokepoints(w,h)
      drawAlertRings(w,h,frameRef.current)
      drawVessels(vessels, w, h)
      drawAircraft(aircraft, w, h)
      drawScanLine(w,h)

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw on data change via ref (already done via animation loop reading from closure)
  // The loop reads aircraft/vessels from props — we need to pass them via refs for perf
  const aircraftRef = useRef(aircraft)
  const vesselsRef  = useRef(vessels)
  const alertsRef   = useRef(alerts)
  useEffect(() => { aircraftRef.current = aircraft }, [aircraft])
  useEffect(() => { vesselsRef.current  = vessels  }, [vessels])
  useEffect(() => { alertsRef.current   = alerts   }, [alerts])

  function handleMouseMove(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const {lat,lon} = xyToLatLon(mx, my, canvas.width, canvas.height)
    setCoords({ lat: lat.toFixed(2), lon: lon.toFixed(2) })

    const HIT = 12
    let hit = null
    entitiesRef.current.forEach(en => {
      const {x,y} = latLonToXY(en.lat, en.lon, canvas.width, canvas.height)
      if (Math.hypot(x-mx, y-my) < HIT) hit = en
    })
    if (hit) {
      setTooltip({
        entity: hit,
        x: e.clientX + 14,
        y: e.clientY - 10,
      })
    } else setTooltip(null)
  }

  return (
    <div
      ref={areaRef}
      style={{ position:'relative', overflow:'hidden', background:'var(--bg-0)',
               gridColumn:1, gridRow:2 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setTooltip(null); setCoords(null) }}
    >
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />

      {/* Scanline overlay */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none', zIndex:2,
        backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)',
      }} />

      {/* Mode label */}
      <div style={{
        position:'absolute', top:8, left:'50%', transform:'translateX(-50%)',
        fontSize:'10px', fontWeight:'600', letterSpacing:'.2em',
        color:'var(--cyan)', opacity:.45, textTransform:'uppercase',
        zIndex:3, pointerEvents:'none',
      }}>TACTICAL DISPLAY · EQUIRECTANGULAR</div>

      {/* Corner coordinates */}
      {[
        { id:'tl', style:{top:8,left:10},  text:'90°N · 180°W' },
        { id:'tr', style:{top:8,right:10}, text:'90°N · 180°E' },
        { id:'bl', style:{bottom:8,left:10},  text:'90°S · 180°W' },
        { id:'br', style:{bottom:8,right:10}, text:'90°S · 180°E' },
      ].map(c=>(
        <div key={c.id} style={{
          position:'absolute', ...c.style,
          fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)',
          letterSpacing:'.05em', zIndex:3, pointerEvents:'none',
        }}>{c.text}</div>
      ))}

      {/* Mouse coordinates */}
      {coords && (
        <div style={{
          position:'absolute', top:10, right:14,
          fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)',
          zIndex:5, textAlign:'right', pointerEvents:'none', lineHeight:1.8,
        }}>
          <div>LAT {coords.lat}°</div>
          <div>LON {coords.lon}°</div>
        </div>
      )}

      {/* Legend */}
      <div style={{
        position:'absolute', bottom:12, right:12, zIndex:4,
        background:'rgba(7,14,28,0.88)', border:'1px solid var(--border)',
        borderRadius:'3px', padding:'8px 12px', display:'flex',
        flexDirection:'column', gap:'5px',
      }}>
        {[
          { color:'#00c8ff', label:'Aeronave civil' },
          { color:'#ff3b4a', label:'Aeronave militar' },
          { color:'#00e5a0', label:'Embarcación' },
          { color:'#b06dff', label:'Naval militar' },
          { color:'#ffb020', label:'Chokepoint', square:true },
        ].map(l=>(
          <div key={l.label} style={{ display:'flex',alignItems:'center',gap:'7px',
            fontSize:'10px',fontWeight:'500',letterSpacing:'.08em',
            color:'var(--txt-2)',textTransform:'uppercase' }}>
            <div style={{ width:'7px',height:'7px',borderRadius: l.square?'0':'50%',
              background:l.color,flexShrink:0 }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Zoom buttons */}
      <div style={{ position:'absolute', bottom:12, left:12, zIndex:4, display:'flex', flexDirection:'column', gap:'2px' }}>
        {['+','−'].map(b=>(
          <div key={b} style={{
            width:'24px',height:'24px',background:'rgba(11,22,40,0.85)',
            border:'1px solid var(--border-md)',color:'var(--txt-2)',
            fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center',
            cursor:'pointer',borderRadius:'2px',fontFamily:'var(--mono)',
            userSelect:'none',
          }}>{b}</div>
        ))}
      </div>

      {/* Entity tooltip */}
      {tooltip && (
        <div style={{
          position:'fixed', left:tooltip.x, top:tooltip.y,
          background:'rgba(7,14,28,0.97)', border:'1px solid var(--border-hi)',
          borderRadius:'3px', padding:'8px 12px',
          fontFamily:'var(--mono)', fontSize:'10px', color:'var(--txt-1)',
          pointerEvents:'none', zIndex:20, minWidth:'160px',
          boxShadow:'0 4px 20px rgba(0,0,0,0.6)',
          animation:'fadeSlideIn .1s ease',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:'12px' }}>
            <div>
              <div style={{ color:'var(--txt-3)', fontSize:'9px', letterSpacing:'.1em', textTransform:'uppercase' }}>ID</div>
              <div style={{ color:'var(--cyan)', fontSize:'11px', fontWeight:'500' }}>
                {tooltip.entity.callsign || tooltip.entity.name || tooltip.entity.id}
              </div>
            </div>
            <div>
              <div style={{ color:'var(--txt-3)', fontSize:'9px', letterSpacing:'.1em', textTransform:'uppercase' }}>Tipo</div>
              <div style={{ color:'var(--cyan)', fontSize:'11px', fontWeight:'500' }}>
                {tooltip.entity.type?.toUpperCase()}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:'12px', marginTop:'6px' }}>
            <div>
              <div style={{ color:'var(--txt-3)', fontSize:'9px', letterSpacing:'.1em', textTransform:'uppercase' }}>Lat</div>
              <div style={{ color:'var(--cyan)', fontSize:'11px' }}>{tooltip.entity.lat?.toFixed(3)}°</div>
            </div>
            <div>
              <div style={{ color:'var(--txt-3)', fontSize:'9px', letterSpacing:'.1em', textTransform:'uppercase' }}>Lon</div>
              <div style={{ color:'var(--cyan)', fontSize:'11px' }}>{tooltip.entity.lon?.toFixed(3)}°</div>
            </div>
          </div>
          <div style={{ marginTop:'6px' }}>
            <div style={{ color:'var(--txt-3)', fontSize:'9px', letterSpacing:'.1em', textTransform:'uppercase' }}>Zona</div>
            <div style={{ color:'var(--cyan)', fontSize:'11px' }}>
              {tooltip.entity.zone?.replace(/_/g,' ').toUpperCase()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
