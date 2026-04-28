# Mobile Aesthetic Rework — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la estética visual de la app Qilin post-login con el sistema Editorial Oscuro (Oro + Cian, tab minimal con puntos dorados).

**Architecture:** Empezar por los tokens del tema (única fuente de verdad), luego componentes compartidos, y por último las 4 vistas principales. Cada tarea es un commit independiente. No hay test suite de UI — la verificación es visual en Expo Go.

**Tech Stack:** React Native, Expo SDK 54, expo-router 6.x, @expo/vector-icons Ionicons, StyleSheet API.

---

## Archivos afectados

| Archivo | Rol |
|---------|-----|
| `mobile/src/theme/index.js` | Tokens de color y tipografía — fuente de verdad |
| `mobile/src/components/FilterPill.jsx` | Pill de filtro activo/inactivo |
| `mobile/src/components/SectionHeader.jsx` | Label de sección |
| `mobile/src/components/SeverityBadge.jsx` | Badge de severidad con borde |
| `mobile/src/components/StatTile.jsx` | Tile de estadística con fill/border tonal |
| `mobile/src/components/PageHeader.jsx` | Cabecera de página con label de categoría |
| `mobile/src/app/(tabs)/_layout.jsx` | Tab bar personalizado con puntos |
| `mobile/src/app/(tabs)/index.jsx` | Home: header, stats, alert cards |
| `mobile/src/app/(tabs)/news.jsx` | Noticias: hero card + lista editorial |
| `mobile/src/app/(tabs)/intel.jsx` | Intel: badge LIVE, domain labels |
| `mobile/src/app/(tabs)/more.jsx` | Más: grupos y items refinados |

---

### Task 1: Actualizar tokens del tema

**Files:**
- Modify: `mobile/src/theme/index.js`

- [ ] **Step 1: Reemplazar el contenido de theme/index.js**

```js
export const C = {
  bg0:  '#08090d',
  bg1:  '#111318',
  bg2:  '#1a1d24',
  bg3:  '#22262f',
  separator: 'rgba(255,255,255,0.05)',
  txt1: '#ffffff',
  txt2: 'rgba(235,235,245,0.6)',
  txt3: 'rgba(235,235,245,0.3)',

  // Brand
  gold:        '#c8a03c',
  goldFill:    'rgba(200,160,60,0.08)',
  goldBorder:  'rgba(200,160,60,0.20)',

  // Tactical
  teal:        '#64d2ff',
  tealFill:    'rgba(100,210,255,0.07)',
  tealBorder:  'rgba(100,210,255,0.18)',

  // Semantic (mantener compatibilidad)
  blue:      '#0a84ff',
  green:     '#30d158',
  red:       '#ff453a',
  amber:     '#ffd60a',
  cyan:      '#64d2ff',
  indigo:    '#5e5ce6',
  blueFill:  'rgba(10,132,255,0.15)',
  greenFill: 'rgba(48,209,88,0.15)',
  redFill:   'rgba(255,69,58,0.10)',
  amberFill: 'rgba(255,214,10,0.10)',
  border:    'rgba(255,255,255,0.06)',
  borderMd:  'rgba(255,255,255,0.12)',
}

export const SEV_COLOR  = { high: C.red,     medium: C.amber,     low: C.green }
export const SEV_FILL   = { high: 'rgba(255,69,58,0.08)',  medium: 'rgba(255,214,10,0.08)',  low: 'rgba(48,209,88,0.08)' }
export const SEV_BORDER = { high: 'rgba(255,69,58,0.30)',  medium: 'rgba(255,214,10,0.30)',  low: 'rgba(48,209,88,0.30)' }
export const SEV_LABEL  = { high: 'ALTO',    medium: 'MEDIO',     low: 'BAJO' }

export const T = {
  largeTitle: { fontSize: 34, fontWeight: '700', color: '#ffffff', letterSpacing: 0.37 },
  title2:     { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  title3:     { fontSize: 20, fontWeight: '600', color: '#ffffff' },
  headline:   { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  body:       { fontSize: 17, fontWeight: '400', color: '#ffffff' },
  callout:    { fontSize: 16, fontWeight: '400', color: '#ffffff' },
  subhead:    { fontSize: 15, fontWeight: '400', color: '#ffffff' },
  footnote:   { fontSize: 13, fontWeight: '400', color: 'rgba(235,235,245,0.6)' },
  caption1:   { fontSize: 12, fontWeight: '400', color: 'rgba(235,235,245,0.3)' },
  mono:       { fontSize: 13, fontFamily: 'SpaceMono', color: 'rgba(235,235,245,0.6)' },
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/theme/index.js
git commit -m "feat(mobile/theme): add gold/teal tokens, update bg palette, add SEV_BORDER"
```

---

### Task 2: Actualizar FilterPill

**Files:**
- Modify: `mobile/src/components/FilterPill.jsx`

- [ ] **Step 1: Reemplazar estilos**

