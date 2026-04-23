/**
 * Cache compartida para hooks de feeds (capa 4).
 *
 *   1) `memCache` sobrevive al desmontar/montar de la página dentro de la SPA.
 *   2) `localStorage` sobrevive a F5/recarga hasta `STORAGE_TTL_MS`.
 *   3) `inflight` deduplica peticiones concurrentes al mismo URL (p.ej. cuando
 *      el prefetch de AppShell y el useEffect del hook disparan a la vez).
 *
 * El servidor ya devuelve `Cache-Control: private, max-age=N` + `ETag` (capa 3),
 * así que los refresh periódicos son baratos: o son 304 o viajan gzipeados.
 */
import { apiFetch } from './apiClient'

const STORAGE_TTL_MS = 5 * 60 * 1000   // 5 minutos antes de descartar persistido
const STORAGE_PREFIX = 'qilin:cache:'

const memCache = new Map()    // url → data (siempre fresca dentro de la SPA)
const inflight = new Map()    // url → Promise (para deduplicar)

function storageKey(url) {
  return `${STORAGE_PREFIX}${url}`
}

export function readPersisted(url) {
  try {
    const raw = localStorage.getItem(storageKey(url))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > STORAGE_TTL_MS) return null
    return data
  } catch {
    return null
  }
}

function writePersisted(url, data) {
  try {
    localStorage.setItem(storageKey(url), JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // QuotaExceeded u otras → ignorar, seguimos teniendo memCache
  }
}

/** Devuelve el dato cacheado (memoria → localStorage), o `null` si no hay. */
export function getCached(url) {
  if (memCache.has(url)) return memCache.get(url)
  return readPersisted(url)
}

/** Escribe en memCache y localStorage. Usar solo desde el propio módulo. */
function setCached(url, data) {
  memCache.set(url, data)
  writePersisted(url, data)
}

/**
 * Fetch con dedupe por URL. Varias llamadas concurrentes al mismo URL
 * comparten la misma petición en vuelo. Al resolver, actualiza memCache +
 * localStorage.
 */
export function fetchWithCache(url) {
  if (inflight.has(url)) return inflight.get(url)
  const p = apiFetch(url)
    .then(data => {
      setCached(url, data)
      return data
    })
    .finally(() => { inflight.delete(url) })
  inflight.set(url, p)
  return p
}

/**
 * Precalentamiento: lanza el fetch sin esperar, ignora errores.
 * Si ya hay cache válida o una petición en curso, no hace nada.
 * Seguro de llamar múltiples veces.
 */
export function prefetch(url) {
  if (memCache.has(url)) return
  if (inflight.has(url)) return
  fetchWithCache(url).catch(() => { /* noop — los hooks lo reintentarán */ })
}

/** Borra toda la cache (memoria + localStorage) — usar tras logout. */
export function clearFeedCache() {
  memCache.clear()
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch { /* noop */ }
}
