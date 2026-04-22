import { useState, useEffect } from 'react'
import { apiFetch } from './apiClient'

export function useSentinelData() {
  const [zones,       setZones]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function fetchData() {
    try {
      const data = await apiFetch('/api/sentinel/zones')
      setZones(data.zones ?? [])
      setLastUpdated(new Date().toISOString())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 6 * 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  return { zones, loading, error, lastUpdated }
}
