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
import { C, T, SEV_COLOR }                   from '../../theme'
import { useBreakpoint }                     from '../../theme/responsive'

const SEV_FILTERS = ['all', 'high', 'medium', 'low']

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function NewsCard({ article, expanded, onPress }) {
  const zone    = article.zones?.[0] || ''
  const hasImg  = !!article.image_url
  const sevColor = SEV_COLOR[article.severity] || C.txt3

  return (
    <Pressable style={[s.card, expanded && s.cardExpanded]} onPress={onPress}>
      {hasImg && (
        <Image source={{ uri: article.image_url }} style={s.cardImg} resizeMode="cover" />
      )}
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <SeverityBadge severity={article.severity} />
          {zone ? <Text style={s.zone}>{zone}</Text> : null}
        </View>
        <Text style={s.cardTitle} numberOfLines={expanded ? undefined : 3}>
          {article.title}
        </Text>
        {expanded && article.summary ? (
          <Text style={s.cardSummary}>{article.summary}</Text>
        ) : null}
        <View style={s.cardFoot}>
          <Text style={s.cardSource}>{article.source}</Text>
          <Text style={s.cardTime}>{fmt(article.time)}</Text>
        </View>
        {article.relevance != null && (
          <View style={s.relRow}>
            <View style={s.relTrack}>
              <View style={[s.relFill, {
                width: `${article.relevance}%`,
                backgroundColor: article.relevance >= 80 ? C.red : article.relevance >= 60 ? C.amber : C.green,
              }]} />
            </View>
            <Text style={s.relVal}>{article.relevance}</Text>
          </View>
        )}
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
  const { hPad, columns } = useBreakpoint()

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
      <PageHeader title={t('news.title')} subtitle={t('news.count', { n: filtered.length })} />

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
          <FilterPill
            key={f}
            label={SEV_LABEL[f]}
            active={sevFilter === f}
            onPress={() => setSevFilter(f)}
          />
        ))}
        <View style={s.pillDivider} />
        {allZones.map(z => (
          <FilterPill
            key={z}
            label={z === 'all' ? t('common.allF') : z}
            active={zoneFilter === z}
            onPress={() => setZoneFilter(z)}
          />
        ))}
      </ScrollView>

      <FlatList
        key={`news-cols-${columns}`}
        numColumns={columns}
        data={filtered}
        keyExtractor={a => String(a.id)}
        contentContainerStyle={{ padding: hPad, gap: 12, paddingBottom: 32 }}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        renderItem={({ item }) => (
          <View style={columns > 1 ? { flex: 1 } : undefined}>
            <NewsCard
              article={item}
              expanded={expanded === item.id}
              onPress={() => setExpanded(expanded === item.id ? null : item.id)}
            />
          </View>
        )}
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
  root:        { flex: 1, backgroundColor: C.bg0 },
  searchWrap:  { paddingTop: 12, paddingBottom: 4 },
  search:      { backgroundColor: C.bg2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
                 fontSize: 15, color: '#ffffff' },
  pillRow:     { flexGrow: 0, paddingTop: 8 },
  pillDivider: { width: 1, backgroundColor: C.separator, alignSelf: 'center', height: 20 },
  myFeedPill:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                 backgroundColor: C.bg2, borderWidth: 1, borderColor: 'transparent' },
  myFeedActive:{ backgroundColor: C.amberFill, borderColor: C.amber },
  myFeedText:  { fontSize: 13, fontWeight: '600', color: C.txt2, fontFamily: 'SpaceMono' },
  myFeedTextActive: { color: C.amber },
  card:        { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  cardExpanded: {},
  cardImg:     { width: '100%', height: 180 },
  cardBody:    { padding: 14, gap: 8 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zone:        { fontSize: 13, color: C.txt3, flex: 1 },
  cardTitle:   { fontSize: 17, fontWeight: '600', color: '#ffffff', lineHeight: 23 },
  cardSummary: { fontSize: 15, color: C.txt2, lineHeight: 22 },
  cardFoot:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardSource:  { fontSize: 13, color: C.txt3, fontWeight: '500' },
  cardTime:    { fontSize: 13, color: C.txt3, flex: 1, textAlign: 'right' },
  relRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  relTrack:    { flex: 1, height: 3, backgroundColor: C.bg3, borderRadius: 2, overflow: 'hidden' },
  relFill:     { height: '100%', borderRadius: 2 },
  relVal:      { fontSize: 12, color: C.txt3, width: 24, textAlign: 'right' },
})
