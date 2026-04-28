import { ScrollView, View, Text, Pressable, StyleSheet,
         RefreshControl, Image }               from 'react-native'
import { useState, useCallback, useMemo }      from 'react'
import { router }                              from 'expo-router'
import { useSafeAreaInsets }                   from 'react-native-safe-area-context'
import * as Haptics                            from 'expo-haptics'
import Ionicons                                from '@expo/vector-icons/Ionicons'
const DRAGON_LOGO = require('../../../assets/qilin-dragon.png')
import { useQilinData }                        from '../../hooks/useQilinData'
import { useNewsFeed }                         from '../../hooks/useNewsFeed'
import { useDocsFeed }                         from '../../hooks/useDocsFeed'
import { useSocialFeed }                       from '../../hooks/useSocialFeed'
import { useSecFeed }                          from '../../hooks/useSecFeed'
import { useIntelTimeline }                    from '../../hooks/useIntelTimeline'
import { useLang }                             from '../../hooks/useLanguage'
import { SectionHeader }                       from '../../components/SectionHeader'
import { LangToggle }                          from '../../components/LangToggle'
import { C, SEV_COLOR }                        from '../../theme'
import { useBreakpoint }                       from '../../theme/responsive'

const WS_COLOR = { live: C.green, connecting: C.amber, reconnecting: C.amber, error: C.red }

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function fmtAgo(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 60)   return `hace ${diff}m`
  return `hace ${Math.floor(diff / 60)}h`
}

// ── Status strip ──────────────────────────────────────────────────────────────
function StatusPill({ label, value, color }) {
  return (
    <View style={sp.pill}>
      <Text style={sp.label}>{label}</Text>
      <Text style={[sp.value, { color: color || '#ffffff' }]}>{value}</Text>
    </View>
  )
}
const sp = StyleSheet.create({
  pill:  { backgroundColor: C.bg1, borderWidth: 1, borderColor: C.separator,
           borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: C.txt3,
           textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 14, fontWeight: '700' },
})