```jsx
import { Pressable, Text, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { C } from '../theme'

export function FilterPill({ label, active, onPress }) {
  function handle() {
    Haptics.selectionAsync()
    onPress()
  }
  return (
    <Pressable style={[s.pill, active && s.active]} onPress={handle} hitSlop={4}>
      <Text style={[s.text, active && s.textActive]}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  pill:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  active:     { backgroundColor: C.goldFill, borderColor: C.goldBorder },
  text:       { fontSize: 12, fontWeight: '600', color: 'rgba(235,235,245,0.4)' },
  textActive: { color: C.gold, fontWeight: '700' },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/FilterPill.jsx
git commit -m "feat(mobile/FilterPill): gold active state, subtle inactive border"
```

---

### Task 3: Actualizar SectionHeader

**Files:**
- Modify: `mobile/src/components/SectionHeader.jsx`

- [ ] **Step 1: Reemplazar estilos**

```jsx
import { View, Text, StyleSheet } from 'react-native'

export function SectionHeader({ title, count }) {
  return (
    <View style={s.row}>
      <Text style={s.title}>{title}</Text>
      {count != null ? <Text style={s.count}>{count}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
           paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  title: { fontSize: 10, fontWeight: '700', color: 'rgba(235,235,245,0.35)',
           textTransform: 'uppercase', letterSpacing: 2 },
  count: { fontSize: 10, color: 'rgba(235,235,245,0.25)' },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/SectionHeader.jsx
git commit -m "feat(mobile/SectionHeader): 10px uppercase tracking 2px label style"
```

---

### Task 4: Actualizar SeverityBadge

**Files:**
- Modify: `mobile/src/components/SeverityBadge.jsx`

- [ ] **Step 1: Añadir borde tonal al badge**

```jsx
import { View, Text, StyleSheet } from 'react-native'
import { SEV_COLOR, SEV_FILL, SEV_BORDER, SEV_LABEL } from '../theme'

export function SeverityBadge({ severity }) {
  const color  = SEV_COLOR[severity]  || 'rgba(235,235,245,0.3)'
  const fill   = SEV_FILL[severity]   || 'rgba(255,255,255,0.05)'
  const border = SEV_BORDER[severity] || 'rgba(235,235,245,0.10)'
  const label  = SEV_LABEL[severity]  || (severity || '').toUpperCase()
  return (
    <View style={[s.badge, { backgroundColor: fill, borderColor: border }]}>
      <Text style={[s.text, { color }]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  text:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/SeverityBadge.jsx
git commit -m "feat(mobile/SeverityBadge): add tonal border, 10px text"
```

---

### Task 5: Actualizar StatTile

**Files:**
- Modify: `mobile/src/components/StatTile.jsx`

- [ ] **Step 1: Añadir props colorFill y colorBorder, ajustar tamaño**

```jsx
import { View, Text, StyleSheet } from 'react-native'

export function StatTile({ value, label, color, colorFill, colorBorder, style }) {
  return (
    <View style={[
      s.tile,
      colorFill   && { backgroundColor: colorFill },
      colorBorder && { borderColor: colorBorder },
      style,
    ]}>
      <Text style={[s.value, color && { color }]}>{value ?? '—'}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  tile:  { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center', gap: 3,
           borderWidth: 1, borderColor: 'transparent',
           backgroundColor: 'rgba(255,255,255,0.04)' },
  value: { fontSize: 20, fontWeight: '900', color: '#ffffff', lineHeight: 24 },
  label: { fontSize: 8, fontWeight: '600', color: 'rgba(235,235,245,0.35)',
           textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/StatTile.jsx
git commit -m "feat(mobile/StatTile): colorFill/colorBorder props, 20px 900-weight number"
```

---

### Task 6: Actualizar PageHeader

**Files:**
- Modify: `mobile/src/components/PageHeader.jsx`

- [ ] **Step 1: Añadir prop `category` y ajustar tipografía y separador**

```jsx
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets }      from 'react-native-safe-area-context'
import { C }                      from '../theme'

export function PageHeader({ category, title, subtitle, right }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          {category ? <Text style={s.category}>{category}</Text> : null}
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={s.right}>{right}</View> : null}
      </View>
      <View style={s.sep} />
    </View>
  )
}

const s = StyleSheet.create({
  root:     { backgroundColor: C.bg0 },
  row:      { flexDirection: 'row', alignItems: 'flex-end',
              paddingHorizontal: 16, paddingBottom: 10 },
  category: { fontSize: 10, fontWeight: '700', color: C.gold,
              letterSpacing: 2, marginBottom: 2, textTransform: 'uppercase' },
  title:    { fontSize: 22, fontWeight: '900', color: '#ffffff',
              letterSpacing: -0.5, lineHeight: 26 },
  subtitle: { fontSize: 12, color: C.txt3, marginTop: 3 },
  right:    { paddingBottom: 4 },
  sep:      { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/PageHeader.jsx
git commit -m "feat(mobile/PageHeader): add category label, 22px 900 title, subtle separator"
```

---

### Task 7: Tab bar personalizado con puntos dorados

**Files:**
- Modify: `mobile/src/app/(tabs)/_layout.jsx`

- [ ] **Step 1: Reemplazar _layout.jsx con tab bar custom**

