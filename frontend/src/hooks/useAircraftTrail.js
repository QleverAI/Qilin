import { useState, useCallback, useRef, useEffect } from 'react'
import { apiFetch } from './apiClient'

// Colors for up to 6 simultaneous trails
const TRAIL_COLORS = [
  '#4f9cf9', // cyan-blue
  '#f97316', // orange
  '#22c55e', // green
  '#a855f7', // purple
  '#f43f5e', // red
  '#eab308', // yellow
]

const REFRESH_INTERVAL = 30_000  // refresca puntos cada 30s

export function useAircraftTrail() {
  const [trails, setTrails] = useState({})  // { icao24: { points, bases, routes, color, loading, hours } }
  const colorIdx  = useRef(0)
  const trailsRef = useRef(trails)
  trailsRef.current = trails

  const addTrail = useCallback(async (aircraft, hours = 6) => {
    const icao24 = aircraft.id || aircraft.icao24
    if (!icao24) return

    // Toggle off if already active
    if (trailsRef.current[icao24]) {
      setTrails(prev => { const n = { ...prev }; delete n[icao24]; return n })
      return
    }

    const color = TRAIL_COLORS[colorIdx.current % TRAIL_COLORS.length]
    colorIdx.current++

    setTrails(prev => ({ ...prev, [icao24]: { points: [], bases: [], routes: [], color, loading: true, hours, aircraft } }))

    try {
      const [points, bases, routes] = await Promise.all([
        apiFetch(`/api/aircraft/${icao24}/trail?hours=${hours}`).catch(() => []),
        apiFetch(`/api/aircraft/${icao24}/bases`).catch(() => []),
        apiFetch(`/api/aircraft/${icao24}/routes`).catch(() => []),
      ])
      setTrails(prev => ({
        ...prev,
        [icao24]: { ...prev[icao24], points, bases, routes, loading: false },
      }))
    } catch {
      setTrails(prev => ({ ...prev, [icao24]: { ...prev[icao24], loading: false } }))
    }
  }, [])

  // Refresca los puntos de cada trail activo cada 30s
  useEffect(() => {
    const id = setInterval(async () => {
      const active = Object.entries(trailsRef.current)
      if (!active.length) return
      await Promise.all(active.map(async ([icao24, trail]) => {
        try {
          const points = await apiFetch(`/api/aircraft/${icao24}/trail?hours=${trail.hours || 6}`)
          setTrails(prev => prev[icao24]
            ? { ...prev, [icao24]: { ...prev[icao24], points } }
            : prev
          )
        } catch (_) {}
      }))
    }, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [])

  const removeTrail = useCallback((icao24) => {
    setTrails(prev => { const n = { ...prev }; delete n[icao24]; return n })
  }, [])

  const clearAll = useCallback(() => {
    setTrails({})
    colorIdx.current = 0
  }, [])

  return { trails, addTrail, removeTrail, clearAll }
}
