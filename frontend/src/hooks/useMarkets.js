import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from './apiClient'
import { fetchWithCache, getCached, prefetch } from './feedCache'

const QUOTES_URL = '/api/markets/quotes'

export function useMarkets() {
  const cachedQuotes = getCached(QUOTES_URL)

  const [quotes,  setQuotes]  = useState(cachedQuotes || [])
  const [loading, setLoading] = useState(!cachedQuotes)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchQuotes() {
      try {
        const data = await fetchWithCache(QUOTES_URL)
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

    fetchQuotes()
    const interval = setInterval(fetchQuotes, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const fetchHistory = useCallback(async (symbol, period = '1mo') => {
    const data = await apiFetch(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&period=${period}`)
    return data || []
  }, [])

  return { quotes, loading, error, fetchHistory }
}

export function prefetchMarkets() {
  prefetch(QUOTES_URL)
}
