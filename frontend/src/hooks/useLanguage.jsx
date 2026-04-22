import { createContext, useContext, useState, useCallback } from 'react'
import { es } from '../i18n/es'
import { en } from '../i18n/en'

const DICTS = { es, en }

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('qilin_lang') || 'es')

  const switchLang = useCallback(l => {
    setLang(l)
    localStorage.setItem('qilin_lang', l)
  }, [])

  const t = useCallback((key, vars) => {
    const dict = DICTS[lang] || DICTS.es
    let str = dict[key] ?? key
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v))
      })
    }
    return str
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
