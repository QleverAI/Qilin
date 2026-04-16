# Qilin Mobile — Real Data & New Tabs Design

**Date:** 2026-04-16
**Feature:** Conectar la app móvil (Expo/React Native) a la API real, añadir tab MERCADOS y tab TÁCTICO con mapa.

---

## Goal

Eliminar todos los mocks de la app móvil y conectarla a los mismos endpoints que el frontend web. Añadir dos pantallas nuevas: MERCADOS (filings SEC) y TÁCTICO (mapa con aeronaves). El resultado es una app móvil funcional con datos en tiempo real en iOS y Android.

---

## Architecture

```
login.jsx
  → POST /auth/login → access_token
  → SecureStore.setItemAsync('qilin_token', token)
  → router.replace('/(tabs)')

mobile/src/hooks/apiClient.js  (singleton)
  let _token = null
  export async function loadToken()   // lee SecureStore una vez al arrancar
  export async function authFetch(path)  // fetch con Authorization: Bearer {token}

mobile/src/app/_layout.jsx
  → llama loadToken() en useEffect al montar

useQilinData.js  (WebSocket)
  → lee token del singleton en lugar del null hardcodeado

Hooks de datos (polling 60s):
  useNewsFeed    → GET /news/feed?limit=100
  useDocsFeed    → GET /docs/feed?limit=100
  useSocialFeed  → GET /social/feed?limit=100
  useSecFeed     → GET /sec/feed?limit=100 + /sec/sources

Pantallas actualizadas:
  news.jsx       → useNewsFeed  (elimina MOCK_NEWS)
  documents.jsx  → useDocsFeed  (elimina MOCK_DOCUMENTS)
  social.jsx     → useSocialFeed (elimina MOCK_POSTS, TRENDING_TOPICS)
  index.jsx      → todos los hooks reales + card MERCADOS

Pantallas nuevas:
  tactical.jsx   → react-native-maps + markers aeronaves + panel inferior
  markets.jsx    → useSecFeed + FlatList + Modal detalle
```

---

## New Packages

```json
"expo-secure-store": "~14.0.0",
"react-native-maps": "~1.18.0"
```

`.env.local` añade:
```
EXPO_PUBLIC_GOOGLE_MAPS_KEY=  # requerido para Android; iOS usa Apple Maps
```

---

## File Structure

**Nuevos:**
- `mobile/src/hooks/apiClient.js` — singleton de auth (loadToken, authFetch)
- `mobile/src/hooks/useNewsFeed.js`
- `mobile/src/hooks/useDocsFeed.js`
- `mobile/src/hooks/useSocialFeed.js`
- `mobile/src/hooks/useSecFeed.js`
- `mobile/src/app/(tabs)/tactical.jsx`
- `mobile/src/app/(tabs)/markets.jsx`

**Modificados:**
- `mobile/package.json` — añadir dependencias
- `mobile/src/app/login.jsx` — guardar token en SecureStore
- `mobile/src/app/_layout.jsx` — llamar loadToken() al montar
- `mobile/src/app/(tabs)/_layout.jsx` — añadir tabs TÁCTICO y MERCADOS
- `mobile/src/app/(tabs)/index.jsx` — hooks reales, card MERCADOS
- `mobile/src/app/(tabs)/news.jsx` — useNewsFeed en lugar de MOCK_NEWS
- `mobile/src/app/(tabs)/documents.jsx` — useDocsFeed en lugar de MOCK_DOCUMENTS
- `mobile/src/app/(tabs)/social.jsx` — useSocialFeed en lugar de MOCK_POSTS
- `mobile/src/hooks/useQilinData.js` — token desde apiClient singleton

---

## Sección 1: Auth (apiClient.js + login + _layout)

### apiClient.js

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

