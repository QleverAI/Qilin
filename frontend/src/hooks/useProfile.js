import { useState, useEffect } from 'react'
import { apiFetch } from './apiClient'

let _cache = null

export function clearProfileCache() {
  _cache = null
}

export function useProfile() {
  const [profile, setProfile] = useState(_cache)
  const [loading, setLoading] = useState(!_cache)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (_cache) return
    apiFetch('/api/me')
      .then(data => { _cache = data; setProfile(data) })
      .catch(() => setError('No se pudieron cargar los datos de tu cuenta'))
      .finally(() => setLoading(false))
  }, [])

  return { profile, loading, error }
}
