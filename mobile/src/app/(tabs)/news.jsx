import { useState, useMemo, useCallback }    from 'react'
import { View, Text, TextInput, Pressable,
         StyleSheet, FlatList, ScrollView,
         Image, RefreshControl }             from 'react-native'
import { useNewsFeed }                       from '../../hooks/useNewsFeed'
import { PageHeader }                        from '../../components/PageHeader'
import { FilterPill }                        from '../../components/FilterPill'
import { SeverityBadge }                     from '../../components/SeverityBadge'
import { EmptyState }                        from '../../components/EmptyState'
import { C, T, SEV_COLOR }                   from '../../theme'

const SEV_FILTERS = ['Todos', 'high', 'medium', 'low']
const SEV_NAMES   = { high: 'Alto', medium: 'Medio', low: 'Bajo' }

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function NewsCard({ article, expanded, onPress }) {
  const zone    = article.zones?.[0] || ''
  const hasImg  = !!article.image_url
  const sevColor = SEV_COLOR[article.severity] || C.txt3

  return (
    <Pressable
      style={[s.card, expanded && s.cardExpanded]}
      onPress={onPress}
    >
      {hasImg && (
        <Image
          source={{ uri: article.image_url }}
          style={s.cardImg}
          resizeMode="cover"
        />
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
  const { articles, zones, loading } = useNewsFeed()

  const [sevFilter,  setSevFilter]  = useState('Todos')
  const [zoneFilter, setZoneFilter] = useState('Todas')
  const [search,     setSearch]     = useState('')
  const [expanded,   setExpanded]   = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const allZones = ['Todas', ...zones]

  const filtered = useMemo(() => articles.filter(n => {
    if (sevFilter !== 'Todos' && n.severity !== sevFilter) return false
    if (zoneFilter !== 'Todas' && !(n.zones || []).includes(zoneFilter)) return false
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [articles, sevFilter, zoneFilter, search])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  return (
    <View style={s.root}>
      <PageHeader
        title="Noticias"
        subtitle={`${filtered.length} artículos`}
      />

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Buscar noticias..."
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
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}
      >
        {SEV_FILTERS.map(f => (
          <FilterPill
            key={f}
            label={f === 'Todos' ? 'Todos' : SEV_NAMES[f]}
            active={sevFilter === f}
            onPress={() => setSevFilter(f)}
          />
        ))}
        <View style={s.pillDivider} />
        {allZones.map(z => (
          <FilterPill
            key={z}
            label={z}
            active={zoneFilter === z}
            onPress={() => setZoneFilter(z)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={a => String(a.id)}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        renderItem={({ item }) => (
          <NewsCard
            article={item}
            expanded={expanded === item.id}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '📰'}
            title={loading ? 'Cargando noticias...' : 'Sin resultados'}
            subtitle={loading ? null : 'Prueba ajustando los filtros'}
          />
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg0 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  search:     { backgroundColor: C.bg2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
                fontSize: 15, color: '#ffffff' },
  pillRow:    { flexGrow: 0, paddingTop: 8 },
  pillDivider:{ width: 1, backgroundColor: C.separator, alignSelf: 'center', height: 20 },
  card:       { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  cardExpanded: {},
  cardImg:    { width: '100%', height: 180 },
  cardBody:   { padding: 14, gap: 8 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zone:       { fontSize: 13, color: C.txt3, flex: 1 },
  cardTitle:  { fontSize: 17, fontWeight: '600', color: '#ffffff', lineHeight: 23 },
  cardSummary:{ fontSize: 15, color: C.txt2, lineHeight: 22 },
  cardFoot:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardSource: { fontSize: 13, color: C.txt3, fontWeight: '500' },
  cardTime:   { fontSize: 13, color: C.txt3, flex: 1, textAlign: 'right' },
  relRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  relTrack:   { flex: 1, height: 3, backgroundColor: C.bg3, borderRadius: 2, overflow: 'hidden' },
  relFill:    { height: '100%', borderRadius: 2 },
  relVal:     { fontSize: 12, color: C.txt3, width: 24, textAlign: 'right' },
})
