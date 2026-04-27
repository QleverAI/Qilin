import { useState, useCallback } from 'react'
import { getToken } from './apiClient'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

export function useAircraftHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const token = getToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/api/aircraft/history?hours=24`, { headers })
      if (res.ok) setHistory(await res.json())
    } catch {}
    finally { setLoading(false) }
  }, [])

  return { history, loading, fetchHistory }
}
