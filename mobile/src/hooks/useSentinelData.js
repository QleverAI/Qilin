import { useState, useEffect } from 'react'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const ZONES_PATH = '/sentinel/zones'

export function useSentinelData() {
  const cached = getCached(ZONES_PATH)

  const [zones,   setZones]   = useState(cached || [])
  const [loading, setLoading] = useState(!cached)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchZones() {
      try {
        const data = await fetchWithCache(ZONES_PATH)
        if (!cancelled) { setZones(data || []); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!cached) {
      hydrateFromStorage(ZONES_PATH).then(data => {
        if (!cancelled && data) { setZones(data); setLoading(false) }
      })
    }

    fetchZones()
    // Sentinel refresca cada 6h en el ingestor; polling cada 5min en cliente es más que suficiente
    const interval = setInterval(fetchZones, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { zones, loading, error }
}

export function prefetchSentinel() {
  prefetch(ZONES_PATH)
}
