# Mobile Real Data & New Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar la app móvil Expo/React Native a la API real (eliminar todos los mocks), añadir auth con SecureStore, y crear dos nuevas pantallas: MERCADOS (SEC filings) y TÁCTICO (mapa con aeronaves).

**Architecture:** Un singleton `apiClient.js` gestiona el token JWT en memoria (persistido en SecureStore). Cuatro hooks de polling (60s) consumen la API real. Las pantallas existentes se actualizan para usar los hooks reales. Dos pantallas nuevas: `markets.jsx` (FlatList + Modal) y `tactical.jsx` (react-native-maps).

**Tech Stack:** Expo SDK 54, expo-secure-store, react-native-maps, jest-expo, @testing-library/react-native

---

## File Map

**Nuevos:**
- `mobile/src/hooks/apiClient.js` — singleton auth (loadToken, setToken, getToken, authFetch)
- `mobile/src/hooks/useNewsFeed.js`
- `mobile/src/hooks/useDocsFeed.js`
- `mobile/src/hooks/useSocialFeed.js`
- `mobile/src/hooks/useSecFeed.js`
- `mobile/src/app/(tabs)/tactical.jsx`
- `mobile/src/app/(tabs)/markets.jsx`
- `mobile/__tests__/apiClient.test.js`
- `mobile/__tests__/useNewsFeed.test.js`

**Modificados:**
- `mobile/package.json` — añadir dependencias + jest
- `mobile/app.json` — plugin react-native-maps para Android
- `mobile/.env.local` — EXPO_PUBLIC_GOOGLE_MAPS_KEY
- `mobile/src/app/login.jsx` — llamar setToken tras login exitoso
- `mobile/src/app/_layout.jsx` — llamar loadToken() al montar
- `mobile/src/app/(tabs)/_layout.jsx` — añadir tabs TÁCTICO y MERCADOS
- `mobile/src/app/(tabs)/index.jsx` — hooks reales + card MERCADOS
- `mobile/src/app/(tabs)/news.jsx` — useNewsFeed, adaptar campos API
- `mobile/src/app/(tabs)/documents.jsx` — useDocsFeed, adaptar campos API
- `mobile/src/app/(tabs)/social.jsx` — useSocialFeed, adaptar campos API
- `mobile/src/hooks/useQilinData.js` — token del singleton

---

## Referencia de campos API → UI

**news_events:** `id, time(ISO), source, title, url, summary, zones(TEXT[]), keywords(TEXT[]), severity, relevance, source_country, sectors(TEXT[])`

**social_posts:** `tweet_id, handle, display, category, zone, content, lang, likes, retweets, url, time(ISO)`

**documents:** `id, time(ISO), title, url, source, source_country, org_type, sectors(TEXT[]), relevance, severity, page_count, file_size_kb, summary, status(pending/processed/failed)`

**sec_filings:** `id, time(ISO), ticker, company_name, cik, form_type, accession_number, title, filing_url, sector, severity, relevance, summary, status`

---

