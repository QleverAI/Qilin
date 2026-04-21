import { useState, useCallback, useRef } from 'react'
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

export function useAircraftTrail() {
  const [trails, setTrails]   = useState({})   // { icao24: { points, bases, routes, color, loading } }
  const colorIdx = useRef(0)

  const addTrail = useCallback(async (aircraft, hours = 6) => {
    const icao24 = aircraft.id || aircraft.icao24
    if (!icao24) return

    // If already tracked, remove it (toggle)
    if (trails[icao24]) {
      setTrails(prev => {
        const next = { ...prev }
        delete next[icao24]
        return next
      })
      return
    }

    const color = TRAIL_COLORS[colorIdx.current % TRAIL_COLORS.length]
    colorIdx.current++

    setTrails(prev => ({ ...prev, [icao24]: { points: [], bases: [], routes: [], color, loading: true, aircraft } }))

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
      setTrails(prev => ({
        ...prev,
        [icao24]: { ...prev[icao24], loading: false },
      }))
    }
  }, [trails])

  const removeTrail = useCallback((icao24) => {
    setTrails(prev => {
      const next = { ...prev }
      delete next[icao24]
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setTrails({})
    colorIdx.current = 0
  }, [])

  return { trails, addTrail, removeTrail, clearAll }
}
