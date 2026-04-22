import { useState, useEffect, useCallback } from 'react'
import { apiFetch, authHeaders, getApiBase } from './apiClient'

let _cache = null

export function clearVesselFavoritesCache() {
  _cache = null
}

export function useVesselFavorites() {
  const [favorites, setFavorites] = useState(_cache || [])
  const [loading,   setLoading]   = useState(!_cache)

  useEffect(() => {
    if (_cache) return
    apiFetch('/api/vessel-favorites')
      .then(data => {
        _cache = data || []
        setFavorites(_cache)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isFavorite = useCallback(
    (mmsi) => favorites.some(f => f.mmsi === mmsi),
    [favorites]
  )

  const toggleFavorite = useCallback(async (vessel) => {
    const mmsi = vessel.mmsi || vessel.id
    if (isFavorite(mmsi)) {
      await fetch(`${getApiBase()}/api/vessel-favorites/${mmsi}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      _cache = (_cache || []).filter(f => f.mmsi !== mmsi)
    } else {
      await fetch(`${getApiBase()}/api/vessel-favorites`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ mmsi, name: vessel.name || null }),
      })
      _cache = [...(_cache || []), { mmsi, name: vessel.name || null }]
    }
    setFavorites([..._cache])
  }, [isFavorite])

  return { favorites, loading, isFavorite, toggleFavorite }
}
