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
  const color  = SEV_COLOR[alert.severity] || C.txt3
  const isHigh = alert.severity === 'high'
  return (
    <View style={[s.alertRow, { borderLeftColor: color, backgroundColor: isHigh ? 'rgba(255,69,58,0.04)' : 'transparent' }]}>
      <View style={{ flex: 1, paddingVertical: 10, paddingRight: 12 }}>
        {alert.zone ? <Text style={s.alertDomain}>{alert.zone.toUpperCase()}</Text> : null}
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
  { key: 'map',    labelKey: 'home.quick_map',    icon: 'map-outline',           color: C.teal,   fill: C.tealFill,            route: '/(tabs)/tactical' },
  { key: 'intel',  labelKey: 'home.quick_intel',  icon: 'radio-outline',         color: C.gold,   fill: C.goldFill,            route: '/(tabs)/intel' },
  { key: 'social', labelKey: 'home.quick_social', icon: 'people-outline',        color: C.indigo, fill: 'rgba(94,92,230,0.10)', route: '/(tabs)/social' },
  { key: 'docs',   labelKey: 'home.quick_docs',   icon: 'document-text-outline', color: C.teal,   fill: C.tealFill,            route: '/(tabs)/documents' },
  { key: 'sec',    labelKey: 'home.quick_sec',    icon: 'bar-chart-outline',     color: C.red,    fill: C.redFill,             route: '/(tabs)/sec' },
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
  const { t }  = useLang()
  const insets = useSafeAreaInsets()
  const { hPad, maxContentWidth } = useBreakpoint()
  const [refreshing, setRefreshing] = useState(false)
  const [dark, setDark]             = useState(true)

  const { aircraft, alerts, wsStatus } = useQilinData()
  const { articles }  = useNewsFeed()
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

  const sepCol  = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
  const wsLabel = wsStatus === 'live'         ? t('home.ws_live')
                : wsStatus === 'connecting'   ? t('home.ws_connecting')
                : wsStatus === 'reconnecting' ? t('home.ws_reconnecting')
                : t('home.ws_error')

  return (
    <View style={[s.root, !dark && s.rootLight]}>

      {dark && <Image source={EARTH_BG} style={s.bgImage} resizeMode="cover" />}
      {dark && <View style={s.overlay} />}

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
        <View style={[s.header, { paddingTop: insets.top + 12, paddingHorizontal: hPad }]}>
          <View style={{ height: 36 }} />
          <Text style={s.headerLabel}>QILIN INTEL</Text>
          <Text style={s.headerTitle}>{t('home.title')}</Text>
          <View style={s.wsBadge}>
            <View style={[s.wsDot, { backgroundColor: WS_COLOR[wsStatus] || C.amber }]} />
            <Text style={[s.wsLabel, { color: WS_COLOR[wsStatus] || C.amber }]}>{wsLabel}</Text>
          </View>
        </View>

        <View style={[s.statsRow, { paddingHorizontal: hPad }]}>
          <StatTile value={aircraft.length}    label={t('home.stats_aircraft')}
            color={C.teal}  colorFill={C.tealFill}  colorBorder={C.tealBorder} />
          <StatTile value={milAircraft.length} label={t('home.stats_military')}
            color={C.red}   colorFill={C.redFill}   colorBorder="rgba(255,69,58,0.20)" />
          <StatTile value={highAlerts.length}  label={t('home.stats_high_alerts')}
            color={highAlerts.length > 0 ? C.red : C.gold}
            colorFill={highAlerts.length > 0 ? C.redFill : C.goldFill}
            colorBorder={highAlerts.length > 0 ? 'rgba(255,69,58,0.20)' : C.goldBorder} />
        </View>

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

        <SectionHeader title={t('home.section_quick_access')} />
        <View style={[s.section, { marginHorizontal: hPad }]}>
          {QUICK_ITEMS.map((item, i) => (
            <View key={item.key}>
              <QuickItem {...item} count={counts[item.key]} onPress={() => router.push(item.route)} />
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
