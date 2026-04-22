import { useState, useCallback, useRef, useEffect } from 'react'
import { apiFetch } from './apiClient'

const VESSEL_TRAIL_COLOR = '#f59e0b'
const REFRESH_INTERVAL   = 60_000

export function useVesselTrail() {
  const [vesselTrails, setVesselTrails] = useState({})
  const trailsRef = useRef(vesselTrails)
  trailsRef.current = vesselTrails

  const addVesselTrail = useCallback(async (vessel, hours = 12) => {
    const mmsi = vessel.mmsi || vessel.id
    if (!mmsi) return

    // Toggle off if already active
    if (trailsRef.current[mmsi]) {
      setVesselTrails(prev => { const n = { ...prev }; delete n[mmsi]; return n })
      return
    }

    setVesselTrails(prev => ({
      ...prev,
      [mmsi]: { points: [], color: VESSEL_TRAIL_COLOR, loading: true, hours, vessel },
    }))

    try {
      const points = await apiFetch(`/api/vessels/${mmsi}/trail?hours=${hours}`).catch(() => [])
      setVesselTrails(prev => ({
        ...prev,
        [mmsi]: { ...prev[mmsi], points: Array.isArray(points) ? points : [], loading: false },
      }))
    } catch {
      setVesselTrails(prev => ({ ...prev, [mmsi]: { ...prev[mmsi], loading: false } }))
    }
  }, [])

  // Refresh active trails every 60s
  useEffect(() => {
    const id = setInterval(async () => {
      const active = Object.entries(trailsRef.current)
      if (!active.length) return
      await Promise.all(active.map(async ([mmsi, trail]) => {
        try {
          const points = await apiFetch(`/api/vessels/${mmsi}/trail?hours=${trail.hours || 12}`)
          setVesselTrails(prev => prev[mmsi]
            ? { ...prev, [mmsi]: { ...prev[mmsi], points: Array.isArray(points) ? points : [] } }
            : prev
          )
        } catch (_) {}
      }))
    }, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [])

  const removeVesselTrail = useCallback((mmsi) => {
    setVesselTrails(prev => { const n = { ...prev }; delete n[mmsi]; return n })
  }, [])

  const clearAllVesselTrails = useCallback(() => setVesselTrails({}), [])

  return { vesselTrails, addVesselTrail, removeVesselTrail, clearAllVesselTrails }
}
