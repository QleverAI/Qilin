import { useState, useRef, useCallback } from 'react'
import { getToken } from './apiClient'

const API_BASE    = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'
const POLL_MS     = 30_000
const TRAIL_HOURS = 6
const MAX_TRAILS  = 6

async function fetchTrail(icao24) {
  const token = getToken()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(
    `${API_BASE}/api/aircraft/${icao24}/trail?hours=${TRAIL_HOURS}`,
    { headers }
  )
  if (!res.ok) return []
  return res.json()
}

export function useAircraftTrails() {
  const [trails, setTrails] = useState(new Map())
  const timers = useRef(new Map())

  const addTrail = useCallback(async (icao24) => {
    if (timers.current.has(icao24)) return
    if (timers.current.size >= MAX_TRAILS) return

    const load = async () => {
      try {
        const positions = await fetchTrail(icao24)
        setTrails(prev => new Map(prev).set(icao24, positions))
      } catch {}
    }

    await load()
    const id = setInterval(load, POLL_MS)
    timers.current.set(icao24, id)
  }, [])

  const removeTrail = useCallback((icao24) => {
    clearInterval(timers.current.get(icao24))
    timers.current.delete(icao24)
    setTrails(prev => {
      const next = new Map(prev)
      next.delete(icao24)
      return next
    })
  }, [])

  const hasTrail = useCallback((icao24) => timers.current.has(icao24), [])

  return { trails, addTrail, removeTrail, hasTrail }
}
