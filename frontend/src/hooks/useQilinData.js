import { useState, useEffect, useRef, useCallback } from 'react'
import { generateAircraft, generateVessels, MOCK_ALERTS } from '../data/mockData'

const WS_URL = 'ws://localhost:8000/ws'

export function useQilinData() {
  const [aircraft, setAircraft] = useState(() => generateAircraft())
  const [vessels,  setVessels]  = useState(() => generateVessels())
  const [alerts,   setAlerts]   = useState(MOCK_ALERTS)
  const [wsStatus, setWsStatus] = useState('disconnected') // connected | disconnected | error

  const wsRef    = useRef(null)
  const animRef  = useRef(null)
  const frameRef = useRef(0)

  // ── Animate entities locally ──────────────────────────────
  const tick = useCallback(() => {
    frameRef.current++
    if (frameRef.current % 3 === 0) {
      setAircraft(prev => prev.map(a => ({
        ...a,
        lat: a.lat + a.vy,
        lon: a.lon + a.vx,
        vy: Math.abs(a.lat + a.vy) > 72 ? -a.vy : a.vy,
        vx: Math.abs(a.lon + a.vx) > 175 ? -a.vx : a.vx,
      })))
      setVessels(prev => prev.map(v => ({
        ...v,
        lat: v.lat + v.vy,
        lon: v.lon + v.vx,
        vy: Math.abs(v.lat + v.vy) > 72 ? -v.vy : v.vy,
        vx: Math.abs(v.lon + v.vx) > 175 ? -v.vx : v.vx,
      })))
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [tick])

  // ── WebSocket (connects to real API when available) ───────
  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        ws.onopen = () => setWsStatus('connected')
        ws.onclose = () => {
          setWsStatus('disconnected')
          setTimeout(connect, 5000) // reconnect
        }
        ws.onerror = () => setWsStatus('error')

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'alert') {
              setAlerts(prev => [msg.data, ...prev].slice(0, 50))
            }
            if (msg.type === 'aircraft') {
              setAircraft(prev => {
                const idx = prev.findIndex(a => a.icao24 === msg.data.icao24)
                if (idx >= 0) {
                  const next = [...prev]
                  next[idx] = { ...next[idx], ...msg.data }
                  return next
                }
                return [...prev, msg.data]
              })
            }
            if (msg.type === 'vessel') {
              setVessels(prev => {
                const idx = prev.findIndex(v => v.mmsi === msg.data.mmsi)
                if (idx >= 0) {
                  const next = [...prev]
                  next[idx] = { ...next[idx], ...msg.data }
                  return next
                }
                return [...prev, msg.data]
              })
            }
          } catch (_) {}
        }
      } catch (_) {
        setWsStatus('error')
      }
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  const stats = {
    aircraftTotal:   aircraft.length,
    aircraftMil:     aircraft.filter(a => a.type === 'military').length,
    vesselsTotal:    vessels.length,
    vesselsMil:      vessels.filter(v => v.type === 'military').length,
    alertsHigh:      alerts.filter(a => a.severity === 'high').length,
    alertsMedium:    alerts.filter(a => a.severity === 'medium').length,
    alertsTotal:     alerts.length,
  }

  return { aircraft, vessels, alerts, stats, wsStatus }
}
