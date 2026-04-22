import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from './apiClient'

const LIMIT = 10

export function useSourceFavorites() {
  const [favorites, setFavorites] = useState({ news: [], social: [], docs: [] })
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    apiFetch('/api/source-favorites')
      .then(data => setFavorites({
        news:   data.news   || [],
        social: data.social || [],
        docs:   data.docs   || [],
      }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isFavorite = useCallback((type, sourceId) => {
    if (!sourceId) return false
    return (favorites[type] || []).some(f => f.source_id === sourceId)
  }, [favorites])

  const canAddMore = useCallback((type) => {
    return (favorites[type] || []).length < LIMIT
  }, [favorites])

  const toggleFavorite = useCallback(async (type, sourceId, sourceName) => {
    if (!sourceId || !type) return
    const already = (favorites[type] || []).some(f => f.source_id === sourceId)

    if (already) {
      setFavorites(prev => ({
        ...prev,
        [type]: prev[type].filter(f => f.source_id !== sourceId),
      }))
      try {
        await apiFetch(`/api/source-favorites/${type}/${encodeURIComponent(sourceId)}`, { method: 'DELETE' })
      } catch {
        setFavorites(prev => ({
          ...prev,
          [type]: [...prev[type], { source_id: sourceId, source_name: sourceName, added_at: new Date().toISOString() }],
        }))
      }
    } else {
      if ((favorites[type] || []).length >= LIMIT) return
      const entry = { source_id: sourceId, source_name: sourceName, added_at: new Date().toISOString() }
      setFavorites(prev => ({ ...prev, [type]: [entry, ...prev[type]] }))
      try {
        await apiFetch(`/api/source-favorites/${type}/${encodeURIComponent(sourceId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_name: sourceName }),
        })
      } catch {
        setFavorites(prev => ({
          ...prev,
          [type]: prev[type].filter(f => f.source_id !== sourceId),
        }))
      }
    }
  }, [favorites])

  return { favorites, loading, isFavorite, canAddMore, toggleFavorite }
}
