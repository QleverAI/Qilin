import { useState, useEffect, useMemo } from 'react'
import { authFetch } from './apiClient'

export function useNewsFeed() {
  const [articles, setArticles] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const raw = await authFetch('/news/feed?limit=100')
        if (!cancelled) setArticles(raw || [])
      } catch (err) {
        console.warn('[useNewsFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
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
