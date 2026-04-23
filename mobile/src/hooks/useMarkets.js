import { useState, useEffect, useMemo } from 'react'
import { authFetch } from './apiClient'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const QUOTES_PATH = '/markets/quotes'

export function useMarkets() {
  const cached = getCached(QUOTES_PATH)

  const [quotes,  setQuotes]  = useState(cached || [])
  const [loading, setLoading] = useState(!cached)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchQuotes() {
      try {
        const data = await fetchWithCache(QUOTES_PATH)
        if (!cancelled) {
          setQuotes(data || [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!cached) {
      hydrateFromStorage(QUOTES_PATH).then(data => {
        if (!cancelled && data) {
          setQuotes(data)
          setLoading(false)
        }
      })
    }

    fetchQuotes()
    const interval = setInterval(fetchQuotes, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Agrupar por "group" para la UI
  const groups = useMemo(() => {
    const byGroup = new Map()
    for (const q of quotes) {
      const g = q.group || 'Otros'
      if (!byGroup.has(g)) byGroup.set(g, [])
      byGroup.get(g).push(q)
    }
    return [...byGroup.entries()].map(([name, items]) => ({ name, items }))
  }, [quotes])

  async function fetchHistory(symbol, period = '1mo') {
    const data = await authFetch(`/markets/history?symbol=${encodeURIComponent(symbol)}&period=${period}`)
    return data || []
  }

  return { quotes, groups, loading, error, fetchHistory }
}

export function prefetchMarkets() {
  prefetch(QUOTES_PATH)
}
