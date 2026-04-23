import { useEffect, useState, useCallback, useMemo } from 'react'
import { fetchWithCache, getCached, prefetch } from './feedCache'

const SPEND_URL = '/api/intel/spend'

function buildTimelineUrl({ hours, minScore, domain }) {
  return `/api/intel/timeline?hours=${hours}&min_score=${minScore}&domain=${domain}`
}

export function useIntelTimeline({ hours = 48, minScore = 0, domain = 'all' } = {}) {
  const timelineUrl = useMemo(
    () => buildTimelineUrl({ hours, minScore, domain }),
    [hours, minScore, domain]
  )

  const cachedTimeline = getCached(timelineUrl)
  const cachedSpend    = getCached(SPEND_URL)

  const [items,   setItems]   = useState(() => cachedTimeline?.items || [])
  const [loading, setLoading] = useState(!cachedTimeline)
  const [error,   setError]   = useState(null)
  const [spend,   setSpend]   = useState(() => cachedSpend || { spent_usd: 0, cap_usd: 5 })

  const fetchAll = useCallback(async () => {
    try {
      const [tl, sp] = await Promise.all([
        fetchWithCache(timelineUrl),
        fetchWithCache(SPEND_URL).catch(() => ({ spent_usd: 0, cap_usd: 5 })),
      ])
      setItems(tl?.items || [])
      setSpend(sp || { spent_usd: 0, cap_usd: 5 })
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [timelineUrl])

  useEffect(() => { fetchAll() }, [fetchAll])

  // WebSocket live prepend (lo invoca el consumidor al recibir mensajes)
  const addLiveItem = useCallback((msg) => {
    if (!msg || msg.kind !== 'intel') return
    try {
      const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload
      const item = msg.type === 'master'
        ? {
            type: 'master',
            time: new Date().toISOString(),
            cycle_id: msg.cycle_id,
            ...payload,
          }
        : {
            type: 'finding',
            time: new Date().toISOString(),
            cycle_id: msg.cycle_id,
            agent_name: msg.agent_name,
            anomaly_score: parseInt(msg.anomaly_score || '0', 10),
            summary: payload.summary || '',
            raw_output: payload,
          }
      setItems(prev => [item, ...prev].slice(0, 800))
    } catch (_) { /* noop */ }
  }, [])

  return { items, loading, error, spend, refresh: fetchAll, addLiveItem }
}

export function prefetchIntelTimeline({ hours = 48, minScore = 0, domain = 'all' } = {}) {
  prefetch(buildTimelineUrl({ hours, minScore, domain }))
  prefetch(SPEND_URL)
}
