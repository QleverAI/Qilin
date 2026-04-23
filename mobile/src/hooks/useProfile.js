import { useState, useEffect } from 'react'
import { authFetch } from './apiClient'

// /me es user-specific: no pasa por feedCache (no es user-agnostic). Mantenemos
// un cache en memoria simple del perfil del usuario actual para evitar re-fetch
// al navegar entre Perfil y otra pantalla.
let _profileCache = null

export function clearProfileCache() {
  _profileCache = null
}

export function useProfile() {
  const [profile, setProfile] = useState(_profileCache)
  const [loading, setLoading] = useState(!_profileCache)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchMe() {
      try {
        const data = await authFetch('/me')
        if (!cancelled) {
          _profileCache = data
          setProfile(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!_profileCache) fetchMe()
    return () => { cancelled = true }
  }, [])

  return { profile, loading, error }
}
