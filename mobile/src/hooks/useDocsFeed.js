import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const FEED_PATH = '/docs/feed?limit=100'

export function useDocsFeed() {
  const cached = getCached(FEED_PATH)

  const [documents, setDocuments] = useState(cached || [])
  const [loading,   setLoading]   = useState(!cached)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const raw = await fetchWithCache(FEED_PATH)
        if (!cancelled) setDocuments(raw || [])
      } catch (err) {
        console.warn('[useDocsFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!cached) {
      hydrateFromStorage(FEED_PATH).then(data => {
        if (data && !cancelled) {
          setDocuments(data)
          setLoading(false)
        }
      })
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const orgTypes = useMemo(
    () => [...new Set(documents.map(d => d.org_type).filter(Boolean))].sort(),
    [documents]
  )

  return { documents, orgTypes, loading }
}

export function prefetchDocsFeed() {
  prefetch(FEED_PATH)
}
