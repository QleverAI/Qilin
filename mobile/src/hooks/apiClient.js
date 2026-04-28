import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'

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

// Prepend /api/ for paths that go through nginx proxy.
// Paths starting with /auth/ or already with /api/ are left as-is.
function resolvedPath(path) {
  if (path.startsWith('/api/') || path.startsWith('/auth/')) return path
  return `/api${path}`
}

export async function clearToken() {
  _token = null
  SecureStore.deleteItemAsync('qilin_token').catch(() => {})
}

export async function authFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
  }
  const res = await fetch(`${API_BASE}${resolvedPath(path)}`, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    try { router.replace('/landing') } catch (_) {}
    throw new Error('HTTP 401')
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
