import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, prefetch } from './feedCache'

const FEED_URL    = '/api/news/feed?limit=1000'
const SOURCES_URL = '/api/news/sources'

export function useNewsFeed() {
  const cachedArticles = getCached(FEED_URL)
  const cachedSources  = getCached(SOURCES_URL)

  const [articles,   setArticles]   = useState(cachedArticles || [])
  const [sources,    setSources]    = useState(cachedSources  || [])
  const [loading,    setLoading]    = useState(!(cachedArticles && cachedSources))
  const [lastUpdate, setLastUpdate] = useState(cachedArticles ? new Date() : null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawArticles, rawSources] = await Promise.all([
          fetchWithCache(FEED_URL),
          fetchWithCache(SOURCES_URL),
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

  const countries   = useMemo(() => [...new Set(sources.map(s => s.country))].sort(),   [sources])
  const sourceTypes = useMemo(() => [...new Set(sources.map(s => s.type))].sort(),      [sources])
  const zones       = useMemo(() => [...new Set(sources.map(s => s.zone).filter(z => z !== 'global'))].sort(), [sources])
  const sectors     = useMemo(() => {
    const all = sources.flatMap(s => s.sectors || [])
    return [...new Set(all)].sort()
  }, [sources])

  return { articles, sources, countries, sourceTypes, zones, sectors, loading, lastUpdate }
}

export function prefetchNewsFeed() {
  prefetch(FEED_URL)
  prefetch(SOURCES_URL)
}
