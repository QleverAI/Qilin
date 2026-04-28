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
          if (index === 0 && item.image_url) {
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
  heroCard:     { borderRadius: 12, overflow: 'hidden', marginBottom: 4, height: 200, position: 'relative' },
  heroImg:      { width: '100%', height: '100%', position: 'absolute' },
  heroOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,9,13,0.65)' },
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
