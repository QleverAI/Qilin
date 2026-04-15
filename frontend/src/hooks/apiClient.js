/**
 * Cliente API compartido para los hooks de Qilin.
 * Centraliza la configuración de fetch, autenticación y headers.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function authHeaders() {
  const token = sessionStorage.getItem('qilin_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function getApiBase() {
  return API_BASE
}
