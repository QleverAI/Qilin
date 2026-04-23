import { useState, useEffect } from 'react'
import { apiFetch } from './apiClient'
import { fetchWithCache, getCached, prefetch } from './feedCache'

const FEED_URL     = '/api/polymarket/feed'
const ANALYSIS_URL = '/api/polymarket/analysis'

export function usePolymarketFeed() {
  const cachedMarkets = getCached(FEED_URL)

  const [markets,    setMarkets]    = useState(cachedMarkets || [])
  const [analysis,   setAnalysis]   = useState(null)
  const [loading,    setLoading]    = useState(!cachedMarkets)
  const [analysisLoading, setAnalysisLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(cachedMarkets ? new Date() : null)

  useEffect(() => {
    let cancelled = false

    async function fetchMarkets() {
      try {
        const data = await fetchWithCache(FEED_URL)
        if (!cancelled) {
          setMarkets(data || [])
          setLastUpdate(new Date())
        }
      } catch (err) {
        console.warn('[usePolymarketFeed] markets fetch failed:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function fetchAnalysis() {
      try {
        // /polymarket/analysis NO está cacheada globalmente (LLM + marca propia
        // de tiempo). La dejamos con apiFetch directo.
        const data = await apiFetch(ANALYSIS_URL)
        if (!cancelled) setAnalysis(data)
      } catch (err) {
        console.warn('[usePolymarketFeed] analysis fetch failed:', err.message)
      } finally {
        if (!cancelled) setAnalysisLoading(false)
      }
    }

    fetchMarkets()
    fetchAnalysis()
    const interval = setInterval(fetchMarkets, 120_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { markets, analysis, loading, analysisLoading, lastUpdate }
}

export function prefetchPolymarket() {
  prefetch(FEED_URL)
}
