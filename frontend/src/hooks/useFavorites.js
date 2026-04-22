import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from './apiClient'

export function useFavorites() {
  const [favorites, setFavorites] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    apiFetch('/api/favorites')
      .then(data => setFavorites(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isFavorite = useCallback((icao24) => {
    if (!icao24) return false
    return favorites.some(f => f.icao24 === icao24.toLowerCase())
  }, [favorites])

  const toggleFavorite = useCallback(async (aircraft) => {
    const icao24   = (aircraft.id || aircraft.icao24 || '').toLowerCase()
    const callsign = aircraft.label || aircraft.callsign || icao24
    if (!icao24) return

    const already = favorites.some(f => f.icao24 === icao24)

    if (already) {
      // Optimistic remove
      setFavorites(prev => prev.filter(f => f.icao24 !== icao24))
      try {
        await apiFetch(`/api/favorites/${icao24}`, { method: 'DELETE' })
      } catch {
        // Revert
        setFavorites(prev => [...prev, { icao24, callsign, added_at: new Date().toISOString() }])
      }
    } else {
      // Optimistic add
      const entry = { icao24, callsign, added_at: new Date().toISOString() }
      setFavorites(prev => [entry, ...prev])
      try {
        await apiFetch(`/api/favorites/${icao24}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callsign }),
        })
      } catch {
        // Revert
        setFavorites(prev => prev.filter(f => f.icao24 !== icao24))
      }
    }
  }, [favorites])

  return { favorites, loading, isFavorite, toggleFavorite }
}
