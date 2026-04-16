import { useState, useEffect, useMemo } from 'react'
import { authFetch } from './apiClient'

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
  const [filings,  setFilings]  = useState([])
  const [sources,  setSources]  = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [filingsResult, sourcesResult] = await Promise.allSettled([
          authFetch('/sec/feed?limit=100'),
          authFetch('/sec/sources'),
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
