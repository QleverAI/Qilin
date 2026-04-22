import { ScrollView, View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { useState, useCallback }  from 'react'
import { router }                 from 'expo-router'
import { useSafeAreaInsets }      from 'react-native-safe-area-context'
import { useQilinData }           from '../../hooks/useQilinData'
import { useNewsFeed }            from '../../hooks/useNewsFeed'
import { useDocsFeed }            from '../../hooks/useDocsFeed'
import { useSocialFeed }          from '../../hooks/useSocialFeed'
import { useSecFeed }             from '../../hooks/useSecFeed'
import { StatTile }               from '../../components/StatTile'
import { SectionHeader }          from '../../components/SectionHeader'
import { SeverityBadge }          from '../../components/SeverityBadge'
import { C, T, SEV_COLOR }        from '../../theme'

const WS_COLOR = { live: C.green, connecting: C.amber, reconnecting: C.amber, error: C.red }
const WS_LABEL = { live: 'En vivo', connecting: 'Conectando', reconnecting: 'Reconectando', error: 'Error' }

function fmt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function AlertRow({ alert }) {
  return (
    <View style={s.alertRow}>
      <View style={[s.alertStripe, { backgroundColor: SEV_COLOR[alert.severity] || C.txt3 }]} />
      <View style={{ flex: 1, paddingVertical: 12, paddingRight: 16 }}>
        <Text style={s.alertTitle} numberOfLines={2}>{alert.title || alert.rule || 'Alerta'}</Text>
        <Text style={s.alertMeta}>{alert.zone || '—'} · {fmt(alert.time)}</Text>
      </View>
      <SeverityBadge severity={alert.severity} />
    </View>
  )
}

function NewsRow({ article }) {
  return (
    <View style={s.newsRow}>
      <View style={{ flex: 1, paddingVertical: 12, paddingLeft: 16 }}>
        <Text style={s.newsTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={s.newsMeta}>{article.source} · {fmt(article.time)}</Text>
      </View>
      <SeverityBadge severity={article.severity} />
    </View>
  )
}

function QuickLink({ label, count, color, onPress }) {
  return (
    <Pressable style={s.quickLink} onPress={onPress}>
      <Text style={s.quickLabel}>{label}</Text>
      {count != null && <Text style={[s.quickCount, color && { color }]}>{count}</Text>}
      <Text style={s.quickChevron}>›</Text>
    </Pressable>
  )
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const [refreshing, setRefreshing] = useState(false)

  const { aircraft, vessels, alerts, wsStatus } = useQilinData()
  const { articles } = useNewsFeed()
  const { documents } = useDocsFeed()
  const { posts }     = useSocialFeed()
  const { filings }   = useSecFeed()

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const highAlerts  = alerts.filter(a => a.severity === 'high')
  const recentNews  = articles.slice(0, 4)
  const milAircraft = aircraft.filter(a => a.type === 'military' || a.category === 'military')

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Qilin</Text>
        <Text style={s.subtitle}>Inteligencia Geopolítica</Text>
        <View style={s.wsBadge}>
          <View style={[s.wsDot, { backgroundColor: WS_COLOR[wsStatus] || C.amber }]} />
          <Text style={[s.wsLabel, { color: WS_COLOR[wsStatus] || C.amber }]}>
            {WS_LABEL[wsStatus] || wsStatus}
          </Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <StatTile value={aircraft.length} label="Aeronaves" color={C.cyan} />
        <StatTile value={milAircraft.length} label="Militares" color={C.red} />
        <StatTile value={highAlerts.length} label="Alertas altas" color={highAlerts.length > 0 ? C.red : C.txt2} />
      </View>

      {highAlerts.length > 0 && (
        <>
          <SectionHeader title="Alertas activas" count={highAlerts.length} />
          <View style={s.card}>
            {highAlerts.slice(0, 5).map((a, i) => (
              <View key={a.id ?? i}>
                <AlertRow alert={a} />
                {i < Math.min(highAlerts.length, 5) - 1 && <View style={s.sep} />}
              </View>
            ))}
          </View>
        </>
      )}

      {recentNews.length > 0 && (
        <>
          <SectionHeader title="Noticias recientes" count={articles.length} />
          <View style={s.card}>
            {recentNews.map((n, i) => (
              <View key={n.id ?? i}>
                <Pressable onPress={() => router.push('/(tabs)/news')}>
                  <NewsRow article={n} />
                </Pressable>
                {i < recentNews.length - 1 && <View style={[s.sep, { marginLeft: 16 }]} />}
              </View>
            ))}
          </View>
        </>
      )}

      <SectionHeader title="Acceso rápido" />
      <View style={s.card}>
        <QuickLink
          label="Mapa táctico"
          count={`${aircraft.length} aeronaves`}
          onPress={() => router.push('/(tabs)/tactical')}
        />
        <View style={s.sep} />
        <QuickLink
          label="Documentos"
          count={documents.length || null}
          onPress={() => router.push('/(tabs)/documents')}
        />
        <View style={s.sep} />
        <QuickLink
          label="Social"
          count={posts.length || null}
          onPress={() => router.push('/(tabs)/social')}
        />
        <View style={s.sep} />
        <QuickLink
          label="Mercados SEC"
          count={filings.length || null}
          onPress={() => router.push('/(tabs)/markets')}
        />
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg0 },
  header:      { paddingHorizontal: 16, paddingBottom: 16 },
  title:       { ...T.largeTitle },
  subtitle:    { ...T.footnote, marginTop: 2 },
  wsBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  wsDot:       { width: 8, height: 8, borderRadius: 4 },
  wsLabel:     { fontSize: 13, fontWeight: '500' },
  statsRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  card:        { marginHorizontal: 16, backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  sep:         { height: StyleSheet.hairlineWidth, backgroundColor: C.separator },
  alertRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 16 },
  alertStripe: { width: 3, alignSelf: 'stretch', borderRadius: 1.5 },
  alertTitle:  { fontSize: 15, fontWeight: '500', color: '#ffffff', lineHeight: 20 },
  alertMeta:   { fontSize: 13, color: 'rgba(235,235,245,0.6)', marginTop: 2 },
  newsRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 },
  newsTitle:   { fontSize: 15, fontWeight: '500', color: '#ffffff', lineHeight: 20 },
  newsMeta:    { fontSize: 13, color: 'rgba(235,235,245,0.6)', marginTop: 2 },
  quickLink:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  quickLabel:  { fontSize: 17, color: '#ffffff', flex: 1 },
  quickCount:  { fontSize: 15, color: 'rgba(235,235,245,0.6)' },
  quickChevron:{ fontSize: 18, color: 'rgba(235,235,245,0.3)', fontWeight: '300' },
})
