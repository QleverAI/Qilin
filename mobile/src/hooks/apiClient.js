import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

let _token = null

export async function loadToken() {
  try {
    _token = await SecureStore.getItemAsync('qilin_token')
  } catch (err) {
    console.warn('[apiClient] loadToken failed:', err)
  }
}

export function setToken(token) {
  _token = token
  SecureStore.setItemAsync('qilin_token', token).catch(err =>
    console.warn('[apiClient] SecureStore persist failed:', err)
  )
}

export function getToken() {
  return _token
}

export async function authFetch(path) {
  const headers = _token ? { Authorization: `Bearer ${_token}` } : {}
  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
