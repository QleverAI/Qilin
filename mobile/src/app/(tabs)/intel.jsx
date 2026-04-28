import { useState, useMemo, useCallback }              from 'react'
import { View, Text, Pressable, StyleSheet, FlatList,
         ScrollView, RefreshControl }                  from 'react-native'
import * as Haptics                                    from 'expo-haptics'
import { useIntelTimeline }                            from '../../hooks/useIntelTimeline'
import { useProfile }                                  from '../../hooks/useProfile'
import { useLang }                                     from '../../hooks/useLanguage'
import { PageHeader }                                  from '../../components/PageHeader'
import { FilterPill }                                  from '../../components/FilterPill'
import { EmptyState }                                  from '../../components/EmptyState'
import { C, T }                                        from '../../theme'
import { useBreakpoint }                               from '../../theme/responsive'

const DOMAIN_KEYS = ['all', 'adsb', 'maritime', 'news', 'social']
const HOURS = [24, 48, 72, 168]
const MIN_SCORES = [0, 5, 7, 9]

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now - d) / 60000)
  if (diffMin < 60) return `hace ${diffMin}m`
  if (diffMin < 1440) return `hace ${Math.floor(diffMin / 60)}h`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function sevColor(sev) {
  if (sev >= 8) return C.red
  if (sev >= 6) return C.amber
  if (sev >= 4) return C.cyan
  return C.txt3
}

function agentColor(name) {
  if (!name) return C.txt3
  if (name.includes('adsb'))     return C.red
  if (name.includes('maritime')) return C.cyan
  if (name.includes('news'))     return C.amber
  if (name.includes('social'))   return C.indigo
  return C.txt3
}

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
        {item.event_type ? <Text style={s.metaPill}>{item.event_type}</Text> : null}
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