```jsx
import { View, Pressable, StyleSheet }     from 'react-native'
import { useEffect }                       from 'react'
import { Tabs, router }                    from 'expo-router'
import Ionicons                            from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets }               from 'react-native-safe-area-context'
import { getToken }                        from '../../hooks/apiClient'
import { prefetchNewsFeed }                from '../../hooks/useNewsFeed'
import { prefetchSocialFeed }              from '../../hooks/useSocialFeed'
import { prefetchDocsFeed }                from '../../hooks/useDocsFeed'
import { prefetchSecFeed }                 from '../../hooks/useSecFeed'
import { prefetchIntelTimeline }           from '../../hooks/useIntelTimeline'
import { prefetchMarkets }                 from '../../hooks/useMarkets'
import { prefetchPolymarket }              from '../../hooks/usePolymarketFeed'
import { prefetchSentinel }                from '../../hooks/useSentinelData'

const PRIMARY = ['index', 'tactical', 'intel', 'news', 'more']
const ICONS = {
  index:    ['home-outline',        'home'],
  tactical: ['map-outline',         'map'],
  intel:    ['radio-outline',       'radio'],
  news:     ['newspaper-outline',   'newspaper'],
  more:     ['ellipsis-horizontal', 'ellipsis-horizontal'],
}

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets()
  const routes = state.routes.filter(r => PRIMARY.includes(r.name))

  return (
    <View style={[tb.bar, { paddingBottom: insets.bottom || 12 }]}>
      {routes.map(route => {
        const idx     = state.routes.findIndex(r => r.name === route.name)
        const focused = state.index === idx
        const [off, on] = ICONS[route.name] || ['circle-outline', 'circle']
        return (
          <Pressable
            key={route.key}
            style={tb.tab}
            onPress={() => {
              const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !ev.defaultPrevented) navigation.navigate(route.name)
            }}
          >
            <Ionicons
              name={focused ? on : off}
              size={22}
              color={focused ? '#c8a03c' : 'rgba(255,255,255,0.28)'}
            />
            <View style={[tb.dot, focused && tb.dotActive]} />
          </Pressable>
        )
      })}
    </View>
  )
}

const tb = StyleSheet.create({
  bar:      { flexDirection: 'row', backgroundColor: '#08090d',
              borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8 },
  tab:      { flex: 1, alignItems: 'center', gap: 4 },
  dot:      { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  dotActive: { backgroundColor: '#c8a03c' },
})

export default function TabsLayout() {
  useEffect(() => {
    if (!getToken()) {
      router.replace('/landing')
      return
    }
    prefetchNewsFeed()
    prefetchSocialFeed()
    prefetchDocsFeed()
    prefetchSecFeed()
    prefetchIntelTimeline()
    prefetchMarkets()
    prefetchPolymarket()
    prefetchSentinel()
  }, [])

  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Home' }} />
      <Tabs.Screen name="tactical" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="intel"    options={{ title: 'Intel' }} />
      <Tabs.Screen name="news"     options={{ title: 'Noticias' }} />
      <Tabs.Screen name="more"     options={{ title: 'Más' }} />

      <Tabs.Screen name="chat"       options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="social"     options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="documents"  options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="sec"        options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="markets"    options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="polymarket" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="sentinel"   options={{ tabBarButton: () => null }} />
    </Tabs>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/(tabs)/_layout.jsx
git commit -m "feat(mobile/tabs): custom tab bar with gold dot indicator, no labels"
```

---

### Task 8: Rediseñar Home screen

**Files:**
- Modify: `mobile/src/app/(tabs)/index.jsx`

- [ ] **Step 1: Reemplazar index.jsx con el nuevo diseño**

