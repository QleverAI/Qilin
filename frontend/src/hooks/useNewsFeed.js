import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from './apiClient'

export function useNewsFeed() {
  const [articles,   setArticles]   = useState([])
  const [sources,    setSources]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawArticles, rawSources] = await Promise.all([
          apiFetch('/api/news/feed?limit=100'),
          apiFetch('/api/news/sources'),
        ])
        if (cancelled) return
        setArticles(rawArticles || [])
        setSources(rawSources  || [])
        setLastUpdate(new Date())
      } catch (err) {
        console.warn('[useNewsFeed] fetch failed:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Valores derivados para los filtros del sidebar
  const countries   = useMemo(() => [...new Set(sources.map(s => s.country))].sort(),   [sources])
  const sourceTypes = useMemo(() => [...new Set(sources.map(s => s.type))].sort(),      [sources])
  const zones       = useMemo(() => [...new Set(sources.map(s => s.zone).filter(z => z !== 'global'))].sort(), [sources])
  const sectors     = useMemo(() => {
    const all = sources.flatMap(s => s.sectors || [])
    return [...new Set(all)].sort()
  }, [sources])

  return { articles, sources, countries, sourceTypes, zones, sectors, loading, lastUpdate }
}
