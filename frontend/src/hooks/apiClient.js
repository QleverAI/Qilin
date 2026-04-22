/**
 * Cliente API compartido para los hooks de Qilin.
 * Centraliza la configuración de fetch, autenticación y headers.
 */

// En dev (sin VITE_API_URL) usamos URL relativa para que el proxy de Vite
// reescriba /api/* → http://localhost:8000/*. En producción se usa VITE_API_URL.
const API_BASE = import.meta.env.VITE_API_URL || ''

export function authHeaders() {
  const token = sessionStorage.getItem('qilin_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: { ...authHeaders(), ...extraHeaders },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function getApiBase() {
  return API_BASE
}

export async function apiFetchPublic(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