## Task 1: Instalar dependencias + configurar jest

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`
- Modify: `mobile/.env.local`

- [ ] **Step 1: Instalar paquetes runtime**

Desde el directorio `mobile/`:
```bash
npx expo install expo-secure-store react-native-maps
```

- [ ] **Step 2: Instalar paquetes de test**

```bash
npx expo install jest-expo @testing-library/react-native --save-dev
```

- [ ] **Step 3: Actualizar `mobile/package.json`**

Añadir/reemplazar secciones `scripts` y `jest`:
```json
{
  "scripts": {
    "start":   "expo start",
    "ios":     "expo start --ios",
    "android": "expo start --android",
    "tunnel":  "expo start --tunnel",
    "test":    "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|react-native-maps)"
    ]
  }
}
```

- [ ] **Step 4: Actualizar `mobile/app.json` — plugin react-native-maps**

Reemplazar el objeto `"expo"` con:
```json
{
  "expo": {
    "name": "Qilin",
    "slug": "qilin",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "qilin",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#070b0f"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.qilin.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#070b0f"
      },
      "package": "com.qilin.app",
      "config": {
        "googleMaps": {
          "apiKey": ""
        }
      }
    },
    "plugins": [
      "expo-router",
      "expo-document-picker",
      "expo-asset",
      "expo-font",
      [
        "react-native-maps",
        {
          "googleMapsApiKey": ""
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 5: Añadir variable a `mobile/.env.local`**

Añadir al final del fichero:
```
# Google Maps API key — requerido solo para builds de producción en Android
# En Expo Go (desarrollo) el mapa funciona sin key
EXPO_PUBLIC_GOOGLE_MAPS_KEY=
```

- [ ] **Step 6: Crear directorio de tests y verificar**

```bash
mkdir mobile/__tests__
cd mobile && npx jest --listTests
```
Expected: no tests found (directorio vacío, pero jest está configurado)

- [ ] **Step 7: Commit**

```bash
git add mobile/package.json mobile/app.json mobile/.env.local
git commit -m "feat(mobile): install expo-secure-store, react-native-maps, jest-expo"
```

---

## Task 2: apiClient.js — singleton de autenticación

**Files:**
- Create: `mobile/src/hooks/apiClient.js`
- Create: `mobile/__tests__/apiClient.test.js`

- [ ] **Step 1: Escribir el test**

```javascript
// mobile/__tests__/apiClient.test.js
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}))

global.fetch = jest.fn()

// Reset module state between tests
beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
})

test('loadToken reads qilin_token from SecureStore', async () => {
  const SecureStore = require('expo-secure-store')
  SecureStore.getItemAsync.mockResolvedValue('tok-abc')
  const { loadToken, getToken } = require('../src/hooks/apiClient')
  await loadToken()
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith('qilin_token')
  expect(getToken()).toBe('tok-abc')
})

test('setToken updates in-memory token and persists to SecureStore', () => {
  const SecureStore = require('expo-secure-store')
  const { setToken, getToken } = require('../src/hooks/apiClient')
  setToken('tok-xyz')
  expect(getToken()).toBe('tok-xyz')
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('qilin_token', 'tok-xyz')
})

test('authFetch sends Authorization header when token is set', async () => {
  const { setToken, authFetch } = require('../src/hooks/apiClient')
  setToken('tok-123')
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: 1 }) })
  await authFetch('/test/path')
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/test/path'),
    expect.objectContaining({ headers: { Authorization: 'Bearer tok-123' } })
  )
})

test('authFetch sends no Authorization header when token is null', async () => {
  const { loadToken, authFetch } = require('../src/hooks/apiClient')
  const SecureStore = require('expo-secure-store')
  SecureStore.getItemAsync.mockResolvedValue(null)
  await loadToken()
  global.fetch.mockResolvedValue({ ok: true, json: async () => [] })
  await authFetch('/test/path')
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/test/path'),
    expect.objectContaining({ headers: {} })
  )
})

test('authFetch throws on non-ok response', async () => {
  const { setToken, authFetch } = require('../src/hooks/apiClient')
  setToken('tok-123')
  global.fetch.mockResolvedValue({ ok: false, status: 401 })
  await expect(authFetch('/protected')).rejects.toThrow('HTTP 401')
})
```

- [ ] **Step 2: Correr el test — esperar fallo**

```bash
cd mobile && npx jest __tests__/apiClient.test.js
```
Expected: FAIL — "Cannot find module '../src/hooks/apiClient'"

- [ ] **Step 3: Implementar `mobile/src/hooks/apiClient.js`**

```javascript
import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

let _token = null

export async function loadToken() {
  _token = await SecureStore.getItemAsync('qilin_token')
}

export function setToken(token) {
  _token = token
  SecureStore.setItemAsync('qilin_token', token)
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
```

- [ ] **Step 4: Correr el test — esperar PASS**

```bash
cd mobile && npx jest __tests__/apiClient.test.js
```
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/apiClient.js mobile/__tests__/apiClient.test.js
git commit -m "feat(mobile): add apiClient singleton — SecureStore auth"
```

---

## Task 3: Auth wiring — login, _layout, useQilinData

**Files:**
- Modify: `mobile/src/app/login.jsx`
- Modify: `mobile/src/app/_layout.jsx`
- Modify: `mobile/src/hooks/useQilinData.js`

- [ ] **Step 1: Modificar `mobile/src/app/login.jsx`**

Añadir el import al inicio:
```javascript
import { setToken } from '../hooks/apiClient'
```

Reemplazar el bloque `if (res.ok)`:
```javascript
if (res.ok) {
  const { access_token } = await res.json()
  setToken(access_token)
  router.replace('/(tabs)')
  return
}
```

- [ ] **Step 2: Modificar `mobile/src/app/_layout.jsx`**

Añadir el import:
```javascript
import { loadToken } from '../hooks/apiClient'
```

Reemplazar el `useEffect` existente:
```javascript
useEffect(() => {
  loadToken().finally(() => SplashScreen.hideAsync())
}, [])
```

- [ ] **Step 3: Modificar `mobile/src/hooks/useQilinData.js`**

Añadir el import al inicio:
```javascript
import { getToken } from './apiClient'
```

Reemplazar la línea `const token = null // TODO`:
```javascript
const token = getToken()
```

- [ ] **Step 4: Verificar manualmente en Expo Go**

```bash
cd mobile && npx expo start
```
- Abrir Expo Go, introducir `carlos/12345` → debe navegar a tabs
- En dev sin backend: el fallback en el catch de `login.jsx` sigue funcionando (credentials hardcodeadas)
- Verificar que la SplashScreen desaparece sin error

- [ ] **Step 5: Commit**

```bash
git add mobile/src/app/login.jsx mobile/src/app/_layout.jsx mobile/src/hooks/useQilinData.js
git commit -m "feat(mobile): wire JWT auth — SecureStore + loadToken on startup"
```

---

## Task 4: Hooks de datos (useNewsFeed, useDocsFeed, useSocialFeed, useSecFeed)

**Files:**
- Create: `mobile/src/hooks/useNewsFeed.js`
- Create: `mobile/src/hooks/useDocsFeed.js`
- Create: `mobile/src/hooks/useSocialFeed.js`
- Create: `mobile/src/hooks/useSecFeed.js`
- Create: `mobile/__tests__/useNewsFeed.test.js`

- [ ] **Step 1: Escribir el test de useNewsFeed**

```javascript
// mobile/__tests__/useNewsFeed.test.js
jest.mock('../src/hooks/apiClient', () => ({
  authFetch: jest.fn(),
}))

import { renderHook, act, waitFor } from '@testing-library/react-native'
import { authFetch } from '../src/hooks/apiClient'
import { useNewsFeed } from '../src/hooks/useNewsFeed'

beforeEach(() => jest.clearAllMocks())

test('returns empty array while loading', () => {
  authFetch.mockReturnValue(new Promise(() => {})) // never resolves
  const { result } = renderHook(() => useNewsFeed())
  expect(result.current.articles).toEqual([])
  expect(result.current.loading).toBe(true)
})

test('populates articles on successful fetch', async () => {
  const fakeArticles = [
    { id: 1, title: 'Test', severity: 'high', zones: ['Europa'], time: new Date().toISOString(),
      source: 'BBC', summary: 'Summary', keywords: ['war'], relevance: 80 }
  ]
  authFetch.mockResolvedValue(fakeArticles)
  const { result } = renderHook(() => useNewsFeed())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.articles).toHaveLength(1)
  expect(result.current.articles[0].title).toBe('Test')
})

test('derives zones from articles', async () => {
  authFetch.mockResolvedValue([
    { id: 1, zones: ['Europa', 'Asia'], title: 'A', severity: 'low', time: new Date().toISOString(), source: 'X', summary: '', keywords: [], relevance: 50 },
    { id: 2, zones: ['Asia'],           title: 'B', severity: 'low', time: new Date().toISOString(), source: 'X', summary: '', keywords: [], relevance: 50 },
  ])
  const { result } = renderHook(() => useNewsFeed())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.zones.sort()).toEqual(['Asia', 'Europa'])
})

test('returns empty array on fetch error', async () => {
  authFetch.mockRejectedValue(new Error('HTTP 401'))
  const { result } = renderHook(() => useNewsFeed())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.articles).toEqual([])
})
```

- [ ] **Step 2: Correr el test — esperar fallo**

```bash
cd mobile && npx jest __tests__/useNewsFeed.test.js
```
Expected: FAIL — "Cannot find module '../src/hooks/useNewsFeed'"

- [ ] **Step 3: Implementar `mobile/src/hooks/useNewsFeed.js`**

```javascript
import { useState, useEffect, useMemo } from 'react'
import { authFetch } from './apiClient'

export function useNewsFeed() {
  const [articles, setArticles] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const raw = await authFetch('/news/feed?limit=100')
        if (!cancelled) setArticles(raw || [])
      } catch (err) {
        console.warn('[useNewsFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const zones = useMemo(
    () => [...new Set(articles.flatMap(a => a.zones || []))].sort(),
    [articles]
  )

  return { articles, zones, loading }
}
```

- [ ] **Step 4: Implementar `mobile/src/hooks/useDocsFeed.js`**

```javascript
import { useState, useEffect, useMemo } from 'react'
import { authFetch } from './apiClient'

export function useDocsFeed() {
  const [documents, setDocuments] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const raw = await authFetch('/docs/feed?limit=100')
        if (!cancelled) setDocuments(raw || [])
      } catch (err) {
        console.warn('[useDocsFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const orgTypes = useMemo(
    () => [...new Set(documents.map(d => d.org_type).filter(Boolean))].sort(),
    [documents]
  )

  return { documents, orgTypes, loading }
}
```

- [ ] **Step 5: Implementar `mobile/src/hooks/useSocialFeed.js`**

```javascript
import { useState, useEffect, useMemo } from 'react'
import { authFetch } from './apiClient'

export function useSocialFeed() {
  const [posts,   setPosts]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const raw = await authFetch('/social/feed?limit=100')
        if (!cancelled) setPosts(raw || [])
      } catch (err) {
        console.warn('[useSocialFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const zones = useMemo(
    () => [...new Set(posts.map(p => p.zone).filter(Boolean))].sort(),
    [posts]
  )

  const categories = useMemo(
    () => [...new Set(posts.map(p => p.category).filter(Boolean))].sort(),
    [posts]
  )

  return { posts, zones, categories, loading }
}
```

- [ ] **Step 6: Implementar `mobile/src/hooks/useSecFeed.js`**

```javascript
import { useState, useEffect, useMemo } from 'react'
import { authFetch } from './apiClient'

const SECTOR_COLOR = {
  defense:        'rgba(255,59,74,0.9)',
  energy:         'rgba(255,140,0,0.9)',
  semiconductors: 'rgba(0,200,255,0.9)',
  financials:     'rgba(0,229,160,0.9)',
  cyber_infra:    'rgba(130,80,255,0.9)',
}

const SECTOR_LABEL = {
  defense:        'Defensa',
  energy:         'Energía',
  semiconductors: 'Semicon.',
  financials:     'Finanzas',
  cyber_infra:    'Ciber/Infra',
}

export { SECTOR_COLOR, SECTOR_LABEL }

export function useSecFeed() {
  const [filings,  setFilings]  = useState([])
  const [sources,  setSources]  = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawFilings, rawSources] = await Promise.all([
          authFetch('/sec/feed?limit=100'),
          authFetch('/sec/sources'),
        ])
        if (!cancelled) {
          setFilings(rawFilings  || [])
          setSources(rawSources  || [])
        }
      } catch (err) {
        console.warn('[useSecFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const sectors = useMemo(
    () => [...new Set(filings.map(f => f.sector).filter(Boolean))].sort(),
    [filings]
  )

  const failingSources = useMemo(
    () => sources.filter(s => (s.consecutive_failures || 0) >= 3),
    [sources]
  )

  return { filings, sources, sectors, failingSources, loading }
}
```

- [ ] **Step 7: Correr todos los tests**

```bash
cd mobile && npx jest
```
Expected: 9 passed (5 de apiClient + 4 de useNewsFeed)

- [ ] **Step 8: Commit**

```bash
git add mobile/src/hooks/useNewsFeed.js mobile/src/hooks/useDocsFeed.js mobile/src/hooks/useSocialFeed.js mobile/src/hooks/useSecFeed.js mobile/__tests__/useNewsFeed.test.js
git commit -m "feat(mobile): add real data hooks — useNewsFeed, useDocsFeed, useSocialFeed, useSecFeed"
```

---

## Task 5: Actualizar news.jsx con datos reales

**Files:**
- Modify: `mobile/src/app/(tabs)/news.jsx`

Los campos de la API difieren del mock:
- `n.excerpt` → `n.summary`
- `n.zone` (string) → `n.zones` (array) — mostrar `n.zones?.[0] || ''`
- `n.time` (string HH:MM) → `new Date(n.time).toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'})`
- `n.tags` → `n.keywords || []`

- [ ] **Step 1: Reemplazar el contenido completo de `mobile/src/app/(tabs)/news.jsx`**

```javascript
import { useState, useMemo }                                     from 'react'
import { View, Text, TextInput, ScrollView,
         Pressable, StyleSheet, FlatList }                       from 'react-native'
import { useNewsFeed }                                           from '../../hooks/useNewsFeed'
import { C, SEV_COLOR }                                         from '../../theme'

const ALL_SEV   = ['TODOS', 'high', 'medium', 'low']
const SEV_LABEL = { high:'ALTO', medium:'MEDIO', low:'BAJO' }

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
}

function RelevanceBar({ value }) {
  const color = value >= 90 ? C.red : value >= 75 ? C.amber : C.green
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width:`${value}%`, backgroundColor:color }]} />
      </View>
      <Text style={[s.barVal, { color }]}>{value}</Text>
    </View>
  )
}

function NewsCard({ article, expanded, onPress }) {
  const zone = article.zones?.[0] || ''
  const tags = article.keywords || []
  return (
    <Pressable style={[s.card, { borderLeftColor:SEV_COLOR[article.severity] }]} onPress={onPress}>
      <View style={s.cardMeta}>
        <View style={[s.sevBadge, { backgroundColor:`${SEV_COLOR[article.severity]}20`, borderColor:`${SEV_COLOR[article.severity]}44` }]}>
          <Text style={[s.sevText, { color:SEV_COLOR[article.severity] }]}>{SEV_LABEL[article.severity]}</Text>
        </View>
        <Text style={s.zone}>{zone}</Text>
        <Text style={s.time}>{fmt(article.time)} · {article.source}</Text>
      </View>

      <Text style={s.title}>{article.title}</Text>

      {expanded && article.summary ? (
        <Text style={s.excerpt}>{article.summary}</Text>
      ) : null}

      <View style={s.footer}>
        <View style={{ flexDirection:'row', gap:6, flex:1, flexWrap:'wrap' }}>
          {tags.slice(0, 4).map(t => (
            <Text key={t} style={s.tag}>#{t}</Text>
          ))}
        </View>
        <View style={{ width:80 }}>
          <RelevanceBar value={article.relevance || 0} />
        </View>
      </View>
    </Pressable>
  )
}

export default function NewsScreen() {
  const { articles, zones, loading } = useNewsFeed()

  const [sevFilter,  setSevFilter]  = useState('TODOS')
  const [zoneFilter, setZoneFilter] = useState('TODAS')
  const [search,     setSearch]     = useState('')
  const [expanded,   setExpanded]   = useState(null)

  const ALL_ZONES = ['TODAS', ...zones]

  const filtered = useMemo(() => articles.filter(n => {
    if (sevFilter  !== 'TODOS' && n.severity !== sevFilter) return false
    if (zoneFilter !== 'TODAS' && !(n.zones || []).includes(zoneFilter)) return false
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [articles, sevFilter, zoneFilter, search])

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>◈ NOTICIAS</Text>
        <Text style={s.count}>{filtered.length} resultados</Text>
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Buscar en titulares..."
          placeholderTextColor={C.txt3}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:16 }}>
        {ALL_SEV.map(s2 => (
          <Pressable key={s2} style={[s.chip, sevFilter===s2 && s.chipActive]} onPress={() => setSevFilter(s2)}>
            <Text style={[s.chipText, sevFilter===s2 && s.chipTextActive]}>
              {s2 === 'TODOS' ? 'TODOS' : SEV_LABEL[s2]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:16, paddingBottom:8 }}>
        {ALL_ZONES.map(z => (
          <Pressable key={z} style={[s.chip, zoneFilter===z && s.chipActive]} onPress={() => setZoneFilter(z)}>
            <Text style={[s.chipText, zoneFilter===z && s.chipTextActive]}>{z}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={a => String(a.id)}
        contentContainerStyle={{ padding:12, gap:8, paddingBottom:32 }}
        renderItem={({ item }) => (
          <NewsCard
            article={item}
            expanded={expanded === item.id}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={s.empty}>
            {loading ? 'Cargando noticias...' : 'Sin resultados para los filtros seleccionados'}
          </Text>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex:1, backgroundColor:C.bg0 },
  header:        { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.borderMd },
  headerTitle:   { color:C.cyan, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, flex:1 },
  count:         { color:C.txt3, fontFamily:'SpaceMono', fontSize:9, letterSpacing:1 },
  searchWrap:    { padding:12, paddingBottom:6 },
  search:        { backgroundColor:C.bg2, borderWidth:1, borderColor:C.borderMd, color:C.txt1, fontFamily:'SpaceMono', fontSize:11, padding:10, borderRadius:3 },
  filterRow:     { flexGrow:0, paddingTop:6 },
  chip:          { paddingHorizontal:10, paddingVertical:5, borderRadius:2, borderWidth:1, borderColor:C.borderMd, backgroundColor:C.bg2 },
  chipActive:    { borderColor:'rgba(0,200,255,0.5)', backgroundColor:'rgba(0,200,255,0.08)' },
  chipText:      { color:C.txt3, fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  chipTextActive:{ color:C.cyan },
  card:          { backgroundColor:C.bg2, borderWidth:1, borderColor:C.borderMd, borderLeftWidth:3, borderRadius:2, padding:12, gap:8 },
  cardMeta:      { flexDirection:'row', alignItems:'center', gap:7 },
  sevBadge:      { borderWidth:1, paddingHorizontal:6, paddingVertical:2, borderRadius:2 },
  sevText:       { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  zone:          { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, letterSpacing:1, flex:1 },
  time:          { fontFamily:'SpaceMono', fontSize:8, color:C.txt3 },
  title:         { fontSize:12, fontWeight:'600', color:C.txt1, lineHeight:17 },
  excerpt:       { fontSize:11, color:C.txt2, lineHeight:17 },
  footer:        { flexDirection:'row', alignItems:'center', gap:8 },
  tag:           { fontSize:8, fontFamily:'SpaceMono', color:C.txt3, backgroundColor:C.bg3, paddingHorizontal:5, paddingVertical:2, borderRadius:2 },
  barTrack:      { flex:1, height:2, backgroundColor:C.borderMd, borderRadius:1, overflow:'hidden' },
  barFill:       { height:'100%', borderRadius:1 },
  barVal:        { fontFamily:'SpaceMono', fontSize:8 },
  empty:         { textAlign:'center', padding:40, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },
})
```

- [ ] **Step 2: Verificar en Expo Go**

Abrir tab NOTICIAS — esperar:
- Con API activa: artículos reales con severidad, zona, fuente
- Sin API: "Cargando noticias..." seguido de lista vacía

- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/(tabs)/news.jsx
git commit -m "feat(mobile): news.jsx uses real API via useNewsFeed"
```

---

## Task 6: Actualizar documents.jsx con datos reales

**Files:**
- Modify: `mobile/src/app/(tabs)/documents.jsx`

Campos reales: `id, time(ISO), title, url, source, org_type, sectors(TEXT[]), relevance, severity, page_count, file_size_kb, summary, status(pending/processed/failed)`

Mapeo de status: `processed → analyzed`, `failed → archived`, `pending → pending`

- [ ] **Step 1: Reemplazar el contenido completo de `mobile/src/app/(tabs)/documents.jsx`**

```javascript
import { useState, useEffect }                                    from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView } from 'react-native'
import * as DocumentPicker                                         from 'expo-document-picker'
import { useDocsFeed }                                            from '../../hooks/useDocsFeed'
import { C }                                                      from '../../theme'

const STATUS_MAP    = { processed:'analyzed', failed:'archived', pending:'pending' }
const STATUS_LABELS = { analyzed:'ANALIZADO', analyzing:'ANALIZANDO', pending:'PENDIENTE', archived:'ARCHIVADO' }
const STATUS_COLORS = { analyzed:C.green, analyzing:C.amber, pending:C.txt3, archived:C.red }
const FILTERS       = ['TODOS', 'ANALIZADO', 'PENDIENTE', 'ARCHIVADO']

const ORG_ICONS = { defense:'🛡', international:'🌐', think_tank:'🔬', energy:'⚡', government:'🏛', default:'📄' }

function mapStatus(status) {
  return STATUS_MAP[status] || 'pending'
}

function fmtDate(iso) {
  if (!iso) return '?'
  return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
}

function fmtSize(kb) {
  if (!kb) return '?'
  return kb >= 1024 ? `${(kb/1024).toFixed(1)} MB` : `${kb} KB`
}

function DocRow({ doc, selected, onPress }) {
  const status = mapStatus(doc.status)
  const color  = STATUS_COLORS[status]
  return (
    <Pressable style={[s.row, selected && s.rowSelected]} onPress={onPress}>
      <Text style={s.docIcon}>{ORG_ICONS[doc.org_type] || ORG_ICONS.default}</Text>
      <View style={{ flex:1 }}>
        <Text style={s.docName} numberOfLines={1}>{doc.title}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:3 }}>
          <Text style={[s.docStatus, { color }]}>{STATUS_LABELS[status]}</Text>
          {(doc.sectors || []).slice(0,2).map(z => <Text key={z} style={s.docZone}>{z}</Text>)}
        </View>
      </View>
      <View style={{ alignItems:'flex-end' }}>
        <Text style={s.docSize}>{fmtSize(doc.file_size_kb)}</Text>
        <Text style={s.docPages}>{doc.page_count || '?'}p</Text>
      </View>
    </Pressable>
  )
}