// ── Señales convergentes ──────────────────────────────────────────────────────
function SignalsCard({ signals, t }) {
  if (signals.length === 0) return null
  return (
    <View style={sg.card}>
      <View style={sg.header}>
        <View style={sg.dot} />
        <Text style={sg.title}>{t('home.signals')}</Text>
        <Text style={sg.count}>{t('home.signals_zones', { n: signals.length })}</Text>
      </View>
      {signals.map(({ zone, sources }) => (
        <View key={zone} style={sg.zone}>
          <Text style={sg.zoneName}>{zone.replace(/_/g, ' ')}</Text>
          <View style={sg.tags}>
            {sources.map(src => (
              <View key={src} style={sg.tag}>
                <Text style={sg.tagText}>{src}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}
const sg = StyleSheet.create({
  card:     { backgroundColor: 'rgba(255,69,58,0.06)', borderWidth: 1,
              borderColor: 'rgba(255,69,58,0.20)', borderLeftWidth: 3,
              borderLeftColor: C.red, borderRadius: 12, padding: 12, gap: 8 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red, flexShrink: 0 },
  title:    { fontSize: 10, fontWeight: '700', color: C.red, letterSpacing: 2,
              textTransform: 'uppercase', flex: 1 },
  count:    { fontSize: 10, color: C.txt3 },
  zone:     { backgroundColor: 'rgba(255,69,58,0.08)', borderWidth: 1,
              borderColor: 'rgba(255,69,58,0.18)', borderRadius: 8, padding: 8 },
  zoneName: { fontSize: 12, fontWeight: '700', color: '#ffffff', textTransform: 'uppercase',
              letterSpacing: 0.5, marginBottom: 5 },
  tags:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag:      { backgroundColor: 'rgba(255,69,58,0.12)', borderWidth: 1,
              borderColor: 'rgba(255,69,58,0.25)', borderRadius: 4,
              paddingHorizontal: 6, paddingVertical: 2 },
  tagText:  { fontSize: 10, color: C.red, letterSpacing: 0.3 },
})

// ── Intel card ────────────────────────────────────────────────────────────────
function IntelCard({ master, t }) {
  if (!master) return null
  const sevColor = master.severity >= 8 ? C.red : master.severity >= 6 ? C.amber : C.gold
  return (
    <View style={[ic.card, { borderLeftColor: sevColor }]}>
      <View style={ic.badge}>
        <View style={[ic.badgeDot, { backgroundColor: C.gold }]} />
        <Text style={ic.badgeText}>MASTER · {fmtAgo(master.time)}</Text>
      </View>
      {master.headline ? (
        <Text style={ic.headline} numberOfLines={3}>{master.headline}</Text>
      ) : null}
      <View style={ic.meta}>
        {master.severity != null && (
          <Text style={[ic.metaPill, { color: sevColor, borderColor: sevColor }]}>
            SEV {master.severity}
          </Text>
        )}
        {master.confidence != null && (
          <Text style={ic.metaMuted}>conf {master.confidence}</Text>
        )}
        {master.zone ? <Text style={ic.metaMuted}>{master.zone}</Text> : null}
      </View>
    </View>
  )
}
const ic = StyleSheet.create({
  card:      { backgroundColor: C.bg2, borderRadius: 12, padding: 14, gap: 8,
               borderLeftWidth: 3 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 5,
               backgroundColor: C.goldFill, borderWidth: 1, borderColor: C.goldBorder,
               borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
               alignSelf: 'flex-start' },
  badgeDot:  { width: 5, height: 5, borderRadius: 2.5 },
  badgeText: { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 1 },
  headline:  { fontSize: 15, fontWeight: '700', color: '#ffffff', lineHeight: 21 },
  meta:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaPill:  { fontSize: 11, borderWidth: 1, borderRadius: 4,
               paddingHorizontal: 6, paddingVertical: 2 },
  metaMuted: { fontSize: 11, color: C.txt3 },
})

// ── Alert row ─────────────────────────────────────────────────────────────────
function AlertRow({ alert, isLast }) {
  const color  = SEV_COLOR[alert.severity] || C.txt3
  const isHigh = alert.severity === 'high'
  return (
    <View style={[s.alertRow, { borderLeftColor: color,
      backgroundColor: isHigh ? 'rgba(255,69,58,0.04)' : 'transparent' }]}>
      <View style={s.alertInner}>
        {alert.zone ? <Text style={s.alertDomain}>{alert.zone.toUpperCase()}</Text> : null}
        <Text style={s.alertTitle} numberOfLines={2}>{alert.title || alert.rule || 'Alert'}</Text>
        <Text style={s.alertMeta}>{fmt(alert.time)}</Text>
      </View>
    </View>
  )
}

// ── News row ──────────────────────────────────────────────────────────────────
function NewsRow({ article }) {
  const color = SEV_COLOR[article.severity] || C.txt3
  return (
    <Pressable
      style={[s.newsRow, { borderLeftColor: color }]}
      onPress={() => router.push('/(tabs)/news')}
    >
      <View style={s.newsInner}>
        <Text style={s.newsTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={s.newsMeta}>{article.source} · {fmt(article.time)}</Text>
      </View>
    </Pressable>
  )
}

// ── Quick item ────────────────────────────────────────────────────────────────
const QUICK_ITEMS = [
  { key: 'map',    labelKey: 'home.quick_map',    icon: 'map-outline',           color: C.teal,   fill: C.tealFill,             route: '/(tabs)/tactical' },
  { key: 'intel',  labelKey: 'home.quick_intel',  icon: 'radio-outline',         color: C.gold,   fill: C.goldFill,             route: '/(tabs)/intel' },
  { key: 'social', labelKey: 'home.quick_social', icon: 'people-outline',        color: C.indigo, fill: 'rgba(94,92,230,0.10)', route: '/(tabs)/social' },
  { key: 'docs',   labelKey: 'home.quick_docs',   icon: 'document-text-outline', color: C.teal,   fill: C.tealFill,             route: '/(tabs)/documents' },
  { key: 'sec',    labelKey: 'home.quick_sec',    icon: 'bar-chart-outline',     color: C.red,    fill: C.redFill,              route: '/(tabs)/sec' },
]

function QuickItem({ labelKey, icon, color, fill, count, onPress }) {
  const { t } = useLang()
  return (
    <Pressable
      style={({ pressed }) => [s.quickItem, pressed && { backgroundColor: 'rgba(255,255,255,0.02)' }]}
      onPress={onPress}
    >
      <View style={[s.quickIcon, { backgroundColor: fill }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={s.quickLabel}>{t(labelKey)}</Text>
      {count != null && <Text style={s.quickCount}>{count}</Text>}
      <Text style={s.quickChevron}>›</Text>
    </Pressable>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { t }    = useLang()
  const insets   = useSafeAreaInsets()
  const { hPad, maxContentWidth } = useBreakpoint()
  const [refreshing, setRefreshing] = useState(false)

  const { aircraft, alerts, wsStatus } = useQilinData()
  const { articles }               = useNewsFeed()
  const { documents }              = useDocsFeed()
  const { posts }                  = useSocialFeed()
  const { filings }                = useSecFeed()
  const { items: intelItems }      = useIntelTimeline()

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const milAircraft  = useMemo(() => aircraft.filter(a => a.type === 'military' || a.category === 'military'), [aircraft])
  const highAlerts   = useMemo(() => alerts.filter(a => a.severity === 'high'), [alerts])
  const recentNews   = useMemo(() => articles.slice(0, 3), [articles])
  const latestMaster = useMemo(() => intelItems.find(i => i.type === 'master'), [intelItems])

  // Señales convergentes — zonas con ≥2 fuentes simultáneas
  const signals = useMemo(() => {
    const now     = Date.now()
    const win1h   = 3600000
    const zones   = {}
    const add     = (zone, src) => {
      if (!zone) return
      if (!zones[zone]) zones[zone] = new Set()
      zones[zone].add(src)
    }
    alerts.forEach(a => add(a.zone, t('home.src_alerts')))
    milAircraft.filter(a => a.zone).forEach(a => add(a.zone, t('home.src_adsb')))
    articles
      .filter(a => a.time && (now - new Date(a.time).getTime()) < win1h)
      .forEach(a => (Array.isArray(a.zones) ? a.zones : []).forEach(z => add(z, t('home.src_news'))))
    posts
      .filter(p => p.time && (now - new Date(p.time).getTime()) < win1h && p.zone)
      .forEach(p => add(p.zone, t('home.src_social')))
    return Object.entries(zones)
      .filter(([, srcs]) => srcs.size >= 2)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 4)
      .map(([zone, srcs]) => ({ zone, sources: [...srcs] }))
  }, [aircraft, milAircraft, alerts, articles, posts, t])

  const counts = {
    map:    `${aircraft.length}`,
    intel:  intelItems.length || null,
    social: posts.length     || null,
    docs:   documents.length || null,
    sec:    filings.length   || null,
  }

  const wsColor = WS_COLOR[wsStatus] || C.amber
  const wsLabel = wsStatus === 'live'         ? t('home.ws_live')
                : wsStatus === 'connecting'   ? t('home.ws_connecting')
                : wsStatus === 'reconnecting' ? t('home.ws_reconnecting')
                : t('home.ws_error')

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: 32, alignSelf: 'center',
          width: '100%', maxWidth: maxContentWidth }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />
        }
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 12, paddingHorizontal: hPad }]}>
          <View style={s.headerRow}>
            <Image source={DRAGON_LOGO} style={s.logo} resizeMode="contain" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.headerLabel}>QILIN INTEL</Text>
              <Text style={s.headerTitle}>{t('home.title')}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/profile')}
              hitSlop={8}
              style={s.userBtn}
            >
              <Ionicons name="person-circle-outline" size={26} color={C.txt2} />
            </Pressable>
            <LangToggle />
          </View>
          <View style={s.wsBadge}>
            <View style={[s.wsDot, { backgroundColor: wsColor }]} />
            <Text style={[s.wsText, { color: wsColor }]}>{wsLabel}</Text>
          </View>
        </View>

        {/* Status strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: hPad, gap: 8, paddingBottom: 12 }}
        >
          <StatusPill label={t('home.status_adsb')}     value={aircraft.length}    color={C.teal} />
          <StatusPill label={t('home.status_military')} value={milAircraft.length} color={milAircraft.length > 0 ? C.red : C.txt2} />
          <StatusPill label={t('home.status_alerts')}   value={alerts.length}      color={alerts.length > 0 ? C.red : C.green} />
          <StatusPill label={t('home.status_intel')}    value={intelItems.length}  color={C.gold} />
          <StatusPill label={t('home.status_news')}     value={articles.length}    color={C.txt2} />
        </ScrollView>

        {/* Stat tiles */}
        <View style={[s.statsRow, { paddingHorizontal: hPad }]}>
          <View style={[s.statTile, { borderColor: C.tealBorder, backgroundColor: C.tealFill }]}>
            <Text style={[s.statValue, { color: C.teal }]}>{aircraft.length}</Text>
            <Text style={s.statLabel}>{t('home.stats_aircraft')}</Text>
          </View>
          <View style={[s.statTile, { borderColor: 'rgba(255,69,58,0.20)', backgroundColor: C.redFill }]}>
            <Text style={[s.statValue, { color: C.red }]}>{milAircraft.length}</Text>
            <Text style={s.statLabel}>{t('home.stats_military')}</Text>
          </View>
          <View style={[s.statTile, {
            borderColor: highAlerts.length > 0 ? 'rgba(255,69,58,0.20)' : C.goldBorder,
            backgroundColor: highAlerts.length > 0 ? C.redFill : C.goldFill,
          }]}>
            <Text style={[s.statValue, { color: highAlerts.length > 0 ? C.red : C.gold }]}>
              {highAlerts.length}
            </Text>
            <Text style={s.statLabel}>{t('home.stats_high_alerts')}</Text>
          </View>
        </View>

        {/* Señales convergentes */}
        {signals.length > 0 && (
          <View style={{ paddingHorizontal: hPad, marginBottom: 8 }}>
            <SignalsCard signals={signals} t={t} />
          </View>
        )}

        {/* Último análisis Intel */}
        {latestMaster && (
          <>
            <SectionHeader title={t('home.section_intel_latest')} />
            <View style={{ paddingHorizontal: hPad, marginBottom: 4 }}>
              <IntelCard master={latestMaster} t={t} />
            </View>
          </>
        )}

        {/* Alertas activas */}
        {highAlerts.length > 0 && (
          <>
            <SectionHeader title={t('home.section_active_alerts')} count={highAlerts.length} />
            <View style={[s.section, { marginHorizontal: hPad }]}>
              {highAlerts.slice(0, 5).map((a, i) => (
                <View key={a.id ?? i}>
                  <AlertRow alert={a} />
                  {i < Math.min(highAlerts.length, 5) - 1 && <View style={s.sep} />}
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
                  <NewsRow article={n} />
                  {i < recentNews.length - 1 && <View style={s.sep} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Acceso rápido */}
        <SectionHeader title={t('home.section_quick_access')} />
        <View style={[s.section, { marginHorizontal: hPad }]}>
          {QUICK_ITEMS.map(({ key, route, ...rest }, i) => (
            <View key={key}>
              <QuickItem {...rest} count={counts[key]} onPress={() => router.push(route)} />
              {i < QUICK_ITEMS.length - 1 && <View style={s.sep} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg0 },
  scroll:     { flex: 1 },
  header:     { paddingBottom: 14 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  logo:       { width: 40, height: 40 },
  headerLabel:{ fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 2, marginBottom: 1 },
  headerTitle:{ fontSize: 22, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5, lineHeight: 26 },
  userBtn:    { padding: 2 },
  wsBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  wsDot:      { width: 6, height: 6, borderRadius: 3 },
  wsText:     { fontSize: 11, fontWeight: '600' },
  statsRow:   { flexDirection: 'row', gap: 6, marginBottom: 12 },
  statTile:   { flex: 1, borderRadius: 10, padding: 10, borderWidth: 1 },
  statValue:  { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  statLabel:  { fontSize: 8, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',
                color: C.txt3, marginTop: 2 },
  section:    { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
  sep:        { height: 1, backgroundColor: C.separator, marginLeft: 16 },
  alertRow:   { borderLeftWidth: 3, paddingLeft: 12 },
  alertInner: { paddingVertical: 10, paddingRight: 12 },
  alertDomain:{ fontSize: 9, fontWeight: '700', color: C.teal, letterSpacing: 1,
                textTransform: 'uppercase', marginBottom: 2 },
  alertTitle: { fontSize: 13, fontWeight: '600', color: '#ffffff', lineHeight: 18 },
  alertMeta:  { fontSize: 10, color: C.txt3, marginTop: 2 },
  newsRow:    { borderLeftWidth: 2, paddingLeft: 12 },
  newsInner:  { paddingVertical: 10, paddingRight: 12 },
  newsTitle:  { fontSize: 13, fontWeight: '600', color: '#ffffff', lineHeight: 18 },
  newsMeta:   { fontSize: 10, color: C.txt3, marginTop: 2 },
  quickItem:  { flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 12, paddingVertical: 11, gap: 10 },
  quickIcon:  { width: 28, height: 28, borderRadius: 7,
                alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 14, color: '#ffffff', flex: 1 },
  quickCount: { fontSize: 13, color: C.txt3 },
  quickChevron:{ fontSize: 18, color: 'rgba(235,235,245,0.2)', fontWeight: '300' },
})