```jsx
import { ScrollView, View, Text, Pressable, StyleSheet,
         RefreshControl, Image }              from 'react-native'
import { useState, useCallback }             from 'react'
import { router }                            from 'expo-router'
import { useSafeAreaInsets }                 from 'react-native-safe-area-context'
import * as Haptics                          from 'expo-haptics'
import Ionicons                              from '@expo/vector-icons/Ionicons'
import { useQilinData }                      from '../../hooks/useQilinData'
import { useNewsFeed }                       from '../../hooks/useNewsFeed'
import { useDocsFeed }                       from '../../hooks/useDocsFeed'
import { useSocialFeed }                     from '../../hooks/useSocialFeed'
import { useSecFeed }                        from '../../hooks/useSecFeed'
import { useIntelTimeline }                  from '../../hooks/useIntelTimeline'
import { useLang }                           from '../../hooks/useLanguage'
import { StatTile }                          from '../../components/StatTile'
import { SectionHeader }                     from '../../components/SectionHeader'
import { C, SEV_COLOR }                      from '../../theme'
import { useBreakpoint }                     from '../../theme/responsive'

const EARTH_BG = require('../../../assets/earth-bg.jpg')

const WS_COLOR = { live: C.green, connecting: C.amber, reconnecting: C.amber, error: C.red }

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function AlertRow({ alert }) {
  const color = SEV_COLOR[alert.severity] || C.txt3
  const isHigh = alert.severity === 'high'
  return (
    <View style={[s.alertRow, { borderLeftColor: color, backgroundColor: isHigh ? 'rgba(255,69,58,0.04)' : 'transparent' }]}>
      <View style={{ flex: 1, paddingVertical: 10, paddingRight: 12 }}>
        {alert.zone ? (
          <Text style={s.alertDomain}>{alert.zone.toUpperCase()}</Text>
        ) : null}
        <Text style={s.alertTitle} numberOfLines={2}>{alert.title || alert.rule || 'Alert'}</Text>
        <Text style={s.alertMeta}>{fmt(alert.time)}</Text>
      </View>
    </View>
  )
}

function NewsRow({ article }) {
  const color = SEV_COLOR[article.severity] || C.txt3
  return (
    <View style={[s.newsRow, { borderLeftColor: color }]}>
      <View style={{ flex: 1, paddingVertical: 10, paddingRight: 12 }}>
        <Text style={s.newsTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={s.newsMeta}>{article.source} · {fmt(article.time)}</Text>
      </View>
    </View>
  )
}

const QUICK_ITEMS = [
  { key: 'map',    labelKey: 'home.quick_map',    icon: 'map-outline',          color: C.teal,   fill: C.tealFill,  route: '/(tabs)/tactical' },
  { key: 'intel',  labelKey: 'home.quick_intel',  icon: 'radio-outline',        color: C.gold,   fill: C.goldFill,  route: '/(tabs)/intel' },
  { key: 'social', labelKey: 'home.quick_social', icon: 'people-outline',       color: C.indigo, fill: 'rgba(94,92,230,0.10)', route: '/(tabs)/social' },
  { key: 'docs',   labelKey: 'home.quick_docs',   icon: 'document-text-outline',color: C.teal,   fill: C.tealFill,  route: '/(tabs)/documents' },
  { key: 'sec',    labelKey: 'home.quick_sec',    icon: 'bar-chart-outline',    color: C.red,    fill: C.redFill,   route: '/(tabs)/sec' },
]

function QuickItem({ labelKey, icon, color, fill, count, onPress }) {
  const { t } = useLang()
  return (
    <Pressable style={s.quickItem} onPress={onPress}>
      <View style={[s.quickIcon, { backgroundColor: fill }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={s.quickLabel}>{t(labelKey)}</Text>
      {count != null && <Text style={s.quickCount}>{count}</Text>}
      <Text style={s.quickChevron}>›</Text>
    </Pressable>
  )
}

export default function HomeScreen() {
  const { t }      = useLang()
  const insets     = useSafeAreaInsets()
  const { hPad, maxContentWidth } = useBreakpoint()
  const [refreshing, setRefreshing] = useState(false)
  const [dark, setDark]             = useState(true)

  const { aircraft, vessels, alerts, wsStatus } = useQilinData()
  const { articles } = useNewsFeed()
  const { documents } = useDocsFeed()
  const { posts }     = useSocialFeed()
  const { filings }   = useSecFeed()
  const { items: intelItems } = useIntelTimeline()

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const highAlerts  = alerts.filter(a => a.severity === 'high')
  const recentNews  = articles.slice(0, 3)
  const milAircraft = aircraft.filter(a => a.type === 'military' || a.category === 'military')

  const counts = {
    map:    `${aircraft.length}`,
    intel:  intelItems.length || null,
    social: posts.length || null,
    docs:   documents.length || null,
    sec:    filings.length || null,
  }

  const titleCol = dark ? '#ffffff' : '#0a0a14'
  const cardBg   = dark ? 'rgba(17,19,24,0.90)' : 'rgba(240,240,245,0.92)'
  const sepCol   = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'

  return (
    <View style={[s.root, !dark && s.rootLight]}>

      {dark && <Image source={EARTH_BG} style={s.bgImage} resizeMode="cover" />}
      {dark && <View style={s.overlay} />}

      {/* Toggle oscuro/claro */}
      <Pressable
        style={[s.themeBtn, { top: insets.top + 10 }]}
        onPress={() => { Haptics.selectionAsync(); setDark(d => !d) }}
        hitSlop={8}
      >
        <Text style={s.themeBtnText}>{dark ? '🌙' : '☀️'}</Text>
      </Pressable>

      <ScrollView
        style={s.scrollRoot}
        contentContainerStyle={{ paddingBottom: 32, alignSelf: 'center',
          width: '100%', maxWidth: maxContentWidth }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />
        }
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 12, paddingHorizontal: hPad }]}>
          <View style={{ height: 36 }} />
          <Text style={s.headerLabel}>QILIN INTEL</Text>
          <Text style={[s.headerTitle, { color: titleCol }]}>{t('home.title')}</Text>
          <View style={s.wsBadge}>
            <View style={[s.wsDot, { backgroundColor: WS_COLOR[wsStatus] || C.amber }]} />
            <Text style={[s.wsLabel, { color: WS_COLOR[wsStatus] || C.amber }]}>
              {wsStatus === 'live' ? t('home.ws_live')
               : wsStatus === 'connecting' ? t('home.ws_connecting')
               : wsStatus === 'reconnecting' ? t('home.ws_reconnecting')
               : t('home.ws_error')}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={[s.statsRow, { paddingHorizontal: hPad }]}>
          <StatTile
            value={aircraft.length}
            label={t('home.stats_aircraft')}
            color={C.teal}
            colorFill={C.tealFill}
            colorBorder={C.tealBorder}
          />
          <StatTile
            value={milAircraft.length}
            label={t('home.stats_military')}
            color={C.red}
            colorFill={C.redFill}
            colorBorder="rgba(255,69,58,0.20)"
          />
          <StatTile
            value={highAlerts.length}
            label={t('home.stats_high_alerts')}
            color={highAlerts.length > 0 ? C.red : C.gold}
            colorFill={highAlerts.length > 0 ? C.redFill : C.goldFill}
            colorBorder={highAlerts.length > 0 ? 'rgba(255,69,58,0.20)' : C.goldBorder}
          />
        </View>

        {/* Alertas altas */}
        {highAlerts.length > 0 && (
          <>
            <SectionHeader title={t('home.section_active_alerts')} count={highAlerts.length} />
            <View style={[s.section, { marginHorizontal: hPad }]}>
              {highAlerts.slice(0, 5).map((a, i) => (
                <View key={a.id ?? i}>
                  <AlertRow alert={a} />
                  {i < Math.min(highAlerts.length, 5) - 1 && (
                    <View style={[s.sep, { backgroundColor: sepCol }]} />
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Noticias recientes */}
        {recentNews.length > 0 && (
          <>
            <SectionHeader title={t('home.section_recent_news')} count={articles.length} />
            <View style={[s.section, { marginHorizontal: hPad }]}>
              {recentNews.map((n, i) => (
                <View key={n.id ?? i}>
                  <Pressable onPress={() => router.push('/(tabs)/news')}>
                    <NewsRow article={n} />
                  </Pressable>
                  {i < recentNews.length - 1 && (
                    <View style={[s.sep, { backgroundColor: sepCol }]} />
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Acceso rápido */}
        <SectionHeader title={t('home.section_quick_access')} />
        <View style={[s.section, { marginHorizontal: hPad }]}>
          {QUICK_ITEMS.map((item, i) => (
            <View key={item.key}>
              <QuickItem
                {...item}
                count={counts[item.key]}
                onPress={() => router.push(item.route)}
              />
              {i < QUICK_ITEMS.length - 1 && (
                <View style={[s.sep, { backgroundColor: sepCol }]} />
              )}
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg0 },
  rootLight:    { backgroundColor: '#f0f2f8' },
  bgImage:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2,6,14,0.65)' },
  themeBtn:     { position: 'absolute', left: 16, zIndex: 20, width: 36, height: 36, borderRadius: 18,
                  backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  themeBtnText: { fontSize: 18 },
  scrollRoot:   { flex: 1 },
  header:       { paddingBottom: 14 },
  headerLabel:  { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 2, marginBottom: 2 },
  headerTitle:  { fontSize: 24, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5, lineHeight: 28 },
  wsBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  wsDot:        { width: 6, height: 6, borderRadius: 3 },
  wsLabel:      { fontSize: 11, fontWeight: '600' },
  statsRow:     { flexDirection: 'row', gap: 6, marginBottom: 4 },
  section:      { backgroundColor: 'rgba(17,19,24,0.75)', borderRadius: 12, overflow: 'hidden' },
  sep:          { height: 1, marginLeft: 16 },
  alertRow:     { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, paddingLeft: 12 },
  alertDomain:  { fontSize: 9, fontWeight: '700', color: C.teal, letterSpacing: 1, marginBottom: 2 },
  alertTitle:   { fontSize: 13, fontWeight: '600', color: '#ffffff', lineHeight: 18 },
  alertMeta:    { fontSize: 10, color: C.txt3, marginTop: 2 },
  newsRow:      { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 2, paddingLeft: 12 },
  newsTitle:    { fontSize: 13, fontWeight: '600', color: '#ffffff', lineHeight: 18 },
  newsMeta:     { fontSize: 10, color: C.txt3, marginTop: 2 },
  quickItem:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, gap: 10 },
  quickIcon:    { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  quickLabel:   { fontSize: 14, color: '#ffffff', flex: 1 },
  quickCount:   { fontSize: 13, color: C.txt3 },
  quickChevron: { fontSize: 18, color: 'rgba(235,235,245,0.2)', fontWeight: '300' },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/(tabs)/index.jsx
git commit -m "feat(mobile/home): editorial dark redesign — border-left cards, gold header, icon quick access"
```

