import { useState, useEffect } from 'react'
import { apiFetch } from './apiClient'

export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    apiFetch('/api/me')
      .then(data => setProfile(data))
      .catch(() => setError('No se pudieron cargar los datos de tu cuenta'))
      .finally(() => setLoading(false))
  }, [])

  return { profile, loading, error }
}
