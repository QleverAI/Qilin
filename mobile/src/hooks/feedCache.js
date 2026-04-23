/**
 * Cache compartida para los hooks de feeds en móvil — equivalente al
 * frontend/src/hooks/feedCache.js de la web pero usando AsyncStorage en vez
 * de localStorage.
 *
 *   1) `memCache` sobrevive al desmontar pantallas (las tabs se montan/desmontan
 *      cuando cambias de pestaña).
 *   2) `AsyncStorage` sobrevive al cierre de la app hasta `STORAGE_TTL_MS`.
 *   3) `inflight` deduplica peticiones concurrentes al mismo path (cuando
 *      el prefetch del layout y el useEffect de la pantalla disparan a la vez).
 *
 * El servidor ya devuelve `Cache-Control: private, max-age=N` + `ETag` (capa 3
 * de la web), así que los refresh periódicos son baratos en el dispositivo.
 */
import { authFetch } from './apiClient'

const STORAGE_TTL_MS = 5 * 60 * 1000   // 5 minutos antes de descartar persistido
const STORAGE_PREFIX = 'qilin:cache:'

const memCache = new Map()   // path → data
const inflight = new Map()   // path → Promise

// AsyncStorage se carga perezosamente: si el bundle no lo tiene (o estamos en
// jest sin mock), el cache funciona igual pero sin persistencia.
let _asyncStorage = null
let _asyncStorageLoaded = false

function getAsyncStorage() {
  if (_asyncStorageLoaded) return _asyncStorage
  _asyncStorageLoaded = true
  try {
    _asyncStorage = require('@react-native-async-storage/async-storage').default
  } catch (_) {
    _asyncStorage = null
  }
  return _asyncStorage
}

function storageKey(path) {
  return `${STORAGE_PREFIX}${path}`
}

export async function readPersisted(path) {
  const storage = getAsyncStorage()
  if (!storage) return null
  try {
    const raw = await storage.getItem(storageKey(path))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > STORAGE_TTL_MS) return null
    return data
  } catch {
    return null
  }
}

async function writePersisted(path, data) {
  const storage = getAsyncStorage()
  if (!storage) return
  try {
    await storage.setItem(storageKey(path), JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // Quota u otro error → seguimos con memCache
  }
}

/**
 * Lee del memCache si existe. `null` si no. (La lectura de AsyncStorage es
 * asíncrona — usa `hydrateFromStorage(path)` para precalentar memCache desde
 * disco antes del primer render si quieres pintura sin spinner en cold start.)
 */
export function getCached(path) {
  return memCache.has(path) ? memCache.get(path) : null
}

/**
 * Lee AsyncStorage y, si hay dato válido, lo mete en memCache. Devuelve el
 * dato o `null`. Llamar al montar la pantalla si no hay memCache aún.
 */
export async function hydrateFromStorage(path) {
  if (memCache.has(path)) return memCache.get(path)
  const data = await readPersisted(path)
  if (data !== null) memCache.set(path, data)
  return data
}

function setCached(path, data) {
  memCache.set(path, data)
  // Fire-and-forget: no queremos bloquear al caller en la E/S del disco.
  writePersisted(path, data).catch(() => {})
}

/**
 * Fetch con dedupe por path. Varias llamadas concurrentes comparten la misma
 * petición en vuelo. Al resolver, actualiza memCache + AsyncStorage.
 */
export function fetchWithCache(path) {
  if (inflight.has(path)) return inflight.get(path)
  const p = authFetch(path)
    .then(data => {
      setCached(path, data)
      return data
    })
    .finally(() => { inflight.delete(path) })
  inflight.set(path, p)
  return p
}

/**
 * Precalentamiento: lanza el fetch sin esperar, ignora errores. Si ya hay
 * memCache o una petición en curso, no hace nada. Seguro de llamar múltiples
 * veces (p.ej. cada vez que se monta el tabs layout).
 */
export function prefetch(path) {
  if (memCache.has(path)) return
  if (inflight.has(path)) return
  fetchWithCache(path).catch(() => { /* noop — los hooks reintentarán */ })
}

/** Borra toda la cache (memoria + AsyncStorage). Uso: logout. */
export async function clearFeedCache() {
  memCache.clear()
  inflight.clear()
  const storage = getAsyncStorage()
  if (!storage) return
  try {
    const keys = await storage.getAllKeys()
    const ours = keys.filter(k => k.startsWith(STORAGE_PREFIX))
    if (ours.length) await storage.multiRemove(ours)
  } catch {
    // noop
  }
}
