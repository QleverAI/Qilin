import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const BASE_PATH = '/news/feed?limit=100'

function buildPath(topicsOnly) {
  return topicsOnly ? `${BASE_PATH}&topics_only=true` : BASE_PATH
}

export function useNewsFeed({ topicsOnly = false } = {}) {
  const feedPath = useMemo(() => buildPath(topicsOnly), [topicsOnly])

  const [articles, setArticles] = useState(() => getCached(feedPath) || [])
  const [loading,  setLoading]  = useState(() => !getCached(feedPath))

  useEffect(() => {
    let cancelled = false
    const cached = getCached(feedPath)
    if (cached) {
      setArticles(cached)
      setLoading(false)
    } else {
      setArticles([])
      setLoading(true)
    }

    async function fetchAll() {
      try {
        const raw = await fetchWithCache(feedPath)
        if (!cancelled) setArticles(raw || [])
      } catch (err) {
        console.warn('[useNewsFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!cached) {
      hydrateFromStorage(feedPath).then(data => {
        if (data && !cancelled) {
          setArticles(data)
          setLoading(false)
        }
      })
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [feedPath])

  const zones = useMemo(
    () => [...new Set(articles.flatMap(a => a.zones || []))].sort(),
    [articles]
  )

  return { articles, zones, loading }
}

export function prefetchNewsFeed() {
  prefetch(BASE_PATH)
}
