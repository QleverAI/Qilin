import { useState, useMemo, useCallback }         from 'react'
import { View, Text, TextInput, Pressable, StyleSheet,
         FlatList, Modal, ScrollView,
         RefreshControl, Linking }                from 'react-native'
import Ionicons                                   from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets }                      from 'react-native-safe-area-context'
import { useSocialFeed }                          from '../../hooks/useSocialFeed'
import { useProfile }                             from '../../hooks/useProfile'
import { useLang }                                from '../../hooks/useLanguage'
import { PageHeader }                             from '../../components/PageHeader'
import { FilterPill }                             from '../../components/FilterPill'
import { EmptyState }                             from '../../components/EmptyState'
import { C }                                      from '../../theme'
import { useBreakpoint }                          from '../../theme/responsive'

const SORT_KEYS = ['newest', 'interactions', 'oldest']

function fmtTime(iso) {
  if (!iso) return '—'
  const d    = new Date(iso)
  const diff = Math.floor((Date.now() - d) / 60000)
  if (diff < 60)   return `${diff}m`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function fmtFull(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function engagement(post) {
  return (post.likes || 0) + (post.retweets || 0)
}

// ── Post detail modal ─────────────────────────────────────────────────────────
function PostModal({ post, onClose, t }) {
  const insets = useSafeAreaInsets()
  if (!post) return null
  const eng = engagement(post)

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[pm.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={pm.header}>
          <View style={pm.avatar}>
            <Text style={pm.avatarText}>{(post.handle || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pm.handle}>@{post.handle}</Text>
            {post.display ? <Text style={pm.display} numberOfLines={1}>{post.display}</Text> : null}
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={C.txt2} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={pm.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Content */}
          <Text style={pm.content}>{post.content}</Text>

          {/* Meta */}
          <Text style={pm.time}>{fmtFull(post.time)}</Text>

          {/* Tags */}
          <View style={pm.tags}>
            {post.zone ? (
              <View style={pm.tag}>
                <Ionicons name="location-outline" size={12} color={C.blue} />
                <Text style={[pm.tagText, { color: C.blue }]}>{post.zone}</Text>
              </View>
            ) : null}
            {post.category ? (
              <View style={pm.tag}>
                <Text style={pm.tagText}>{post.category}</Text>
              </View>
            ) : null}
          </View>

          {/* Engagement */}
          {eng > 0 && (
            <View style={pm.engRow}>
              <View style={pm.engItem}>
                <Ionicons name="heart-outline" size={16} color={C.txt3} />
                <Text style={pm.engVal}>{post.likes || 0}</Text>
              </View>
              <View style={pm.engItem}>
                <Ionicons name="repeat-outline" size={16} color={C.txt3} />
                <Text style={pm.engVal}>{post.retweets || 0}</Text>
              </View>
            </View>
          )}

          {/* Open in X */}
          {post.url && (
            <Pressable
              style={({ pressed }) => [pm.openBtn, pressed && { opacity: 0.75 }]}
              onPress={() => Linking.openURL(post.url).catch(() => {})}
            >
              <Text style={pm.openText}>{t('social.open_post')}</Text>
              <Ionicons name="open-outline" size={14} color="#02060e" />
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const pm = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg0, paddingHorizontal: 18 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  avatar:    { width: 46, height: 46, borderRadius: 23, backgroundColor: C.bg2,
               alignItems: 'center', justifyContent: 'center' },
  avatarText:{ fontSize: 20, fontWeight: '700', color: '#ffffff' },
  handle:    { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  display:   { fontSize: 13, color: C.txt3 },
  body:      { gap: 14, paddingBottom: 24 },
  content:   { fontSize: 17, color: '#ffffff', lineHeight: 25 },
  time:      { fontSize: 12, color: C.txt3 },
  tags:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:       { flexDirection: 'row', alignItems: 'center', gap: 4,
               backgroundColor: C.bg2, paddingHorizontal: 10, paddingVertical: 5,
               borderRadius: 8 },
  tagText:   { fontSize: 12, color: C.txt2, fontWeight: '500' },
  engRow:    { flexDirection: 'row', gap: 20 },
  engItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  engVal:    { fontSize: 14, color: C.txt2, fontWeight: '600' },
  openBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
               gap: 8, backgroundColor: C.gold, borderRadius: 10,
               paddingVertical: 13, marginTop: 4 },
  openText:  { fontSize: 14, fontWeight: '700', color: '#02060e' },
})

// ── Bottom sheet ──────────────────────────────────────────────────────────────
function BottomSheet({ visible, onClose, title, children }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={bs.overlay} onPress={onClose} />
      <View style={[bs.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={bs.handle} />
        <Text style={bs.title}>{title}</Text>
        {children}
      </View>
    </Modal>
  )
}

const bs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:   { backgroundColor: '#12141a', borderTopLeftRadius: 20,
             borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  handle:  { width: 36, height: 4, borderRadius: 2,
             backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center', marginBottom: 4 },
  title:   { fontSize: 16, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3 },
})

// ── Post card ─────────────────────────────────────────────────────────────────
function PostCard({ post, onPress, t }) {
  const eng = engagement(post)
  return (
    <Pressable
      style={({ pressed }) => [s.post, pressed && { backgroundColor: 'rgba(255,255,255,0.03)' }]}
      onPress={onPress}
    >
      <View style={s.postHeader}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(post.handle || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.handleRow}>
            <Text style={s.handle}>@{post.handle}</Text>
            {post.display ? (
              <Text style={s.displayName} numberOfLines={1}>{post.display}</Text>
            ) : null}
          </View>
          <View style={s.metaRow}>
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

      <Text style={s.content} numberOfLines={4}>{post.content}</Text>

      {eng > 0 ? (
        <Text style={s.engagement}>{t('social.interactions', { n: eng })}</Text>
      ) : null}
    </Pressable>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const { t }     = useLang()
  const { profile } = useProfile()
  const { hPad }  = useBreakpoint()
  const hasTopics = (profile?.topics?.length || 0) > 0

  const [topicsOnly,     setTopicsOnly]     = useState(false)
  const [zoneFilter,     setZoneFilter]     = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sort,           setSort]           = useState('newest')
  const [search,         setSearch]         = useState('')
  const [showFilter,     setShowFilter]     = useState(false)
  const [showSort,       setShowSort]       = useState(false)
  const [selected,       setSelected]       = useState(null)
  const [refreshing,     setRefreshing]     = useState(false)

  const activeTopicsOnly = topicsOnly && hasTopics
  const { posts, zones, categories, loading } = useSocialFeed({ topicsOnly: activeTopicsOnly })

  const allZones      = useMemo(() => ['all', ...zones],      [zones])
  const allCategories = useMemo(() => ['all', ...categories], [categories])

  const SORT_LABEL = useMemo(() => ({
    newest:       t('social.sort_newest'),
    interactions: t('social.sort_interactions'),
    oldest:       t('social.sort_oldest'),
  }), [t])

  const filtered = useMemo(() => {
    let list = posts.filter(p => {
      if (zoneFilter     !== 'all' && p.zone     !== zoneFilter)     return false
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
      if (search && !`${p.content || ''} ${p.handle || ''}`.toLowerCase()
                         .includes(search.toLowerCase()))            return false
      return true
    })
    if (sort === 'interactions') {
      list = [...list].sort((a, b) => engagement(b) - engagement(a))
    } else if (sort === 'oldest') {
      list = [...list].sort((a, b) => new Date(a.time) - new Date(b.time))
    }
    return list
  }, [posts, zoneFilter, categoryFilter, search, sort])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const activeFilterCount = (zoneFilter !== 'all' ? 1 : 0)
                          + (categoryFilter !== 'all' ? 1 : 0)
                          + (activeTopicsOnly ? 1 : 0)

  return (
    <View style={s.root}>
      <PageHeader
        title={t('social.title')}
        subtitle={t('social.count', { n: filtered.length })}
      />

      {/* Search + Sort + Filter */}
      <View style={[s.searchRow, { paddingHorizontal: hPad }]}>
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={15} color={C.txt3} style={s.searchIcon} />
          <TextInput
            style={s.search}
            placeholder={t('social.search')}
            placeholderTextColor={C.txt3}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && s.iconBtnPressed,
            sort !== 'newest' && s.iconBtnActive]}
          onPress={() => setShowSort(true)}
          hitSlop={4}
        >
          <Ionicons
            name="swap-vertical-outline"
            size={18}
            color={sort !== 'newest' ? C.gold : C.txt2}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && s.iconBtnPressed,
            activeFilterCount > 0 && s.iconBtnActive]}
          onPress={() => setShowFilter(true)}
          hitSlop={4}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? C.gold : C.txt2}
          />
          {activeFilterCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={p => String(p.tweet_id || p.id)}
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />
        }
        renderItem={({ item }) => (
          <PostCard post={item} onPress={() => setSelected(item)} t={t} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '💬'}
            title={loading ? t('social.loading')
              : activeTopicsOnly ? t('social.topics_empty')
              : t('social.empty')}
            subtitle={loading || activeTopicsOnly ? null : t('social.suggest')}
          />
        }
      />

      {/* Post detail modal */}
      {selected && (
        <PostModal post={selected} onClose={() => setSelected(null)} t={t} />
      )}

      {/* Filter sheet */}
      <BottomSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        title={t('social.filter')}
      >
        {hasTopics && (
          <Pressable
            style={[s.feedToggle, activeTopicsOnly && s.feedToggleActive]}
            onPress={() => setTopicsOnly(v => !v)}
          >
            <Ionicons
              name={activeTopicsOnly ? 'radio-button-on' : 'radio-button-off'}
              size={16}
              color={activeTopicsOnly ? C.gold : C.txt3}
            />
            <Text style={[s.feedToggleText, activeTopicsOnly && { color: C.gold }]}>
              {t('social.my_feed')}
            </Text>
          </Pressable>
        )}

        {zones.length > 0 && (
          <View style={s.filterSection}>
            <Text style={s.filterLabel}>{t('social.filter_zone')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
            >
              {allZones.map(z => (
                <FilterPill
                  key={z}
                  label={z === 'all' ? t('common.allF') : z}
                  active={zoneFilter === z}
                  onPress={() => setZoneFilter(z)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {categories.length > 0 && (
          <View style={s.filterSection}>
            <Text style={s.filterLabel}>{t('social.filter_cat')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
            >
              {allCategories.map(c => (
                <FilterPill
                  key={c}
                  label={c === 'all' ? t('common.all') : c}
                  active={categoryFilter === c}
                  onPress={() => setCategoryFilter(c)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [s.applyBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setShowFilter(false)}
        >
          <Text style={s.applyBtnText}>{t('social.filter_apply')}</Text>
        </Pressable>
      </BottomSheet>

      {/* Sort sheet */}
      <BottomSheet
        visible={showSort}
        onClose={() => setShowSort(false)}
        title={t('social.sort')}
      >
        <View style={s.sortList}>
          {SORT_KEYS.map(key => (
            <Pressable
              key={key}
              style={({ pressed }) => [s.sortItem, pressed && { backgroundColor: 'rgba(255,255,255,0.03)' }]}
              onPress={() => { setSort(key); setShowSort(false) }}
            >
              <Text style={[s.sortText, sort === key && { color: C.gold }]}>
                {SORT_LABEL[key]}
              </Text>
              {sort === key && <Ionicons name="checkmark" size={16} color={C.gold} />}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg0 },

  searchRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  searchWrap:     { flex: 1, flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
                    paddingHorizontal: 10 },
  searchIcon:     { marginRight: 6 },
  search:         { flex: 1, paddingVertical: 9, fontSize: 14, color: '#ffffff' },

  iconBtn:        { width: 38, height: 38, borderRadius: 10,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    alignItems: 'center', justifyContent: 'center' },
  iconBtnPressed: { opacity: 0.6 },
  iconBtnActive:  { backgroundColor: C.goldFill, borderWidth: 1, borderColor: C.goldBorder },
  badge:          { position: 'absolute', top: 5, right: 5, width: 14, height: 14,
                    borderRadius: 7, backgroundColor: C.gold,
                    alignItems: 'center', justifyContent: 'center' },
  badgeText:      { fontSize: 9, fontWeight: '800', color: '#02060e' },

  post:           { paddingHorizontal: 16, paddingVertical: 13, gap: 9 },
  postHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar:         { width: 42, height: 42, borderRadius: 21, backgroundColor: C.bg2,
                    alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  handleRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  handle:         { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  displayName:    { fontSize: 12, color: C.txt3, flex: 1 },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  time:           { fontSize: 12, color: C.txt3 },
  zone:           { fontSize: 11, color: C.blue, fontWeight: '500' },
  catPill:        { backgroundColor: C.bg2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catText:        { fontSize: 11, color: C.txt2, fontWeight: '500' },
  content:        { fontSize: 15, color: '#ffffff', lineHeight: 22, marginLeft: 52 },
  engagement:     { fontSize: 12, color: C.txt3, marginLeft: 52 },
  sep:            { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 70 },

  filterSection:  { gap: 8 },
  filterLabel:    { fontSize: 11, fontWeight: '700', color: C.txt3,
                    letterSpacing: 1.5, textTransform: 'uppercase' },
  feedToggle:     { flexDirection: 'row', alignItems: 'center', gap: 8,
                    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  feedToggleActive:{ backgroundColor: C.goldFill, borderColor: C.goldBorder },
  feedToggleText: { fontSize: 13, fontWeight: '600', color: C.txt2 },

  applyBtn:       { backgroundColor: C.gold, borderRadius: 10,
                    paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  applyBtnText:   { fontSize: 15, fontWeight: '700', color: '#02060e' },

  sortList:       { gap: 2 },
  sortItem:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 13, paddingHorizontal: 4, borderRadius: 8 },
  sortText:       { fontSize: 15, color: '#ffffff' },
})