function DocDetail({ doc, onClose }) {
  const status = mapStatus(doc.status)
  const color  = STATUS_COLORS[status]
  return (
    <ScrollView style={s.detail} contentContainerStyle={{ padding:16, gap:14, paddingBottom:32 }}>
      <Pressable style={s.closeBtn} onPress={onClose}>
        <Text style={s.closeText}>✕</Text>
      </Pressable>

      <Text style={s.detailIcon}>{ORG_ICONS[doc.org_type] || ORG_ICONS.default}</Text>
      <Text style={s.detailName}>{doc.title}</Text>

      <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
        <View style={[s.badge, { backgroundColor:`${color}18`, borderColor:`${color}44` }]}>
          <Text style={[s.badgeText, { color }]}>{STATUS_LABELS[status]}</Text>
        </View>
        <Text style={s.detailMeta}>{fmtSize(doc.file_size_kb)} · {doc.page_count || '?'} pág.</Text>
      </View>

      {[
        ['FUENTE',  doc.source],
        ['FECHA',   fmtDate(doc.time)],
        ['SECTORES',  (doc.sectors || []).join(', ') || '—'],
      ].map(([k,v]) => (
        <View key={k} style={s.metaRow}>
          <Text style={s.metaKey}>{k}</Text>
          <Text style={s.metaVal}>{v}</Text>
        </View>
      ))}

      <View style={s.divider} />

      <Text style={s.sectionLabel}>RESUMEN</Text>
      {status === 'analyzed' && doc.summary ? (
        <>
          <Text style={s.summary}>{doc.summary}</Text>
          {doc.relevance != null && (
            <View style={{ gap:6 }}>
              <Text style={s.metaKey}>RELEVANCIA GEOPOLÍTICA</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                <View style={s.relTrack}>
                  <View style={[s.relFill, {
                    width:`${doc.relevance}%`,
                    backgroundColor: doc.relevance >= 90 ? C.red : doc.relevance >= 75 ? C.amber : C.green,
                  }]} />
                </View>
                <Text style={s.relVal}>{doc.relevance}</Text>
              </View>
            </View>
          )}
        </>
      ) : (
        <Text style={[s.statusMsg, { color: status === 'analyzing' ? C.amber : C.txt3 }]}>
          {status === 'analyzing' ? 'ANÁLISIS EN CURSO...' : 'EN COLA PARA ANÁLISIS'}
        </Text>
      )}
    </ScrollView>
  )
}

