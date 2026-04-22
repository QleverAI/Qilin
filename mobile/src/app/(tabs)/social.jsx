import { useState, useMemo, useCallback }                      from 'react'
import { View, Text, Pressable, StyleSheet,
         FlatList, ScrollView, RefreshControl }               from 'react-native'
import { useSocialFeed }                                      from '../../hooks/useSocialFeed'
import { PageHeader }                                         from '../../components/PageHeader'
import { FilterPill }                                         from '../../components/FilterPill'
import { EmptyState }                                         from '../../components/EmptyState'
import { C, T }                                               from '../../theme'

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now - d) / 60000)
  if (diffMin < 60) return `hace ${diffMin}m`
  if (diffMin < 1440) return `hace ${Math.floor(diffMin / 60)}h`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function PostCard({ post }) {
  const engagement = (post.likes || 0) + (post.retweets || 0)
  return (
    <View style={s.post}>
      <View style={s.postHeader}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(post.handle || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.handle}>@{post.handle}</Text>
            {post.display ? <Text style={s.displayName} numberOfLines={1}>{post.display}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <Text style={s.time}>{fmtTime(post.time)}</Text>
            {post.zone ? <Text style={s.zone}>{post.zone}</Text> : null}
          </View>
        </View>
        {post.category ? (
          <View style={s.catPill}>
            <Text style={s.catText}>{post.category}</Text>
          </View>
        ) : null}
      </View>

      <Text style={s.content}>{post.content}</Text>

      {engagement > 0 ? (
        <Text style={s.engagement}>
          {engagement >= 1000
            ? `${(engagement / 1000).toFixed(1)}K interacciones`
            : `${engagement} interacciones`}
        </Text>
      ) : null}
    </View>
  )
}

export default function SocialScreen() {
  const { posts, zones, categories, loading } = useSocialFeed()

  const [zoneFilter,     setZoneFilter]     = useState('Todas')
  const [categoryFilter, setCategoryFilter] = useState('Todos')
  const [refreshing,     setRefreshing]     = useState(false)

  const allZones      = ['Todas', ...zones]
  const allCategories = ['Todos', ...categories]

  const filtered = useMemo(() => posts.filter(p => {
    if (zoneFilter     !== 'Todas' && p.zone     !== zoneFilter)     return false
    if (categoryFilter !== 'Todos' && p.category !== categoryFilter) return false
    return true
  }), [posts, zoneFilter, categoryFilter])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  return (
    <View style={s.root}>
      <PageHeader title="Social" subtitle={`${filtered.length} publicaciones`} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pillRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}
      >
        {allZones.map(z => (
          <FilterPill
            key={z}
            label={z}
            active={zoneFilter === z}
            onPress={() => setZoneFilter(z)}
          />
        ))}
        <View style={s.pillDivider} />
        {allCategories.map(c => (
          <FilterPill
            key={c}
            label={c}
            active={categoryFilter === c}
            onPress={() => setCategoryFilter(c)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={p => String(p.tweet_id || p.id)}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '💬'}
            title={loading ? 'Cargando publicaciones...' : 'Sin publicaciones'}
            subtitle={loading ? null : 'Prueba ajustando los filtros'}
          />
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg0 },
  pillRow:     { flexGrow: 0, paddingTop: 12 },
  pillDivider: { width: 1, backgroundColor: C.separator, alignSelf: 'center', height: 20 },
  sep:         { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 70 },
  post:        { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  postHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar:      { width: 42, height: 42, borderRadius: 21, backgroundColor: C.bg2,
                 alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  handle:      { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  displayName: { fontSize: 13, color: C.txt3, flex: 1 },
  time:        { fontSize: 13, color: C.txt3 },
  zone:        { fontSize: 12, color: C.blue, fontWeight: '500' },
  catPill:     { backgroundColor: C.bg2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catText:     { fontSize: 12, color: C.txt2, fontWeight: '500' },
  content:     { fontSize: 16, color: '#ffffff', lineHeight: 23, marginLeft: 52 },
  engagement:  { fontSize: 13, color: C.txt3, marginLeft: 52 },
})
