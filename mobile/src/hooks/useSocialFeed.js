import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const FEED_PATH = '/social/feed?limit=100'

export function useSocialFeed() {
  const cached = getCached(FEED_PATH)

  const [posts,   setPosts]   = useState(cached || [])
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const raw = await fetchWithCache(FEED_PATH)
        if (!cancelled) setPosts(raw || [])
      } catch (err) {
        console.warn('[useSocialFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!cached) {
      hydrateFromStorage(FEED_PATH).then(data => {
        if (data && !cancelled) {
          setPosts(data)
          setLoading(false)
        }
      })
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const zones = useMemo(
    () => [...new Set(posts.map(p => p.zone).filter(Boolean))].sort(),
    [posts]
  )

  const categories = useMemo(
    () => [...new Set(posts.map(p => p.category).filter(Boolean))].sort(),
    [posts]
  )

  return { posts, zones, categories, loading }
}

export function prefetchSocialFeed() {
  prefetch(FEED_PATH)
}
