import { useState, useCallback } from 'react'
import { getToken } from './apiClient'

const API_BASE    = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'
const TRAIL_HOURS = 12

export function useVesselTrail() {
  const [vesselTrail, setVesselTrail] = useState(null)

  const showTrail = useCallback(async (mmsi) => {
    try {
      const token = getToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(
        `${API_BASE}/api/vessels/${mmsi}/trail?hours=${TRAIL_HOURS}`,
        { headers }
      )
      const positions = res.ok ? await res.json() : []
      setVesselTrail({ mmsi, positions })
    } catch {
      setVesselTrail({ mmsi, positions: [] })
    }
  }, [])

  const hideTrail = useCallback(() => setVesselTrail(null), [])

  return { vesselTrail, showTrail, hideTrail }
}