---

### Task 9: Rediseñar News screen

**Files:**
- Modify: `mobile/src/app/(tabs)/news.jsx`

- [ ] **Step 1: Reemplazar news.jsx**

```jsx
import { useState, useMemo, useCallback }    from 'react'
import { View, Text, TextInput, Pressable,
         StyleSheet, FlatList, ScrollView,
         Image, RefreshControl }             from 'react-native'
import { useNewsFeed }                       from '../../hooks/useNewsFeed'
import { useProfile }                        from '../../hooks/useProfile'
import { useLang }                           from '../../hooks/useLanguage'
import { PageHeader }                        from '../../components/PageHeader'
import { FilterPill }                        from '../../components/FilterPill'
import { SeverityBadge }                     from '../../components/SeverityBadge'
import { EmptyState }                        from '../../components/EmptyState'
import { C, SEV_COLOR }                      from '../../theme'
import { useBreakpoint }                     from '../../theme/responsive'

const SEV_FILTERS = ['all', 'high', 'medium', 'low']

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function HeroCard({ article, onPress }) {
  return (
    <Pressable style={s.heroCard} onPress={onPress}>
      <Image source={{ uri: article.image_url }} style={s.heroImg} resizeMode="cover" />
      <View style={s.heroOverlay} />
      <View style={s.heroBody}>
        <View style={s.heroTop}>
          <SeverityBadge severity={article.severity} />
          <Text style={s.heroPub}>{article.source} · {fmt(article.time)}</Text>
        </View>
        <Text style={s.heroTitle} numberOfLines={3}>{article.title}</Text>
      </View>
    </Pressable>
  )
}

function NewsListItem({ article, expanded, onPress }) {
  const color = SEV_COLOR[article.severity] || C.txt3
  return (
    <Pressable
      style={[s.listItem, { borderLeftColor: color, backgroundColor: expanded ? 'rgba(255,255,255,0.03)' : 'transparent' }]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle} numberOfLines={expanded ? undefined : 2}>{article.title}</Text>
        {expanded && article.summary ? (
          <Text style={s.listSummary}>{article.summary}</Text>
        ) : null}
        <Text style={s.listMeta}>{article.source} · {fmt(article.time)}</Text>
      </View>
    </Pressable>
  )
}

export default function NewsScreen() {
  const { t } = useLang()
  const { profile } = useProfile()
  const hasTopics = (profile?.topics?.length || 0) > 0

  const [topicsOnly,  setTopicsOnly]  = useState(false)
  const [sevFilter,   setSevFilter]   = useState('all')
  const [zoneFilter,  setZoneFilter]  = useState('all')
  const [search,      setSearch]      = useState('')
  const [expanded,    setExpanded]    = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)

  const { articles, zones, loading } = useNewsFeed({ topicsOnly: topicsOnly && hasTopics })
  const { hPad } = useBreakpoint()

  const allZones = ['all', ...zones]
  const SEV_LABEL = { all: t('common.all'), high: t('common.high'), medium: t('common.medium'), low: t('common.low') }

  const filtered = useMemo(() => articles.filter(n => {
    if (sevFilter !== 'all' && n.severity !== sevFilter) return false
    if (zoneFilter !== 'all' && !(n.zones || []).includes(zoneFilter)) return false
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [articles, sevFilter, zoneFilter, search])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const activeTopicsOnly = topicsOnly && hasTopics

  return (
    <View style={s.root}>
      <PageHeader
        category="NOTICIAS"
        title={t('news.title')}
        subtitle={t('news.count', { n: filtered.length })}
      />

      <View style={[s.searchWrap, { paddingHorizontal: hPad }]}>
        <TextInput
          style={s.search}
          placeholder={t('news.search')}
          placeholderTextColor={C.txt3}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pillRow}
        contentContainerStyle={{ paddingHorizontal: hPad, gap: 8, paddingBottom: 8 }}
      >
        {hasTopics && (
          <>
            <Pressable
              style={[s.myFeedPill, activeTopicsOnly && s.myFeedActive]}
              onPress={() => setTopicsOnly(v => !v)}
            >
              <Text style={[s.myFeedText, activeTopicsOnly && s.myFeedTextActive]}>
                {activeTopicsOnly ? '◉' : '○'} {t('news.my_feed')}
              </Text>
            </Pressable>
            <View style={s.pillDivider} />
          </>
        )}
        {SEV_FILTERS.map(f => (
          <FilterPill key={f} label={SEV_LABEL[f]} active={sevFilter === f} onPress={() => setSevFilter(f)} />
        ))}
        <View style={s.pillDivider} />
        {allZones.map(z => (
          <FilterPill key={z} label={z === 'all' ? t('common.allF') : z} active={zoneFilter === z} onPress={() => setZoneFilter(z)} />
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={a => String(a.id)}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        renderItem={({ item, index }) => {
          const isHero = index === 0 && !!item.image_url
          if (isHero) {
            return <HeroCard article={item} onPress={() => setExpanded(expanded === item.id ? null : item.id)} />
          }
          return (
            <View>
              <NewsListItem
                article={item}
                expanded={expanded === item.id}
                onPress={() => setExpanded(expanded === item.id ? null : item.id)}
              />
              <View style={s.sep} />
            </View>
          )
        }}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '📰'}
            title={loading ? t('news.loading') : activeTopicsOnly ? t('news.topics_empty') : t('news.empty')}
            subtitle={loading || activeTopicsOnly ? null : t('news.suggest')}
          />
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg0 },
  searchWrap:   { paddingTop: 10, paddingBottom: 4 },
  search:       { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8,
                  paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#ffffff' },
  pillRow:      { flexGrow: 0, paddingTop: 8 },
  pillDivider:  { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'center', height: 18 },
  myFeedPill:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  myFeedActive: { backgroundColor: C.goldFill, borderColor: C.goldBorder },
  myFeedText:   { fontSize: 12, fontWeight: '600', color: C.txt2, fontFamily: 'SpaceMono' },
  myFeedTextActive: { color: C.gold },
  heroCard:     { borderRadius: 12, overflow: 'hidden', marginBottom: 4, height: 200 },
  heroImg:      { width: '100%', height: '100%', position: 'absolute' },
  heroOverlay:  { position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(8,9,13,0.7)' },
  heroBody:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, gap: 6 },
  heroTop:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroPub:      { fontSize: 10, color: 'rgba(255,255,255,0.5)', flex: 1 },
  heroTitle:    { fontSize: 16, fontWeight: '700', color: '#ffffff', lineHeight: 22 },
  listItem:     { paddingVertical: 11, paddingLeft: 12, paddingRight: 4, borderLeftWidth: 2 },
  listTitle:    { fontSize: 13, fontWeight: '600', color: '#ffffff', lineHeight: 18, marginBottom: 4 },
  listSummary:  { fontSize: 12, color: C.txt2, lineHeight: 17, marginBottom: 4 },
  listMeta:     { fontSize: 10, color: C.txt3 },
  sep:          { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 16 },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/(tabs)/news.jsx
git commit -m "feat(mobile/news): editorial list — hero card, border-left severity, gold filters"
```

