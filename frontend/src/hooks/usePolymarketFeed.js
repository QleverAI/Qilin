import { useState, useEffect } from 'react'
import { apiFetch } from './apiClient'

export function usePolymarketFeed() {
  const [markets,   setMarkets]   = useState([])
  const [analysis,  setAnalysis]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [analysisLoading, setAnalysisLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchMarkets() {
      try {
        const data = await apiFetch('/api/polymarket/feed')
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
        const data = await apiFetch('/api/polymarket/analysis')
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