function FindingCard({ item }) {
  const color  = agentColor(item.agent_name)
  const score  = item.anomaly_score || 0
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

export default function IntelScreen() {
  const { t } = useLang()
  const { profile } = useProfile()
  const hasTopics = (profile?.topics?.length || 0) > 0

  const [topicsOnly,    setTopicsOnly]    = useState(false)
  const [hours,         setHours]         = useState(48)
  const [minScore,      setMinScore]      = useState(0)
  const [domain,        setDomain]        = useState('all')
  const [showMasters,   setShowMasters]   = useState(true)
  const [showFindings,  setShowFindings]  = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)

  const { hPad } = useBreakpoint()

  const activeTopicsOnly = topicsOnly && hasTopics
  const { items, loading, error, spend, refresh } = useIntelTimeline({ hours, minScore, domain, topicsOnly: activeTopicsOnly })

  const filtered = useMemo(
    () => items.filter(it => {
      if (it.type === 'master'  && !showMasters)  return false
      if (it.type === 'finding' && !showFindings) return false
      return true
    }),
    [items, showMasters, showFindings]
  )

  const stats24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000
    let masters = 0, findings7 = 0
    for (const i of items) {
      if (new Date(i.time).getTime() < cutoff) continue
      if (i.type === 'master') masters += 1
      if (i.type === 'finding' && (i.anomaly_score || 0) >= 7) findings7 += 1
    }
    return { masters, findings7 }
  }, [items])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const spendPct = spend.cap_usd > 0 ? Math.min(100, (spend.spent_usd / spend.cap_usd) * 100) : 0
  const spendColor = spendPct >= 80 ? C.red : spendPct >= 50 ? C.amber : C.green

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

      <View style={[s.spendBar, { paddingHorizontal: hPad }]}>
        <View style={s.spendTrack}>
          <View style={[s.spendFill, { width: `${spendPct}%`, backgroundColor: spendColor }]} />
        </View>
        <Text style={[s.spendText, { color: spendColor }]}>
          {t('intel.spend', { spent: spend.spent_usd, cap: spend.cap_usd })}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pillRow}
        contentContainerStyle={{ paddingHorizontal: hPad, gap: 8, paddingBottom: 6 }}
      >
        {hasTopics && (
          <>
            <Pressable
              style={[s.myFeedPill, activeTopicsOnly && s.myFeedActive]}
              onPress={() => setTopicsOnly(v => !v)}
            >
              <Text style={[s.myFeedText, activeTopicsOnly && s.myFeedTextActive]}>
                {activeTopicsOnly ? '◉' : '○'} {t('intel.my_feed')}
              </Text>
            </Pressable>
            <View style={s.pillDivider} />
          </>
        )}
        {DOMAIN_KEYS.map(key => (
          <FilterPill
            key={key}
            label={t(`intel.domain_${key}`)}
            active={domain === key}
            onPress={() => setDomain(key)}
          />
        ))}
        <View style={s.pillDivider} />
        {HOURS.map(h => (
          <FilterPill
            key={h}
            label={`${h}h`}
            active={hours === h}
            onPress={() => setHours(h)}
          />
        ))}
        <View style={s.pillDivider} />
        {MIN_SCORES.map(m => (
          <FilterPill
            key={m}
            label={`≥${m}`}
            active={minScore === m}
            onPress={() => setMinScore(m)}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pillRow}
        contentContainerStyle={{ paddingHorizontal: hPad, gap: 8, paddingBottom: 8 }}
      >
        <FilterPill
          label={t('intel.badge_master')}
          active={showMasters}
          onPress={() => setShowMasters(v => !v)}
        />
        <FilterPill
          label={t('intel.badge_finding')}
          active={showFindings}
          onPress={() => setShowFindings(v => !v)}
        />
      </ScrollView>

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>Error: {error}</Text>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={it => (it.type === 'master'
          ? `m-${it.cycle_id}-${it.time}`
          : `f-${it.cycle_id}-${it.agent_name}-${it.time}`)}
        contentContainerStyle={{ padding: hPad, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        renderItem={({ item }) => (
          item.type === 'master' ? <MasterCard item={item} /> : <FindingCard item={item} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '◉'}
            title={loading ? t('intel.loading') : activeTopicsOnly ? t('intel.topics_empty') : t('intel.empty')}
            subtitle={loading || activeTopicsOnly ? null : t('intel.empty_subtitle')}
          />
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: C.bg0 },
  spendBar:        { paddingTop: 8, gap: 4 },
  spendTrack:      { height: 4, backgroundColor: C.bg2, borderRadius: 2, overflow: 'hidden' },
  spendFill:       { height: 4, borderRadius: 2 },
  spendText:       { fontSize: 12, fontFamily: 'SpaceMono', marginTop: 2 },
  pillRow:         { flexGrow: 0, paddingTop: 10 },
  pillDivider:     { width: 1, backgroundColor: C.separator, alignSelf: 'center', height: 20 },
  myFeedPill:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                     backgroundColor: C.bg2, borderWidth: 1, borderColor: 'transparent' },
  myFeedActive:    { backgroundColor: C.amberFill, borderColor: C.amber },
  myFeedText:      { fontSize: 13, fontWeight: '600', color: C.txt2, fontFamily: 'SpaceMono' },
  myFeedTextActive:{ color: C.amber },
  errorBanner:     { backgroundColor: C.redFill, paddingHorizontal: 16, paddingVertical: 10 },
  errorText:       { fontSize: 13, color: C.red },
  card:            { backgroundColor: C.bg1, borderRadius: 12, padding: 14, gap: 8,
                     borderLeftWidth: 3 },
  masterCard:      { backgroundColor: C.bg2 },
  cardTop:         { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge:           { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:       { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, fontFamily: 'SpaceMono' },
  cardTime:        { fontSize: 12, color: C.txt3 },
  scoreLabel:      { fontSize: 12, color: C.txt3 },
  scoreValue:      { fontSize: 16, fontWeight: '700', fontFamily: 'SpaceMono' },
  headline:        { fontSize: 17, fontWeight: '700', color: '#ffffff', lineHeight: 23 },
  metaRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaPill:        { fontSize: 11, color: C.txt2, borderWidth: 1, borderColor: C.separator,
                     paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                     textTransform: 'uppercase', letterSpacing: 0.3 },
  metaPillMuted:   { fontSize: 11, color: C.txt3, paddingHorizontal: 4 },
  body:            { fontSize: 14, color: C.txt2, lineHeight: 20 },
  recoBlock:       { backgroundColor: 'rgba(10,132,255,0.08)', padding: 10, borderRadius: 8, gap: 4 },
  recoLabel:       { fontSize: 11, fontWeight: '700', color: C.blue,
                     textTransform: 'uppercase', letterSpacing: 0.3 },
  recoBody:        { fontSize: 14, color: '#ffffff', lineHeight: 20 },
  tagsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag:             { fontSize: 12, color: C.cyan, fontFamily: 'SpaceMono' },
  liveBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5,
                     backgroundColor: C.goldFill, borderWidth: 1, borderColor: C.goldBorder,
                     borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  liveDot:         { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.gold },
  liveText:        { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 1 },
  domainLabel:     { fontSize: 9, fontWeight: '700', color: C.teal, letterSpacing: 1.5,
                     textTransform: 'uppercase', marginBottom: -2 },
})
