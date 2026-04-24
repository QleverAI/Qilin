import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const SPEND_PATH = '/intel/spend'

function buildTimelinePath({ hours, minScore, domain, topicsOnly }) {
  let url = `/intel/timeline?hours=${hours}&min_score=${minScore}&domain=${domain}`
  if (topicsOnly) url += '&topics_only=true'
  return url
}

export function useIntelTimeline({ hours = 48, minScore = 0, domain = 'all', topicsOnly = false } = {}) {
  const timelinePath = useMemo(
    () => buildTimelinePath({ hours, minScore, domain, topicsOnly }),
    [hours, minScore, domain, topicsOnly]
  )

  const cachedTimeline = getCached(timelinePath)
  const cachedSpend    = getCached(SPEND_PATH)

  const [items,   setItems]   = useState(() => cachedTimeline?.items || [])
  const [loading, setLoading] = useState(!cachedTimeline)
  const [error,   setError]   = useState(null)
  const [spend,   setSpend]   = useState(() => cachedSpend || { spent_usd: 0, cap_usd: 5 })

  const fetchAll = useCallback(async () => {
    try {
      const [tl, sp] = await Promise.all([
        fetchWithCache(timelinePath),
        fetchWithCache(SPEND_PATH).catch(() => ({ spent_usd: 0, cap_usd: 5 })),
      ])
      setItems(tl?.items || [])
      setSpend(sp || { spent_usd: 0, cap_usd: 5 })
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [timelinePath])

  useEffect(() => {
    let cancelled = false
    const cached = getCached(timelinePath)
    if (!cached) {
      setItems([])
      setLoading(true)
      hydrateFromStorage(timelinePath).then(data => {
        if (!cancelled && data) {
          setItems(data.items || [])
          setLoading(false)
        }
      })
    }
    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [fetchAll, timelinePath])

  return { items, loading, error, spend, refresh: fetchAll }
}

export function prefetchIntelTimeline({ hours = 48, minScore = 0, domain = 'all' } = {}) {
  prefetch(buildTimelinePath({ hours, minScore, domain, topicsOnly: false }))
  prefetch(SPEND_PATH)
}
