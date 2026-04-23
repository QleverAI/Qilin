import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const FEED_PATH = '/news/feed?limit=100'

export function useNewsFeed() {
  const cached = getCached(FEED_PATH)

  const [articles, setArticles] = useState(cached || [])
  const [loading,  setLoading]  = useState(!cached)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const raw = await fetchWithCache(FEED_PATH)
        if (!cancelled) setArticles(raw || [])
      } catch (err) {
        console.warn('[useNewsFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Cold start: si memCache estaba vacía, intenta hidratar desde AsyncStorage
    // para pintar algo antes de que llegue la petición.
    if (!cached) {
      hydrateFromStorage(FEED_PATH).then(data => {
        if (data && !cancelled) {
          setArticles(data)
          setLoading(false)   // hay algo que pintar; el fetch revalidará
        }
      })
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const zones = useMemo(
    () => [...new Set(articles.flatMap(a => a.zones || []))].sort(),
    [articles]
  )

  return { articles, zones, loading }
}

export function prefetchNewsFeed() {
  prefetch(FEED_PATH)
}
