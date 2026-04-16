import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from './apiClient'

export function useDocsFeed() {
  const [docs,       setDocs]       = useState([])
  const [sources,    setSources]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawDocs, rawSources] = await Promise.all([
          apiFetch('/api/docs/feed?limit=100'),
          apiFetch('/api/docs/sources'),
        ])
        if (cancelled) return
        setDocs(rawDocs      || [])
        setSources(rawSources || [])
        setLastUpdate(new Date())
      } catch (err) {
        console.warn('[useDocsFeed] fetch failed:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Valores derivados para filtros
  const orgTypes  = useMemo(() => [...new Set(sources.map(s => s.org_type))].sort(),    [sources])
  const countries = useMemo(() => [...new Set(sources.map(s => s.country))].sort(),     [sources])
  const sectors   = useMemo(() => {
    const all = sources.flatMap(s => s.sectors || [])
    return [...new Set(all)].sort()
  }, [sources])

  // Fuentes con fallos consecutivos >= 3
  const failingSources = useMemo(
    () => sources.filter(s => (s.consecutive_failures || 0) >= 3),
    [sources]
  )

  return { docs, sources, orgTypes, countries, sectors, failingSources, loading, lastUpdate }
}
