import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import es from '../i18n/es'
import en from '../i18n/en'

const DICT = { es, en }
const STORAGE_KEY = 'qilin_lang'
const DEFAULT_LANG = 'es'

const LanguageContext = createContext(null)

let _asyncStorage = null
let _asyncStorageLoaded = false
function getStorage() {
  if (_asyncStorageLoaded) return _asyncStorage
  _asyncStorageLoaded = true
  try {
    _asyncStorage = require('@react-native-async-storage/async-storage').default
  } catch (_) {
    _asyncStorage = null
  }
  return _asyncStorage
}

function resolveKey(dict, path) {
  const segs = path.split('.')
  let node = dict
  for (const s of segs) {
    if (node == null) return null
    node = node[s]
  }
  return node
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(DEFAULT_LANG)
  const [ready, setReady] = useState(false)

  // Hidratar idioma persistido al montar
  useEffect(() => {
    let cancelled = false
    const storage = getStorage()
    if (!storage) { setReady(true); return }
    storage.getItem(STORAGE_KEY)
      .then(saved => {
        if (!cancelled && saved && DICT[saved]) setLang(saved)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])

  const switchLang = useCallback((next) => {
    if (!DICT[next]) return
    setLang(next)
    const storage = getStorage()
    if (storage) storage.setItem(STORAGE_KEY, next).catch(() => {})
  }, [])

  const t = useCallback((key, params) => {
    const dict = DICT[lang] || DICT[DEFAULT_LANG]
    const fallback = DICT[DEFAULT_LANG]
    const val = resolveKey(dict, key) ?? resolveKey(fallback, key)
    if (val == null) return key
    if (typeof val === 'function') {
      try { return val(params || {}) } catch { return key }
    }
    return val
  }, [lang])

  const value = { lang, switchLang, t, ready }
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