export default function DocumentsScreen() {
  const { documents, loading } = useDocsFeed()
  const [localDocs,  setLocalDocs]  = useState([])
  const [filter,     setFilter]     = useState('TODOS')
  const [selected,   setSelected]   = useState(null)

  useEffect(() => { setLocalDocs(documents) }, [documents])

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ multiple:true, type:'*/*' })
    if (res.canceled) return
    const newDocs = res.assets.map((f, i) => ({
      id: `local-${Date.now()}-${i}`,
      title: f.name,
      org_type: null,
      file_size_kb: f.size ? Math.round(f.size / 1024) : null,
      time: new Date().toISOString(),
      status: 'pending',
      sectors: [], summary: null, relevance: null, page_count: null, source: 'Local',
    }))
    setLocalDocs(p => [...newDocs, ...p])
  }

  const filtered = filter === 'TODOS'
    ? localDocs
    : localDocs.filter(d => STATUS_LABELS[mapStatus(d.status)] === filter)

  const counts = {
    TODOS:      localDocs.length,
    ANALIZADO:  localDocs.filter(d => mapStatus(d.status) === 'analyzed').length,
    PENDIENTE:  localDocs.filter(d => mapStatus(d.status) === 'pending').length,
    ARCHIVADO:  localDocs.filter(d => mapStatus(d.status) === 'archived').length,
  }

  const selectedDoc = localDocs.find(d => d.id === selected)

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>▣ DOCUMENTOS</Text>
        <Pressable style={s.uploadBtn} onPress={pickDocument}>
          <Text style={s.uploadText}>+ SUBIR</Text>
        </Pressable>
      </View>

      <View style={s.tabRow}>
        {FILTERS.map(f => (
          <Pressable key={f} style={[s.tab, filter===f && s.tabActive]} onPress={() => setFilter(f)}>
            <Text style={[s.tabLabel, filter===f && s.tabLabelActive]}>{f}</Text>
            <Text style={[s.tabCount, filter===f && s.tabCountActive]}>{counts[f]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.content}>
        <FlatList
          style={s.list}
          data={filtered}
          keyExtractor={d => String(d.id)}
          contentContainerStyle={{ padding:6, paddingBottom:32 }}
          renderItem={({ item }) => (
            <DocRow
              doc={item}
              selected={selected === item.id}
              onPress={() => setSelected(selected === item.id ? null : item.id)}
            />
          )}
          ListEmptyComponent={
            <Text style={s.empty}>
              {loading ? 'Cargando documentos...' : 'Sin documentos disponibles'}
            </Text>
          }
        />

        {selectedDoc && (
          <View style={s.detailPanel}>
            <DocDetail doc={selectedDoc} onClose={() => setSelected(null)} />
          </View>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex:1, backgroundColor:C.bg0 },
  header:        { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.borderMd },
  headerTitle:   { color:C.cyan, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, flex:1 },
  uploadBtn:     { backgroundColor:'rgba(0,200,255,0.1)', borderWidth:1, borderColor:'rgba(0,200,255,0.4)', paddingHorizontal:12, paddingVertical:6, borderRadius:2 },
  uploadText:    { color:C.cyan, fontFamily:'SpaceMono', fontSize:9, letterSpacing:2 },
  tabRow:        { flexDirection:'row', borderBottomWidth:1, borderBottomColor:C.borderMd },
  tab:           { flex:1, alignItems:'center', padding:10, borderBottomWidth:2, borderBottomColor:'transparent' },
  tabActive:     { borderBottomColor:C.cyan },
  tabLabel:      { fontFamily:'SpaceMono', fontSize:7, color:C.txt3, letterSpacing:1, textTransform:'uppercase' },
  tabLabelActive:{ color:C.cyan },
  tabCount:      { fontFamily:'SpaceMono', fontSize:16, color:C.txt2, marginTop:2 },
  tabCountActive:{ color:C.cyan },
  content:       { flex:1, position:'relative' },
  list:          { flex:1 },
  row:           { flexDirection:'row', alignItems:'center', gap:10, padding:12, marginHorizontal:6, marginBottom:2, borderRadius:2 },
  rowSelected:   { backgroundColor:C.bg3, borderWidth:1, borderColor:'rgba(0,200,255,0.3)' },
  docIcon:       { fontSize:20, width:28 },
  docName:       { fontSize:11, color:C.txt1 },
  docStatus:     { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  docZone:       { fontFamily:'SpaceMono', fontSize:8, color:C.txt3 },
  docSize:       { fontFamily:'SpaceMono', fontSize:9, color:C.txt3 },
  docPages:      { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, marginTop:2 },
  detailPanel:   { position:'absolute', bottom:0, left:0, right:0, top:0, backgroundColor:C.bg1, zIndex:10 },
  closeBtn:      { alignSelf:'flex-end', padding:16 },
  closeText:     { color:C.txt3, fontSize:20 },
  detail:        { flex:1 },
  detailIcon:    { fontSize:32 },
  detailName:    { fontSize:13, fontWeight:'600', color:C.txt1, lineHeight:18 },
  badge:         { borderWidth:1, paddingHorizontal:8, paddingVertical:3, borderRadius:2 },
  badgeText:     { fontFamily:'SpaceMono', fontSize:9, letterSpacing:1 },
  detailMeta:    { fontFamily:'SpaceMono', fontSize:9, color:C.txt3, alignSelf:'center' },
  metaRow:       { flexDirection:'row', gap:12 },
  metaKey:       { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, letterSpacing:1, textTransform:'uppercase', width:64 },
  metaVal:       { fontFamily:'SpaceMono', fontSize:9, color:C.txt2, flex:1 },
  divider:       { height:1, backgroundColor:C.border },
  sectionLabel:  { fontFamily:'SpaceMono', fontSize:8, letterSpacing:2, color:C.txt3, textTransform:'uppercase' },
  summary:       { fontSize:11, color:C.txt1, lineHeight:18 },
  relTrack:      { flex:1, height:4, backgroundColor:C.borderMd, borderRadius:2, overflow:'hidden' },
  relFill:       { height:'100%', borderRadius:2 },
  relVal:        { fontFamily:'SpaceMono', fontSize:13, color:C.txt1, fontWeight:'600' },
  statusMsg:     { fontFamily:'SpaceMono', fontSize:10, letterSpacing:1 },
  empty:         { textAlign:'center', padding:40, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/(tabs)/documents.jsx
git commit -m "feat(mobile): documents.jsx uses real API via useDocsFeed"
```

---

## Task 7: Actualizar social.jsx e index.jsx

**Files:**
- Modify: `mobile/src/app/(tabs)/social.jsx`
- Modify: `mobile/src/app/(tabs)/index.jsx`

Campos reales social_posts: `tweet_id, handle, display, category, zone, content, lang, likes, retweets, url, time(ISO)`. No hay `sentiment`, `platform` (siempre X/Twitter), ni `verified`. `engagements = likes + retweets`.

- [ ] **Step 1: Reemplazar `mobile/src/app/(tabs)/social.jsx`**

```javascript
import { useState, useMemo }                                      from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView } from 'react-native'
import { useSocialFeed }                                          from '../../hooks/useSocialFeed'
import { C }                                                      from '../../theme'

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
}

function PostCard({ post }) {
  const engagements = (post.likes || 0) + (post.retweets || 0)
  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <View style={s.platBadge}>
          <Text style={s.platText}>X</Text>
        </View>
        <Text style={s.postUser}>@{post.handle}</Text>
        {post.display ? <Text style={s.displayName}>{post.display}</Text> : null}
        <Text style={s.postTime}>{fmt(post.time)} UTC</Text>
      </View>

      <Text style={s.postText}>{post.content}</Text>

      <View style={s.postFooter}>
        {post.category ? (
          <Text style={s.catTag}>{post.category}</Text>
        ) : null}
        <Text style={s.engagements}>↑ {engagements.toLocaleString()}</Text>
        {post.zone ? (
          <View style={s.zonePill}>
            <Text style={s.zoneText}>{post.zone}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default function SocialScreen() {
  const { posts, zones, categories, loading } = useSocialFeed()

  const [zoneFilter,     setZoneFilter]     = useState('TODAS')
  const [categoryFilter, setCategoryFilter] = useState('TODOS')

  const ALL_ZONES      = ['TODAS', ...zones]
  const ALL_CATEGORIES = ['TODOS', ...categories]

  const filtered = useMemo(() => posts.filter(p => {
    if (zoneFilter     !== 'TODAS' && p.zone     !== zoneFilter)     return false
    if (categoryFilter !== 'TODOS' && p.category !== categoryFilter) return false
    return true
  }), [posts, zoneFilter, categoryFilter])

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>◉ SOCIAL</Text>
        <Text style={s.count}>{filtered.length} publicaciones</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:12, paddingVertical:8 }}>
        {ALL_ZONES.map(z => (
          <Pressable key={z} style={[s.chip, zoneFilter===z && s.chipActive]} onPress={() => setZoneFilter(z)}>
            <Text style={[s.chipText, zoneFilter===z && { color:C.cyan }]}>{z}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:12, paddingBottom:8 }}>
        {ALL_CATEGORIES.map(c => (
          <Pressable key={c} style={[s.chip, categoryFilter===c && s.chipActive]} onPress={() => setCategoryFilter(c)}>
            <Text style={[s.chipText, categoryFilter===c && { color:C.cyan }]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={p => String(p.tweet_id)}
        contentContainerStyle={{ padding:12, gap:8, paddingBottom:32 }}
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={
          <Text style={s.empty}>
            {loading ? 'Cargando publicaciones...' : 'No hay publicaciones para los filtros seleccionados'}
          </Text>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:C.bg0 },
  header:     { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.borderMd },
  headerTitle:{ color:C.cyan, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, flex:1 },
  count:      { color:C.txt3, fontFamily:'SpaceMono', fontSize:9, letterSpacing:1 },
  filterRow:  { flexGrow:0 },
  chip:       { paddingHorizontal:10, paddingVertical:5, borderRadius:2, borderWidth:1, borderColor:C.borderMd, backgroundColor:C.bg2 },
  chipActive: { borderColor:'rgba(0,200,255,0.4)', backgroundColor:'rgba(0,200,255,0.06)' },
  chipText:   { color:C.txt3, fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  postCard:   { backgroundColor:C.bg2, borderWidth:1, borderColor:C.borderMd, borderRadius:3, padding:12, gap:8 },
  postHeader: { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' },
  platBadge:  { backgroundColor:'rgba(0,0,0,0.4)', borderWidth:1, borderColor:'rgba(255,255,255,0.15)', paddingHorizontal:5, paddingVertical:1, borderRadius:2 },
  platText:   { fontFamily:'SpaceMono', fontSize:8, color:C.txt2, letterSpacing:1 },
  postUser:   { fontFamily:'SpaceMono', fontSize:10, color:C.cyan },
  displayName:{ fontFamily:'SpaceMono', fontSize:8, color:C.txt3, flex:1 },
  postTime:   { fontFamily:'SpaceMono', fontSize:8, color:C.txt3 },
  postText:   { fontSize:11, color:C.txt1, lineHeight:17 },
  postFooter: { flexDirection:'row', alignItems:'center', gap:6 },
  catTag:     { fontSize:8, fontFamily:'SpaceMono', color:C.txt3, backgroundColor:C.bg3, paddingHorizontal:5, paddingVertical:2, borderRadius:2 },
  engagements:{ fontFamily:'SpaceMono', fontSize:9, color:C.txt3, flex:1 },
  zonePill:   { backgroundColor:C.bg3, borderWidth:1, borderColor:C.borderMd, paddingHorizontal:6, paddingVertical:2, borderRadius:2 },
  zoneText:   { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, letterSpacing:1 },
  empty:      { textAlign:'center', padding:40, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },
})
```

- [ ] **Step 2: Actualizar `mobile/src/app/(tabs)/index.jsx`**

Reemplazar el contenido completo:

```javascript
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { router }                                        from 'expo-router'
import { useQilinData }                                  from '../../hooks/useQilinData'
import { useNewsFeed }                                   from '../../hooks/useNewsFeed'
import { useDocsFeed }                                   from '../../hooks/useDocsFeed'
import { useSocialFeed }                                 from '../../hooks/useSocialFeed'
import { useSecFeed }                                    from '../../hooks/useSecFeed'
import { C, SEV_COLOR }                                  from '../../theme'

function Dot({ color }) {
  return <View style={[s.dot, { backgroundColor:color, shadowColor:color }]} />
}

function ModuleCard({ title, icon, subtitle, status, statusColor, onPress, children }) {
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <Text style={s.cardIcon}>{icon}</Text>
          <View>
            <Text style={s.cardTitle}>{title}</Text>
            <Text style={s.cardSub}>{subtitle}</Text>
          </View>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
          <Dot color={statusColor} />
          <Text style={[s.cardStatus, { color:statusColor }]}>{status}</Text>
        </View>
      </View>
      <View style={s.cardBody}>{children}</View>
    </Pressable>
  )
}

function StatGrid({ aircraft, vessels, alerts }) {
  const rows = [
    { label:'AERONAVES', value:aircraft.length, sub:`${aircraft.filter(a=>a.type==='military').length} mil`, color:C.cyan },
    { label:'BUQUES',    value:vessels.length,  sub:`${vessels.filter(v=>v.type==='military').length} mil`,  color:C.green },
    { label:'ALT HIGH',  value:alerts.filter(a=>a.severity==='high').length,   sub:'activas', color:C.red },
    { label:'ALT MED',   value:alerts.filter(a=>a.severity==='medium').length, sub:'activas', color:C.amber },
  ]
  return (
    <View style={s.statGrid}>
      {rows.map(r => (
        <View key={r.label} style={s.statCell}>
          <Text style={[s.statVal, { color:r.color }]}>{r.value}</Text>
          <Text style={s.statLabel}>{r.label}</Text>
          <Text style={s.statSub}>{r.sub}</Text>
        </View>
      ))}
    </View>
  )
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
}

export default function HomeScreen() {
  const { aircraft, vessels, alerts, wsStatus } = useQilinData()
  const { articles }  = useNewsFeed()
  const { documents } = useDocsFeed()
  const { posts }     = useSocialFeed()
  const { filings }   = useSecFeed()

  const today = new Date().toDateString()
  const todayFilings = filings.filter(f => f.time && new Date(f.time).toDateString() === today)

  const statusItems = [
    { label:'ADS-B',    color:C.green, val:`${aircraft.length} ent.` },
    { label:'AIS',      color:C.green, val:`${vessels.length} ent.`  },
    { label:'NOTICIAS', color:articles.length ? C.green : C.amber, val:`${articles.length} art.` },
    { label:'WS',       color:wsStatus==='live' ? C.green : C.amber, val:wsStatus.toUpperCase() },
  ]

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding:16, gap:12, paddingBottom:32 }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>◎ QILIN</Text>
        <Text style={s.headerSub}>INTELIGENCIA GEOPOLÍTICA</Text>
      </View>

      <View style={s.statusStrip}>
        {statusItems.map(i => (
          <View key={i.label} style={s.statusItem}>
            <Dot color={i.color} />
            <Text style={[s.statusLabel, { color:i.color }]}>{i.label}</Text>
            <Text style={s.statusVal}>{i.val}</Text>
          </View>
        ))}
      </View>

      <ModuleCard
        title="Mapa Táctico" icon="◎"
        subtitle="ADS-B · AIS · ALERTAS"
        status="LIVE" statusColor={C.green}
        onPress={() => router.push('/(tabs)/tactical')}
      >
        <StatGrid aircraft={aircraft} vessels={vessels} alerts={alerts} />
      </ModuleCard>

      <ModuleCard
        title="Noticias" icon="◈"
        subtitle="OSINT · PRENSA INT."
        status={`${articles.filter(n=>n.severity==='high').length} CRÍTICAS`}
        statusColor={articles.some(n=>n.severity==='high') ? C.red : C.green}
        onPress={() => router.push('/(tabs)/news')}
      >
        {articles.slice(0,3).map(n => (
          <View key={n.id} style={s.row}>
            <View style={[s.rowDot, { backgroundColor:SEV_COLOR[n.severity] }]} />
            <View style={{ flex:1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={s.rowMeta}>{n.source} · {fmt(n.time)} UTC</Text>
            </View>
          </View>
        ))}
        {articles.length === 0 && <Text style={s.rowEmpty}>Sin noticias recientes</Text>}
      </ModuleCard>

      <ModuleCard
        title="Documentos" icon="▣"
        subtitle="PDF · ANÁLISIS"
        status={`${documents.length} docs`}
        statusColor={C.green}
        onPress={() => router.push('/(tabs)/documents')}
      >
        {documents.slice(0,3).map(d => (
          <View key={d.id} style={s.row}>
            <Text style={s.rowTitle} numberOfLines={1}>{d.title}</Text>
          </View>
        ))}
        {documents.length === 0 && <Text style={s.rowEmpty}>Sin documentos recientes</Text>}
      </ModuleCard>

      <ModuleCard
        title="Redes Sociales" icon="◉"
        subtitle="X · TELEGRAM · ZONAS"
        status={`${posts.length} posts`}
        statusColor={C.cyan}
        onPress={() => router.push('/(tabs)/social')}
      >
        {posts.slice(0,3).map(p => (
          <View key={p.tweet_id} style={s.row}>
            <View style={{ flex:1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{p.content}</Text>
              <Text style={s.rowMeta}>@{p.handle} · {p.zone || '—'}</Text>
            </View>
          </View>
        ))}
        {posts.length === 0 && <Text style={s.rowEmpty}>Sin publicaciones recientes</Text>}
      </ModuleCard>

      <ModuleCard
        title="Mercados" icon="$"
        subtitle="SEC 8-K · FILINGS"
        status={todayFilings.length > 0 ? `${todayFilings.length} HOY` : 'AL DÍA'}
        statusColor={todayFilings.length > 0 ? C.amber : C.green}
        onPress={() => router.push('/(tabs)/markets')}
      >
        {filings.slice(0,3).map(f => (
          <View key={f.id} style={s.row}>
            <View style={[s.rowDot, { backgroundColor: f.severity==='high' ? C.red : C.amber }]} />
            <View style={{ flex:1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>[{f.ticker}] {f.company_name}</Text>
              <Text style={s.rowMeta}>{f.form_type} · {f.sector}</Text>
            </View>
          </View>
        ))}
        {filings.length === 0 && <Text style={s.rowEmpty}>Sin filings recientes</Text>}
      </ModuleCard>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:C.bg0 },
  header:      { alignItems:'center', paddingVertical:12 },
  headerTitle: { fontSize:22, color:C.cyan, letterSpacing:6, fontFamily:'SpaceMono' },
  headerSub:   { fontSize:8, color:C.txt3, letterSpacing:3, marginTop:3 },
  statusStrip: { flexDirection:'row', backgroundColor:C.bg1, borderWidth:1, borderColor:C.borderMd, borderRadius:3, padding:10, gap:12 },
  statusItem:  { flexDirection:'row', alignItems:'center', gap:4 },
  statusLabel: { fontSize:8, letterSpacing:1, fontFamily:'SpaceMono' },
  statusVal:   { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', marginLeft:2 },
  dot:         { width:5, height:5, borderRadius:3, shadowOpacity:0.8, shadowRadius:4, elevation:2 },
  card:        { backgroundColor:C.bg1, borderWidth:1, borderColor:C.borderMd, borderRadius:3, overflow:'hidden' },
  cardHeader:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:12, borderBottomWidth:1, borderBottomColor:C.border },
  cardIcon:    { fontSize:18, color:C.cyan },
  cardTitle:   { fontSize:10, color:C.cyan, letterSpacing:2, fontFamily:'SpaceMono', fontWeight:'700' },
  cardSub:     { fontSize:8, color:C.txt3, letterSpacing:1, marginTop:1 },
  cardStatus:  { fontSize:8, letterSpacing:1, fontFamily:'SpaceMono' },
  cardBody:    { paddingVertical:4 },
  statGrid:    { flexDirection:'row', flexWrap:'wrap' },
  statCell:    { width:'50%', padding:12, borderRightWidth:1, borderBottomWidth:1, borderColor:C.border },
  statVal:     { fontSize:28, fontFamily:'SpaceMono', fontWeight:'500', lineHeight:32 },
  statLabel:   { fontSize:7, color:C.txt3, letterSpacing:2, marginTop:2, textTransform:'uppercase' },
  statSub:     { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', marginTop:1 },
  row:         { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:12, paddingVertical:7, borderBottomWidth:1, borderBottomColor:C.border },
  rowDot:      { width:6, height:6, borderRadius:3 },
  rowTitle:    { fontSize:10, color:C.txt1, flex:1 },
  rowMeta:     { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', marginTop:1 },
  rowEmpty:    { fontSize:9, color:C.txt3, fontFamily:'SpaceMono', padding:12, textAlign:'center' },
})
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/(tabs)/social.jsx mobile/src/app/(tabs)/index.jsx
git commit -m "feat(mobile): social.jsx and index.jsx use real API hooks"
```

---

## Task 8: markets.jsx — Tab MERCADOS

**Files:**
- Create: `mobile/src/app/(tabs)/markets.jsx`

- [ ] **Step 1: Crear `mobile/src/app/(tabs)/markets.jsx`**

```javascript
import { useState, useMemo }                                     from 'react'
import { View, Text, Pressable, StyleSheet, FlatList,
         ScrollView, Modal, Linking, SafeAreaView }              from 'react-native'
import { useSecFeed, SECTOR_COLOR, SECTOR_LABEL }               from '../../hooks/useSecFeed'
import { C }                                                     from '../../theme'

const SEV_BG     = { high:'rgba(255,59,74,0.12)', medium:'rgba(255,176,32,0.10)', low:'rgba(0,229,160,0.08)' }
const SEV_BORDER = { high:'rgba(255,59,74,0.3)',  medium:'rgba(255,176,32,0.28)', low:'rgba(0,229,160,0.22)' }
const SEV_C      = { high:C.red, medium:C.amber, low:C.green }

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
}

function clamp(v) { return Math.max(0, Math.min(100, v || 0)) }

function TickerBadge({ ticker, sector }) {
  const color = SECTOR_COLOR[sector] || C.cyan
  return (
    <View style={[s.tickerBadge, { borderColor:color }]}>
      <Text style={[s.tickerText, { color }]}>{ticker}</Text>
    </View>
  )
}

function SectorBadge({ sector }) {
  const color = SECTOR_COLOR[sector] || 'rgba(150,150,150,0.8)'
  return (
    <View style={[s.sectorBadge, { backgroundColor:color }]}>
      <Text style={s.sectorText}>{SECTOR_LABEL[sector] || sector}</Text>
    </View>
  )
}

function SevBadge({ severity }) {
  const sev = severity || 'low'
  return (
    <View style={[s.sevBadge, { backgroundColor:SEV_BG[sev], borderColor:SEV_BORDER[sev] }]}>
      <Text style={[s.sevText, { color:SEV_C[sev] }]}>{sev.toUpperCase()}</Text>
    </View>
  )
}

function RelevanceBar({ value }) {
  const pct   = clamp(value)
  const color = pct >= 70 ? C.red : pct >= 40 ? C.amber : C.green
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
      <View style={s.relTrack}>
        <View style={[s.relFill, { width:`${pct}%`, backgroundColor:color }]} />
      </View>
      <Text style={[s.relVal, { color }]}>{pct}</Text>
    </View>
  )
}

function FilingRow({ filing, selected, onPress }) {
  return (
    <Pressable
      style={[s.filingRow, selected && s.filingRowSelected]}
      onPress={onPress}
    >
      <View style={s.rowTop}>
        <TickerBadge ticker={filing.ticker} sector={filing.sector} />
        <Text style={s.formType}>{filing.form_type}</Text>
        <SevBadge severity={filing.severity} />
        <SectorBadge sector={filing.sector} />
      </View>
      <Text style={s.companyName} numberOfLines={2}>
        {filing.company_name} — {filing.title || 'Sin título'}
      </Text>
      <Text style={s.filingDate}>{fmt(filing.time)}</Text>
    </Pressable>
  )
}

function FilingDetailModal({ filing, onClose }) {
  if (!filing) return null
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.modalRoot}>
        <View style={s.modalHandle} />

        {/* Header */}
        <View style={s.modalHeader}>
          <TickerBadge ticker={filing.ticker} sector={filing.sector} />
          <View style={{ flex:1 }}>
            <Text style={s.modalCompany}>{filing.company_name}</Text>
            <Text style={s.modalSector}>{SECTOR_LABEL[filing.sector] || filing.sector}</Text>
          </View>
          <SevBadge severity={filing.severity} />
          <Pressable onPress={onClose} style={s.modalClose}>
            <Text style={s.modalCloseText}>✕</Text>
          </Pressable>
        </View>

        {/* Meta grid */}
        <View style={s.metaGrid}>
          {[
            ['Formulario', filing.form_type],
            ['Sector',     SECTOR_LABEL[filing.sector] || filing.sector],
            ['Fecha',      fmt(filing.time)],
            ['CIK',        filing.cik],
          ].map(([k,v]) => (
            <View key={k} style={s.metaCell}>
              <Text style={s.metaKey}>{k}</Text>
              <Text style={s.metaVal}>{v || '—'}</Text>
            </View>
          ))}
        </View>

        {/* Accession */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ACCESSION NUMBER</Text>
          <Text style={s.accession}>{filing.accession_number}</Text>
        </View>

        {/* Relevance */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>RELEVANCIA</Text>
          <RelevanceBar value={filing.relevance} />
        </View>

        {/* Items */}
        {filing.title ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>ÍTEMS REPORTADOS</Text>
            <Text style={s.sectionBody}>{filing.title}</Text>
          </View>
        ) : null}

        {/* Summary */}
        {filing.summary ? (
          <View style={[s.section, { flex:1 }]}>
            <Text style={s.sectionLabel}>RESUMEN</Text>
            <Text style={s.sectionBody}>{filing.summary}</Text>
          </View>
        ) : null}

        {/* EDGAR link */}
        {filing.filing_url ? (
          <Pressable
            style={s.edgarBtn}
            onPress={() => Linking.openURL(filing.filing_url)}
          >
            <Text style={s.edgarBtnText}>VER EN EDGAR ↗</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </Modal>
  )
}

export default function MarketsScreen() {
  const { filings, sectors, failingSources, loading } = useSecFeed()

  const [selectedId,    setSelectedId]    = useState(null)
  const [filterSector,  setFilterSector]  = useState('TODOS')
  const [filterSev,     setFilterSev]     = useState('TODOS')

  const filtered = useMemo(() => filings.filter(f => {
    if (filterSector !== 'TODOS' && f.sector   !== filterSector) return false
    if (filterSev    !== 'TODOS' && f.severity !== filterSev)    return false
    return true
  }), [filings, filterSector, filterSev])

  const selected = filings.find(f => f.id === selectedId) || null

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>$ MERCADOS</Text>
        <Text style={s.count}>{filtered.length} filings</Text>
      </View>

      {/* Failing banner */}
      {failingSources.length > 0 && (
        <View style={s.failBanner}>
          <Text style={s.failText}>
            ⚠ Fallos de fetch: {failingSources.map(s => s.ticker).join(', ')}
          </Text>
        </View>
      )}

      {/* Sector filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:12, paddingVertical:8 }}>
        {['TODOS', ...sectors].map(sec => (
          <Pressable key={sec} style={[s.chip, filterSector===sec && s.chipActive]} onPress={() => setFilterSector(sec)}>
            <Text style={[s.chipText, filterSector===sec && { color:C.cyan }]}>
              {sec === 'TODOS' ? 'TODOS' : (SECTOR_LABEL[sec] || sec).toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Severity filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:12, paddingBottom:8 }}>
        {['TODOS', 'high', 'medium', 'low'].map(sev => (
          <Pressable key={sev} style={[s.chip, filterSev===sev && s.chipActive]} onPress={() => setFilterSev(sev)}>
            <Text style={[s.chipText, filterSev===sev && { color:C.cyan }]}>
              {sev === 'TODOS' ? 'TODOS' : sev.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={f => String(f.id)}
        contentContainerStyle={{ paddingBottom:32 }}
        renderItem={({ item }) => (
          <FilingRow
            filing={item}
            selected={item.id === selectedId}
            onPress={() => setSelectedId(item.id === selectedId ? null : item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={s.empty}>
            {loading
              ? 'Cargando filings...'
              : filings.length === 0
                ? 'Ingestor SEC no activo o sin filings aún'
                : 'Sin resultados con los filtros aplicados'}
          </Text>
        }
      />

      <FilingDetailModal filing={selected} onClose={() => setSelectedId(null)} />
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex:1, backgroundColor:C.bg0 },
  header:        { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.borderMd },
  headerTitle:   { color:C.cyan, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, flex:1 },
  count:         { color:C.txt3, fontFamily:'SpaceMono', fontSize:9, letterSpacing:1 },
  failBanner:    { backgroundColor:'rgba(255,176,32,0.08)', borderBottomWidth:1, borderBottomColor:'rgba(255,176,32,0.25)', padding:10, paddingHorizontal:16 },
  failText:      { fontFamily:'SpaceMono', fontSize:9, color:C.amber },
  filterRow:     { flexGrow:0 },
  chip:          { paddingHorizontal:10, paddingVertical:5, borderRadius:2, borderWidth:1, borderColor:C.borderMd, backgroundColor:C.bg2 },
  chipActive:    { borderColor:'rgba(0,200,255,0.4)', backgroundColor:'rgba(0,200,255,0.06)' },
  chipText:      { color:C.txt3, fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  filingRow:     { padding:14, borderBottomWidth:1, borderBottomColor:C.border, borderLeftWidth:3, borderLeftColor:'transparent' },
  filingRowSelected: { backgroundColor:'rgba(0,200,255,0.05)', borderLeftColor:C.cyan },
  rowTop:        { flexDirection:'row', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' },
  tickerBadge:   { borderWidth:1, borderRadius:3, paddingHorizontal:6, paddingVertical:1, backgroundColor:'rgba(0,0,0,0.3)' },
  tickerText:    { fontFamily:'SpaceMono', fontSize:10, fontWeight:'700' },
  sectorBadge:   { paddingHorizontal:5, paddingVertical:1, borderRadius:2 },
  sectorText:    { fontSize:8, fontFamily:'SpaceMono', color:'#070b0f', fontWeight:'700' },
  sevBadge:      { borderWidth:1, paddingHorizontal:5, paddingVertical:1, borderRadius:2 },
  sevText:       { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  formType:      { fontFamily:'SpaceMono', fontSize:9, color:C.txt3 },
  companyName:   { fontSize:11, color:C.txt1, lineHeight:16 },
  filingDate:    { fontSize:9, color:C.txt3, fontFamily:'SpaceMono', marginTop:4 },
  empty:         { textAlign:'center', padding:40, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },

  // Modal
  modalRoot:     { flex:1, backgroundColor:C.bg1, paddingHorizontal:16 },
  modalHandle:   { width:40, height:4, backgroundColor:C.borderMd, borderRadius:2, alignSelf:'center', marginTop:8, marginBottom:16 },
  modalHeader:   { flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:16 },
  modalCompany:  { fontSize:14, fontWeight:'600', color:C.txt1, lineHeight:18 },
  modalSector:   { fontSize:9, color:C.txt3, fontFamily:'SpaceMono', marginTop:2 },
  modalClose:    { padding:4 },
  modalCloseText:{ color:C.txt3, fontSize:18 },
  metaGrid:      { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:16 },
  metaCell:      { width:'47%', backgroundColor:'rgba(255,255,255,0.03)', borderRadius:4, padding:10 },
  metaKey:       { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', textTransform:'uppercase', letterSpacing:.1, marginBottom:3 },
  metaVal:       { fontSize:11, color:C.txt1, fontFamily:'SpaceMono' },
  section:       { marginBottom:14 },
  sectionLabel:  { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', textTransform:'uppercase', letterSpacing:.1, marginBottom:6 },
  sectionBody:   { fontSize:11, color:C.txt2, lineHeight:17 },
  accession:     { fontSize:10, color:C.txt2, fontFamily:'SpaceMono' },
  relTrack:      { flex:1, height:4, backgroundColor:C.borderMd, borderRadius:2, overflow:'hidden' },
  relFill:       { height:'100%', borderRadius:2 },
  relVal:        { fontFamily:'SpaceMono', fontSize:11, fontWeight:'600' },
  edgarBtn:      { margin:16, padding:14, backgroundColor:'rgba(0,200,255,0.08)', borderWidth:1, borderColor:'rgba(0,200,255,0.3)', borderRadius:4, alignItems:'center' },
  edgarBtnText:  { color:C.cyan, fontFamily:'SpaceMono', fontSize:10, fontWeight:'600', letterSpacing:.1 },
})
```

- [ ] **Step 2: Verificar en Expo Go**

Abrir tab MERCADOS — esperar:
- Con API + ingestor activo: lista de filings LMT, RTX, etc.
- Tap en un filing → Modal se desliza desde abajo con detalle completo
- Botón "VER EN EDGAR ↗" abre el navegador del sistema

- [ ] **Step 3: Commit**

```bash
git add mobile/src/app/(tabs)/markets.jsx
git commit -m "feat(mobile): add markets.jsx — SEC filings tab with detail modal"
```

---

## Task 9: tactical.jsx + actualizar tab layout

**Files:**
- Create: `mobile/src/app/(tabs)/tactical.jsx`
- Modify: `mobile/src/app/(tabs)/_layout.jsx`

- [ ] **Step 1: Crear `mobile/src/app/(tabs)/tactical.jsx`**

```javascript
import { View, Text, StyleSheet }      from 'react-native'
import MapView, { Marker, Callout }   from 'react-native-maps'
import { useQilinData }               from '../../hooks/useQilinData'
import { C }                          from '../../theme'

const INITIAL_REGION = {
  latitude:       48.0,
  longitude:      10.0,
  latitudeDelta:  30.0,
  longitudeDelta: 40.0,
}

const WS_COLOR = { live:C.green, connecting:C.amber, reconnecting:C.amber, error:C.red }

export default function TacticalScreen() {
  const { aircraft, alerts, wsStatus } = useQilinData()

  const visibleAircraft = aircraft.filter(a => a.lat != null && a.lon != null)
  const highAlerts      = alerts.filter(a => a.severity === 'high')

  return (
    <View style={s.root}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        mapType="hybrid"
        initialRegion={INITIAL_REGION}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {visibleAircraft.map(aircraft => (
          <Marker
            key={aircraft.icao24}
            coordinate={{ latitude: aircraft.lat, longitude: aircraft.lon }}
            pinColor={aircraft.type === 'military' ? '#ff3b4a' : '#00c8ff'}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Callout tooltip={false}>
              <View style={s.callout}>
                <Text style={s.calloutCall}>{aircraft.callsign || aircraft.icao24}</Text>
                {aircraft.altitude != null && (
                  <Text style={s.calloutMeta}>Alt: {Math.round(aircraft.altitude).toLocaleString()} ft</Text>
                )}
                {aircraft.speed != null && (
                  <Text style={s.calloutMeta}>Vel: {Math.round(aircraft.speed)} kts</Text>
                )}
                <Text style={[s.calloutType, { color: aircraft.type === 'military' ? '#ff3b4a' : '#00c8ff' }]}>
                  {aircraft.type === 'military' ? 'MILITARY' : 'CIVIL'}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Bottom panel */}
      <View style={s.panel}>
        <View style={s.panelItem}>
          <Text style={s.panelVal}>{visibleAircraft.length}</Text>
          <Text style={s.panelLabel}>✈ AERONAVES</Text>
        </View>
        <View style={s.panelDivider} />
        <View style={s.panelItem}>
          <Text style={[s.panelVal, { color:C.red }]}>
            {visibleAircraft.filter(a => a.type === 'military').length}
          </Text>
          <Text style={s.panelLabel}>🔴 MIL.</Text>
        </View>
        <View style={s.panelDivider} />
        <View style={s.panelItem}>
          <Text style={[s.panelVal, { color: highAlerts.length > 0 ? C.red : C.txt3 }]}>
            {highAlerts.length}
          </Text>
          <Text style={s.panelLabel}>⚠ ALERTAS</Text>
        </View>
        <View style={s.panelDivider} />
        <View style={s.panelItem}>
          <View style={[s.wsDot, { backgroundColor: WS_COLOR[wsStatus] || C.amber }]} />
          <Text style={[s.panelLabel, { color: WS_COLOR[wsStatus] || C.amber }]}>
            {wsStatus.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex:1, backgroundColor:C.bg0 },
  callout:      { backgroundColor:C.bg1, padding:10, borderRadius:4, borderWidth:1, borderColor:C.borderMd, minWidth:120 },
  calloutCall:  { fontFamily:'SpaceMono', fontSize:11, color:C.cyan, fontWeight:'700', marginBottom:2 },
  calloutMeta:  { fontFamily:'SpaceMono', fontSize:9,  color:C.txt2, marginTop:1 },
  calloutType:  { fontFamily:'SpaceMono', fontSize:9,  fontWeight:'700', marginTop:4 },
  panel:        { position:'absolute', bottom:0, left:0, right:0,
                  flexDirection:'row', backgroundColor:'rgba(7,11,15,0.92)',
                  borderTopWidth:1, borderTopColor:C.borderMd,
                  paddingVertical:12, paddingHorizontal:8,
                  paddingBottom:28 },
  panelItem:    { flex:1, alignItems:'center', gap:3 },
  panelVal:     { fontFamily:'SpaceMono', fontSize:18, fontWeight:'700', color:C.cyan },
  panelLabel:   { fontFamily:'SpaceMono', fontSize:7,  color:C.txt3, letterSpacing:1 },
  panelDivider: { width:1, backgroundColor:C.borderMd, marginVertical:4 },
  wsDot:        { width:8, height:8, borderRadius:4, marginBottom:2 },
})
```

- [ ] **Step 2: Actualizar `mobile/src/app/(tabs)/_layout.jsx`**

Reemplazar el contenido completo:

```javascript
import { Tabs }        from 'expo-router'
import { Text, View }  from 'react-native'
import { C }           from '../../theme'

const TABS = [
  { name:'index',    label:'INICIO',     icon:'◉' },
  { name:'tactical', label:'TÁCTICO',    icon:'◎' },
  { name:'news',     label:'NOTICIAS',   icon:'◈' },
  { name:'documents',label:'DOCUMENTOS', icon:'▣' },
  { name:'social',   label:'SOCIAL',     icon:'◈' },
  { name:'markets',  label:'MERCADOS',   icon:'$' },
]

function TabIcon({ icon, label, focused }) {
  const color = focused ? C.cyan : C.txt3
  return (
    <View style={{ alignItems:'center', gap:2, paddingTop:6 }}>
      <Text style={{ fontSize:14, color }}>{icon}</Text>
      <Text style={{ fontSize:7, letterSpacing:1, color, fontFamily:'SpaceMono' }}>{label}</Text>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarStyle: {
          backgroundColor:  C.bg1,
          borderTopColor:   C.borderMd,
          borderTopWidth:   1,
          height:           60,
          paddingBottom:    0,
        },
        tabBarShowLabel:    false,
        tabBarActiveTintColor:   C.cyan,
        tabBarInactiveTintColor: C.txt3,
      }}
    >
      {TABS.map(t => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={t.icon} label={t.label} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
```

- [ ] **Step 3: Correr todos los tests**

```bash
cd mobile && npx jest
```
Expected: 9 passed

- [ ] **Step 4: Verificar en Expo Go**

- Tab TÁCTICO: mapa híbrido con aeronaves como marcadores rojos/cyan
- Tap en marker → callout con callsign, altitud, velocidad
- Panel inferior: contadores aeronaves + alertas + estado WS
- Tab MERCADOS: aparece en la barra de navegación con icono `$`

- [ ] **Step 5: Commit final**

```bash
git add mobile/src/app/(tabs)/tactical.jsx mobile/src/app/(tabs)/_layout.jsx
git commit -m "feat(mobile): add tactical.jsx (react-native-maps) and MERCADOS + TÁCTICO tabs"
```
