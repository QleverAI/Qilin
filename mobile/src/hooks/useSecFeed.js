import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, hydrateFromStorage, prefetch } from './feedCache'

const FEED_PATH    = '/sec/feed?limit=100'
const SOURCES_PATH = '/sec/sources'

const SECTOR_COLOR = {
  defense:        'rgba(255,59,74,0.9)',
  energy:         'rgba(255,140,0,0.9)',
  semiconductors: 'rgba(0,200,255,0.9)',
  financials:     'rgba(0,229,160,0.9)',
  cyber_infra:    'rgba(130,80,255,0.9)',
}

const SECTOR_LABEL = {
  defense:        'Defensa',
  energy:         'Energía',
  semiconductors: 'Semicon.',
  financials:     'Finanzas',
  cyber_infra:    'Ciber/Infra',
}

export { SECTOR_COLOR, SECTOR_LABEL }

export function useSecFeed() {
  const cachedFilings = getCached(FEED_PATH)
  const cachedSources = getCached(SOURCES_PATH)

  const [filings, setFilings] = useState(cachedFilings || [])
  const [sources, setSources] = useState(cachedSources || [])
  const [loading, setLoading] = useState(!(cachedFilings && cachedSources))

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [filingsResult, sourcesResult] = await Promise.allSettled([
          fetchWithCache(FEED_PATH),
          fetchWithCache(SOURCES_PATH),
        ])
        if (!cancelled) {
          if (filingsResult.status === 'fulfilled') setFilings(filingsResult.value || [])
          if (sourcesResult.status === 'fulfilled') setSources(sourcesResult.value || [])
        }
      } catch (err) {
        console.warn('[useSecFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!cachedFilings) {
      hydrateFromStorage(FEED_PATH).then(data => {
        if (data && !cancelled) setFilings(data)
      })
    }
    if (!cachedSources) {
      hydrateFromStorage(SOURCES_PATH).then(data => {
        if (data && !cancelled) setSources(data)
      })
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const sectors = useMemo(
    () => [...new Set(filings.map(f => f.sector).filter(Boolean))].sort(),
    [filings]
  )

  const failingSources = useMemo(
    () => sources.filter(s => (s.consecutive_failures || 0) >= 3),
    [sources]
  )

  return { filings, sources, sectors, failingSources, loading }
}

export function prefetchSecFeed() {
  prefetch(FEED_PATH)
  prefetch(SOURCES_PATH)
}
