import { useState, useMemo, useCallback }                      from 'react'
import { View, Text, Pressable, StyleSheet,
         FlatList, ScrollView, RefreshControl }               from 'react-native'
import { useSocialFeed }                                      from '../../hooks/useSocialFeed'
import { useLang }                                            from '../../hooks/useLanguage'
import { PageHeader }                                         from '../../components/PageHeader'
import { FilterPill }                                         from '../../components/FilterPill'
import { EmptyState }                                         from '../../components/EmptyState'
import { C, T }                                               from '../../theme'
import { useBreakpoint }                                      from '../../theme/responsive'

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now - d) / 60000)
  if (diffMin < 60) return `${diffMin}m`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function PostCard({ post, interactionsLabel }) {
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
        <Text style={s.engagement}>{interactionsLabel({ n: engagement })}</Text>
      ) : null}
    </View>
  )
}

export default function SocialScreen() {
  const { t } = useLang()
  const { posts, zones, categories, loading } = useSocialFeed()
  const { hPad, columns } = useBreakpoint()

  const [zoneFilter,     setZoneFilter]     = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [refreshing,     setRefreshing]     = useState(false)

  const allZones      = ['all', ...zones]
  const allCategories = ['all', ...categories]

  const filtered = useMemo(() => posts.filter(p => {
    if (zoneFilter     !== 'all' && p.zone     !== zoneFilter)     return false
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
    return true
  }), [posts, zoneFilter, categoryFilter])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  return (
    <View style={s.root}>
      <PageHeader title={t('social.title')} subtitle={t('social.count', { n: filtered.length })} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pillRow}
        contentContainerStyle={{ paddingHorizontal: hPad, gap: 8, paddingBottom: 8 }}
      >
        {allZones.map(z => (
          <FilterPill
            key={z}
            label={z === 'all' ? t('common.allF') : z}
            active={zoneFilter === z}
            onPress={() => setZoneFilter(z)}
          />
        ))}
        <View style={s.pillDivider} />
        {allCategories.map(c => (
          <FilterPill
            key={c}
            label={c === 'all' ? t('common.all') : c}
            active={categoryFilter === c}
            onPress={() => setCategoryFilter(c)}
          />
        ))}
      </ScrollView>

      <FlatList
        key={`social-cols-${columns}`}
        numColumns={columns}
        data={filtered}
        keyExtractor={p => String(p.tweet_id || p.id)}
        contentContainerStyle={{ paddingBottom: 32 }}
        columnWrapperStyle={columns > 1 ? { gap: 0 } : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        ItemSeparatorComponent={columns === 1 ? () => <View style={s.sep} /> : undefined}
        renderItem={({ item }) => (
          <View style={columns > 1 ? { flex: 1, borderWidth: StyleSheet.hairlineWidth,
            borderColor: C.separator, marginLeft: -StyleSheet.hairlineWidth, marginTop: -StyleSheet.hairlineWidth } : undefined}>
            <PostCard post={item} interactionsLabel={(params) => t('social.interactions', params)} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '💬'}
            title={loading ? t('social.loading') : t('social.empty')}
            subtitle={loading ? null : t('social.suggest')}
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
