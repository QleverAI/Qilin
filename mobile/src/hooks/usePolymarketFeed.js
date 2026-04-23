import { useState, useEffect } from 'react'
import { authFetch } from './apiClient'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const FEED_PATH     = '/polymarket/feed'
const ANALYSIS_PATH = '/polymarket/analysis'

export function usePolymarketFeed() {
  const cached = getCached(FEED_PATH)

  const [markets,    setMarkets]    = useState(cached || [])
  const [analysis,   setAnalysis]   = useState(null)
  const [loading,    setLoading]    = useState(!cached)
  const [analysisLoading, setAnalysisLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchMarkets() {
      try {
        const data = await fetchWithCache(FEED_PATH)
        if (!cancelled) setMarkets(data || [])
      } catch (err) {
        console.warn('[usePolymarketFeed] markets', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function fetchAnalysis() {
      try {
        // /polymarket/analysis NO está cacheada (LLM output con timestamp propio).
        const data = await authFetch(ANALYSIS_PATH)
        if (!cancelled) setAnalysis(data)
      } catch (err) {
        console.warn('[usePolymarketFeed] analysis', err.message)
      } finally {
        if (!cancelled) setAnalysisLoading(false)
      }
    }

    if (!cached) {
      hydrateFromStorage(FEED_PATH).then(data => {
        if (!cancelled && data) { setMarkets(data); setLoading(false) }
      })
    }

    fetchMarkets()
    fetchAnalysis()
    const interval = setInterval(fetchMarkets, 120_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { markets, analysis, loading, analysisLoading }
}

export function prefetchPolymarket() {
  prefetch(FEED_PATH)
}
