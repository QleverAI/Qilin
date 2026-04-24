import { useState, useEffect } from 'react'
import { apiFetch } from './apiClient'

const REFRESH_MS = 60_000

export function useAircraftHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch('/api/aircraft/history?hours=72')
        setHistory(Array.isArray(data) ? data : [])
      } catch (_) {}
      finally { setLoading(false) }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  return { history, loading }
}
