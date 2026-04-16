import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from './apiClient'

export function useSecFeed() {
  const [filings,    setFilings]    = useState([])
  const [sources,    setSources]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawFilings, rawSources] = await Promise.all([
          apiFetch('/api/sec/feed?limit=100'),
          apiFetch('/api/sec/sources'),
        ])
        if (cancelled) return
        setFilings(rawFilings  || [])
        setSources(rawSources  || [])
        setLastUpdate(new Date())
      } catch (err) {
        console.warn('[useSecFeed] fetch failed:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const sectors   = useMemo(() => [...new Set(sources.map(s => s.sector))].sort(),    [sources])
  const tickers   = useMemo(() => [...new Set(sources.map(s => s.ticker))].sort(),    [sources])
  const formTypes = useMemo(() => [...new Set(filings.map(f => f.form_type))].sort(), [filings])

  const failingSources = useMemo(
    () => sources.filter(s => (s.consecutive_failures || 0) >= 3),
    [sources]
  )

  return { filings, sources, sectors, tickers, formTypes, failingSources, loading, lastUpdate }
}