export async function authFetch(path) {
  const headers = _token ? { Authorization: `Bearer ${_token}` } : {}
  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
```

### login.jsx (cambios)
- Importar `setToken` de `apiClient.js`
- En `handleLogin`, tras obtener `access_token`: llamar `setToken(access_token)` en lugar del TODO

### _layout.jsx (root)
- Importar `loadToken` de `apiClient.js`
- Llamar `await loadToken()` en `useEffect([], [])` antes de mostrar la app

---

## Sección 2: Hooks de datos

Todos siguen el mismo patrón:

```javascript
export function useXxxFeed() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      try {
        const raw = await authFetch('/xxx/feed?limit=100')
        if (!cancelled) setData(raw || [])
      } catch (err) {
        console.warn('[useXxxFeed]', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // derivados con useMemo...
  return { data, loading }
}
```

**useNewsFeed** — devuelve `{ articles, zones, sources, loading }`
**useDocsFeed** — devuelve `{ documents, orgTypes, loading }`
**useSocialFeed** — devuelve `{ posts, platforms, zones, loading }`
**useSecFeed** — dos fetches en Promise.all (`/sec/feed` + `/sec/sources`), devuelve `{ filings, sources, sectors, failingSources, loading }`

---

## Sección 3: Pantallas existentes actualizadas

### news.jsx
- Eliminar `import { MOCK_NEWS }` y uso
- `const { articles, zones, loading } = useNewsFeed()`
- `ALL_ZONES` se deriva de `zones` (ya no hardcodeado desde mock)
- Añadir `ListEmptyComponent` con texto condicional: "Cargando..." si loading, "Sin noticias" si vacío

### documents.jsx
- Eliminar `import { MOCK_DOCUMENTS }` y uso
- `const { documents, loading } = useDocsFeed()`
- Estado inicial de `docs` viene de `documents` (useEffect que sincroniza cuando llegan datos)
- `pickDocument` sigue siendo local — los docs subidos se añaden al estado local encima de los del feed
- Nota: el upload real a la API queda fuera de scope (YAGNI — la API no tiene endpoint de upload de docs)

### social.jsx
- Eliminar `import { MOCK_POSTS, TRENDING_TOPICS }`
- `const { posts, platforms, zones, loading } = useSocialFeed()`
- `TRENDING_TOPICS` se elimina — la API de social no tiene endpoint de trending; se elimina la sección de tendencias o se muestra vacía
- `ALL_ZONES` derivado de `zones`

### index.jsx (home)
- Sustituir los 3 imports de mock data por los 3 hooks reales
- Añadir card MERCADOS con `onPress={() => router.push('/(tabs)/markets')}`
- Contador del card MERCADOS: número de filings del día (filings con `time` de hoy)

---

## Sección 4: MERCADOS (markets.jsx)

```
┌─────────────────────────────┐
│ $ MERCADOS          12 fil. │  ← header
├─────────────────────────────┤
│ [Defensa][Energía][Semicon] │  ← chips sector (scroll horizontal)
│ [HIGH][MEDIUM][LOW]         │  ← chips severidad
├─────────────────────────────┤
│ [LMT] 8-K MEDIUM Defensa   │
│ Lockheed Martin — 2.02,9.01│
│ 22 abr 2025                 │
├─────────────────────────────┤
│ [RTX] 8-K MEDIUM Defensa   │
│ RTX Corporation — 5.02     │
│ 17 abr 2025                 │
└─────────────────────────────┘
         ↓ tap
┌─────────────────────────────┐  Modal bottom sheet
│ ─────── (drag handle)       │
│ [LMT]  Lockheed Martin      │
│         Defensa             │
│                       MEDIUM│
│ Formulario  │ 8-K           │
│ Sector      │ Defensa       │
│ Fecha       │ 22 abr 2025   │
│ CIK         │ 0000936468    │
│ Accession   │ 0000936468... │
│ Relevancia  │ ████░░ 65     │
│ Ítems       │ 2.02, 9.01    │
│ Resumen     │ [texto...]    │
│ [VER EN EDGAR ↗]            │
└─────────────────────────────┘
```

Colores de sector: defense=rojo, energy=naranja, semiconductors=cyan, financials=verde, cyber_infra=violeta (idénticos al web).

Modal: `Modal` de React Native con `animationType="slide"`, `presentationStyle="pageSheet"` en iOS, posición absoluta bottom en Android.

---

## Sección 5: TÁCTICO (tactical.jsx)

```
┌─────────────────────────────┐
│  [Mapa híbrido fullscreen]  │
│                             │
│  🔴 (militar)  🔵 (civil)   │  ← Markers
│                             │
│  Callout al tocar:          │
│  ┌─────────────────┐        │
│  │ CALLSIGN        │        │
│  │ Alt: 35000 ft   │        │
│  │ Vel: 480 kts    │        │
│  │ MILITARY        │        │
│  └─────────────────┘        │
├─────────────────────────────┤  ← Panel inferior absoluto
│ ✈ 47  🔴 12  ⚠ 3  WS:LIVE  │
└─────────────────────────────┘
```

- `MapView` con `mapType="hybrid"` (satélite + etiquetas)
- `Marker` por aeronave: `pinColor` rojo si `type === 'military'`, cyan para el resto
- `Callout` con callsign, altitud, velocidad, tipo
- Panel inferior `position: absolute, bottom: 0`: aeronaves totales, militares, alertas HIGH activas, estado WebSocket
- Sin markers de buques (descartado)
- `initialRegion` centrado en Europa (lat: 48, lon: 10, delta: 30)

---

## Tab Layout actualizado

```javascript
const TABS = [
  { name:'index',    label:'INICIO',    icon:'◉' },
  { name:'tactical', label:'TÁCTICO',   icon:'◎' },
  { name:'news',     label:'NOTICIAS',  icon:'◈' },
  { name:'documents',label:'DOCUMENTOS',icon:'▣' },
  { name:'social',   label:'SOCIAL',    icon:'◈' },
  { name:'markets',  label:'MERCADOS',  icon:'$' },
]
```

---

## Error Handling

| Situación | Comportamiento |
|-----------|---------------|
| Token no disponible | `authFetch` envía request sin header; API devuelve 401; hook captura el error y devuelve array vacío |
| API no disponible | catch → console.warn, estado queda como estaba (no rompe la UI) |
| react-native-maps sin Google key (Android) | Mapa en blanco; los marcadores siguen funcionando |
| Aeronave sin coordenadas | Filtrar antes de renderizar marker (`aircraft.filter(a => a.lat && a.lon)`) |

---

## Out of Scope

- Upload real de documentos a la API (la pantalla DOCUMENTOS mantiene upload local)
- Trending topics en SOCIAL (la API no tiene endpoint de trending)
- Clustering de markers en TÁCTICO (suficiente para el volumen actual)
- Push notifications
- Buques en TÁCTICO (descartado explícitamente)
- Offline mode / cache persistente
