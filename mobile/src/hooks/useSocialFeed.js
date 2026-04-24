import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const BASE_PATH = '/social/feed?limit=100'

function buildPath(topicsOnly) {
  return topicsOnly ? `${BASE_PATH}&topics_only=true` : BASE_PATH
}

export function useSocialFeed({ topicsOnly = false } = {}) {
  const feedPath = useMemo(() => buildPath(topicsOnly), [topicsOnly])

  const [posts,   setPosts]   = useState(() => getCached(feedPath) || [])
  const [loading, setLoading] = useState(() => !getCached(feedPath))

  useEffect(() => {
    let cancelled = false
    const cached = getCached(feedPath)
    if (cached) {
      setPosts(cached)
      setLoading(false)
    } else {
      setPosts([])
      setLoading(true)
    }

    async function fetchAll() {
      try {
        const raw = await fetchWithCache(feedPath)
        if (!cancelled) setPosts(raw || [])
      } catch (err) {
        console.warn('[useSocialFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!cached) {
      hydrateFromStorage(feedPath).then(data => {
        if (data && !cancelled) {
          setPosts(data)
          setLoading(false)
        }
      })
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [feedPath])

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
  prefetch(BASE_PATH)
}