---

### Task 10: Rediseñar Intel screen

**Files:**
- Modify: `mobile/src/app/(tabs)/intel.jsx`

- [ ] **Step 1: Actualizar PageHeader call, añadir LIVE badge, y domain labels en cards**

Localizar y reemplazar el bloque `return (` del componente `IntelScreen` con:

```jsx
  // Badge LIVE para el header
  const liveBadge = (
    <View style={s.liveBadge}>
      <View style={s.liveDot} />
      <Text style={s.liveText}>LIVE</Text>
    </View>
  )

  return (
    <View style={s.root}>
      <PageHeader
        category="INTEL"
        title={t('intel.title')}
        subtitle={`${t('intel.count', { n: filtered.length })} · 24h: ${stats24h.masters}M / ${stats24h.findings7}F≥7`}
        right={liveBadge}
      />
      {/* resto del JSX sin cambios */}
```

- [ ] **Step 2: Actualizar `MasterCard` para añadir domain label en teal**

Reemplazar el componente `MasterCard`:

```jsx
function MasterCard({ item }) {
  const color = sevColor(item.severity || 0)
  return (
    <View style={[s.card, s.masterCard, { borderLeftColor: color }]}>
      <View style={s.cardTop}>
        <View style={[s.badge, { backgroundColor: C.blueFill, borderColor: C.blue }]}>
          <Text style={[s.badgeText, { color: C.blue }]}>MASTER</Text>
        </View>
        <Text style={s.cardTime}>{fmtTime(item.time)}</Text>
      </View>
      {item.event_type ? (
        <Text style={s.domainLabel}>{item.event_type.toUpperCase()}</Text>
      ) : null}
      {item.headline ? (
        <Text style={s.headline}>{item.headline}</Text>
      ) : null}
      <View style={s.metaRow}>
        {item.zone      ? <Text style={s.metaPill}>{item.zone}</Text> : null}
        {item.severity != null ? (
          <Text style={[s.metaPill, { color, borderColor: color }]}>SEV {item.severity}</Text>
        ) : null}
        {item.confidence != null ? (
          <Text style={s.metaPillMuted}>conf {item.confidence}</Text>
        ) : null}
      </View>
      {item.summary ? (
        <Text style={s.body}>{item.summary}</Text>
      ) : null}
      {item.recommended_action ? (
        <View style={s.recoBlock}>
          <Text style={s.recoLabel}>Acción recomendada</Text>
          <Text style={s.recoBody}>{item.recommended_action}</Text>
        </View>
      ) : null}
      {Array.isArray(item.tags) && item.tags.length > 0 ? (
        <View style={s.tagsRow}>
          {item.tags.slice(0, 6).map((tag, i) => (
            <Text key={i} style={s.tag}>#{tag}</Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}
```

