import { useState, useEffect, useMemo } from 'react'
import { authFetch } from './apiClient'

export function useSocialFeed() {
  const [posts,   setPosts]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const raw = await authFetch('/social/feed?limit=100')
        if (!cancelled) setPosts(raw || [])
      } catch (err) {
        console.warn('[useSocialFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
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
