import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, prefetch } from './feedCache'

const FEED_URL    = '/api/docs/feed?limit=100'
const SOURCES_URL = '/api/docs/sources'

export function useDocsFeed() {
  const cachedDocs    = getCached(FEED_URL)
  const cachedSources = getCached(SOURCES_URL)

  const [docs,       setDocs]       = useState(cachedDocs    || [])
  const [sources,    setSources]    = useState(cachedSources || [])
  const [loading,    setLoading]    = useState(!(cachedDocs && cachedSources))
  const [lastUpdate, setLastUpdate] = useState(cachedDocs ? new Date() : null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawDocs, rawSources] = await Promise.all([
          fetchWithCache(FEED_URL),
          fetchWithCache(SOURCES_URL),
        ])
        if (cancelled) return
        setDocs(rawDocs     || [])
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

  const orgTypes  = useMemo(() => [...new Set(sources.map(s => s.org_type))].sort(), [sources])
  const countries = useMemo(() => [...new Set(sources.map(s => s.country))].sort(),  [sources])
  const sectors   = useMemo(() => {
    const all = sources.flatMap(s => s.sectors || [])
    return [...new Set(all)].sort()
  }, [sources])

  const failingSources = useMemo(
    () => sources.filter(s => (s.consecutive_failures || 0) >= 3),
    [sources]
  )

  return { docs, sources, orgTypes, countries, sectors, failingSources, loading, lastUpdate }
}

export function prefetchDocsFeed() {
  prefetch(FEED_URL)
  prefetch(SOURCES_URL)
}