Reemplazar el componente `FindingCard`:

```jsx
function FindingCard({ item }) {
  const color = agentColor(item.agent_name)
  const score = item.anomaly_score || 0
  const domain = (item.agent_name || '').replace('_agent', '').toUpperCase()
  return (
    <View style={[s.card, { borderLeftColor: color }]}>
      <View style={s.cardTop}>
        <View style={[s.badge, { borderColor: color }]}>
          <Text style={[s.badgeText, { color }]}>{domain || 'AGENT'}</Text>
        </View>
        <Text style={s.scoreLabel}>Score</Text>
        <Text style={[s.scoreValue, { color: sevColor(score) }]}>{score}</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.cardTime}>{fmtTime(item.time)}</Text>
      </View>
      {item.summary ? (
        <Text style={s.body}>{item.summary}</Text>
      ) : null}
    </View>
  )
}
```

- [ ] **Step 3: Añadir estilos nuevos al StyleSheet de intel.jsx**

Añadir estos estilos al `StyleSheet.create({...})` existente:

```js
  liveBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: C.goldFill, borderWidth: 1, borderColor: C.goldBorder,
                borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  liveDot:    { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.gold },
  liveText:   { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 1 },
  domainLabel:{ fontSize: 9, fontWeight: '700', color: C.teal, letterSpacing: 1.5,
                textTransform: 'uppercase', marginBottom: -2 },
```

Y actualizar los estilos `card` y `masterCard` existentes:

```js
  card:       { backgroundColor: C.bg1, borderRadius: 12, padding: 14, gap: 8, borderLeftWidth: 3 },
  masterCard: { backgroundColor: C.bg2 },
```

