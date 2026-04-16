import { useState, useEffect, useMemo } from 'react'
import { authFetch } from './apiClient'

export function useDocsFeed() {
  const [documents, setDocuments] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const raw = await authFetch('/docs/feed?limit=100')
        if (!cancelled) setDocuments(raw || [])
      } catch (err) {
        console.warn('[useDocsFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
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