- [ ] **Step 4: Añadir import de C.gold/C.teal** — ya están en C desde la Task 1, verificar que `import { C, T } from '../../theme'` no necesita cambios.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/app/(tabs)/intel.jsx
git commit -m "feat(mobile/intel): LIVE badge gold, domain labels teal, PageHeader category"
```

---

### Task 11: Rediseñar More screen

**Files:**
- Modify: `mobile/src/app/(tabs)/more.jsx`

- [ ] **Step 1: Reemplazar more.jsx**

```jsx
import { View, Text, Pressable, StyleSheet, ScrollView,
         SafeAreaView }                                from 'react-native'
import { router }                                      from 'expo-router'
import Ionicons                                        from '@expo/vector-icons/Ionicons'
import * as Haptics                                    from 'expo-haptics'
import { PageHeader }                                  from '../../components/PageHeader'
import { useLang }                                     from '../../hooks/useLanguage'
import { C }                                           from '../../theme'
import { useBreakpoint }                               from '../../theme/responsive'
import { setToken }                                    from '../../hooks/apiClient'
import * as SecureStore                                from 'expo-secure-store'

function MenuItem({ icon, label, onPress, color = C.teal }) {
  const fill = color === C.red ? C.redFill
    : color === C.gold ? C.goldFill
    : color === C.green ? C.greenFill
    : `${color}15`
  return (
    <Pressable
      style={s.item}
      onPress={() => {
        Haptics.selectionAsync()
        onPress()
      }}
    >
      <View style={[s.iconBox, { backgroundColor: fill }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[s.label, color === C.red && { color: C.red }]}>{label}</Text>
      {color !== C.red && <Text style={s.chevron}>›</Text>}
    </Pressable>
  )
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  )
}

export default function MoreScreen() {
  const { t } = useLang()
  const { maxContentWidth } = useBreakpoint()

  const go = (path) => () => router.push(path)

  async function handleLogout() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    setToken(null)
    await SecureStore.deleteItemAsync('qilin_token').catch(() => {})
    router.replace('/landing')
  }

  return (
    <SafeAreaView style={s.safe}>
      <PageHeader category="QILIN" title={t('tabs.more')} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 20,
          alignSelf: 'center', width: '100%', maxWidth: maxContentWidth }}
      >
        <Section title="FEEDS">
          <MenuItem icon="chatbubble-ellipses-outline" color={C.teal}   label={t('chat.title')}    onPress={go('/(tabs)/chat')} />
          <View style={s.sep} />
          <MenuItem icon="people-outline"              color={C.indigo} label={t('social.title')}  onPress={go('/(tabs)/social')} />
          <View style={s.sep} />
          <MenuItem icon="document-text-outline"       color={C.teal}   label={t('docs.title')}    onPress={go('/(tabs)/documents')} />
        </Section>

        <Section title="MERCADOS">
          <MenuItem icon="trending-up-outline"   color={C.green}  label={t('markets.title')}    onPress={go('/(tabs)/markets')} />
          <View style={s.sep} />
          <MenuItem icon="pie-chart-outline"     color={C.amber}  label={t('polymarket.title')} onPress={go('/(tabs)/polymarket')} />
          <View style={s.sep} />
          <MenuItem icon="bar-chart-outline"     color={C.red}    label={t('sec.title')}        onPress={go('/(tabs)/sec')} />
        </Section>

        <Section title="OBSERVACIÓN">
          <MenuItem icon="planet-outline" color={C.teal} label={t('sentinel.title')} onPress={go('/(tabs)/sentinel')} />
        </Section>

        <Section title={t('profile.account').toUpperCase()}>
          <MenuItem icon="person-circle-outline" color={C.gold}  label={t('profile.title')}  onPress={go('/profile')} />
          <View style={s.sep} />
          <MenuItem icon="card-outline"          color={C.green} label={t('plans.title')}    onPress={go('/plans')} />
          <View style={s.sep} />
          <MenuItem icon="log-out-outline"       color={C.red}   label={t('profile.logout')} onPress={handleLogout} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg0 },
  section:      { gap: 5 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.txt3,
                  letterSpacing: 2, paddingHorizontal: 4 },
  card:         { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden' },
  item:         { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 12, paddingVertical: 11, gap: 10 },
  iconBox:      { width: 28, height: 28, borderRadius: 7,
                  alignItems: 'center', justifyContent: 'center' },
  label:        { flex: 1, fontSize: 14, color: '#ffffff', fontWeight: '500' },
  chevron:      { fontSize: 18, color: 'rgba(255,255,255,0.2)', fontWeight: '300' },
  sep:          { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 50 },
})
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/app/(tabs)/more.jsx
git commit -m "feat(mobile/more): editorial dark — tonal icon boxes, compact items, gold account section"
```

---

### Task 12: Push al servidor

- [ ] **Step 1: Push rama al servidor**

```bash
git push origin feat/tactical-map-ios
```

- [ ] **Step 2: Verificar en Expo Go**

Abrir Expo Go, escanear QR, verificar:
- Tab bar: iconos sin labels, punto dorado bajo tab activo, fondo `#08090d`
- Home: label "QILIN INTEL" en dorado, stat tiles con bordes tonales, cards con borde izquierdo de severidad
- News: primer artículo con imagen = hero card, resto = lista compacta con borde izquierdo
- Intel: badge LIVE dorado, domain labels en teal encima de los títulos
- Más: grupos compactos con iconos tonales, separadores sutiles
