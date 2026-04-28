import { useState, useMemo, useCallback }         from 'react'
import { View, Text, TextInput, Pressable, StyleSheet,
         FlatList, Modal, Image, ScrollView,
         RefreshControl, Linking }                from 'react-native'
import Ionicons                                   from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets }                      from 'react-native-safe-area-context'
import { useNewsFeed }                            from '../../hooks/useNewsFeed'
import { useProfile }                             from '../../hooks/useProfile'
import { useLang }                                from '../../hooks/useLanguage'
import { PageHeader }                             from '../../components/PageHeader'
import { SeverityBadge }                          from '../../components/SeverityBadge'
import { FilterPill }                             from '../../components/FilterPill'
import { EmptyState }                             from '../../components/EmptyState'
import { C, SEV_COLOR }                           from '../../theme'
import { useBreakpoint }                          from '../../theme/responsive'

const SEV_FILTERS = ['all', 'high', 'medium', 'low']
const SORT_KEYS   = ['newest', 'severity', 'oldest']
const SEV_ORDER   = { high: 0, medium: 1, low: 2 }

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\[.*?\]/g, '')        // quita [video], [image], [gallery], etc.
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ── Article detail modal ──────────────────────────────────────────────────────
function ArticleModal({ article, onClose }) {
  const { t }   = useLang()
  const insets  = useSafeAreaInsets()
  if (!article) return null
  const color   = SEV_COLOR[article.severity] || C.txt3

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[am.root, { backgroundColor: C.bg0 }]}>
        {/* Image or plain header */}
        {article.image_url ? (
          <View style={am.imgWrap}>
            <Image source={{ uri: article.image_url }} style={am.img} resizeMode="cover" />
            <View style={am.imgGrad} />
            <Pressable
              style={[am.closeAbsolute, { top: insets.top + 10 }]}
              onPress={onClose} hitSlop={8}
            >
              <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.75)" />
            </Pressable>
            <View style={am.imgFooter}>
              <SeverityBadge severity={article.severity} />
              <Text style={am.imgSource} numberOfLines={1}>{article.source}</Text>
              <Text style={am.imgTime}>{fmt(article.time)}</Text>
            </View>
          </View>
        ) : (
          <View style={[am.plainHeader, { paddingTop: insets.top + 10 }]}>
            <Pressable onPress={onClose} hitSlop={8} style={am.closeBtn}>
              <Ionicons name="close" size={22} color={C.txt2} />
            </Pressable>
            <SeverityBadge severity={article.severity} />
          </View>
        )}

        <ScrollView
          style={am.body}
          contentContainerStyle={[am.bodyContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {!article.image_url && (
            <Text style={am.meta}>{article.source} · {fmt(article.time)}</Text>
          )}
          <Text style={am.title}>{article.title}</Text>

          {article.image_url && (
            <Text style={am.meta}>{fmt(article.time)}</Text>
          )}

          {article.summary ? (
            <Text style={am.summary}>{stripHtml(article.summary)}</Text>
          ) : null}

          {article.url ? (
            <Pressable
              style={({ pressed }) => [am.openBtn, pressed && { opacity: 0.7 }]}
              onPress={() => Linking.openURL(article.url).catch(() => {})}
            >
              <Text style={am.openBtnText}>{t('news.open_article')}</Text>
              <Ionicons name="open-outline" size={14} color="#02060e" />
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}

const am = StyleSheet.create({
  root:         { flex: 1 },
  imgWrap:      { height: 230, position: 'relative' },
  img:          { width: '100%', height: '100%' },
  imgGrad:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(8,9,13,0.55)' },
  closeAbsolute:{ position: 'absolute', right: 14 },
  imgFooter:    { position: 'absolute', bottom: 14, left: 14, right: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 8 },
  imgSource:    { fontSize: 11, color: 'rgba(255,255,255,0.7)', flex: 1 },
  imgTime:      { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  plainHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 16, paddingBottom: 12 },
  closeBtn:     { marginRight: 4 },
  body:         { flex: 1 },
  bodyContent:  { paddingHorizontal: 18, paddingTop: 18, gap: 12 },
  meta:         { fontSize: 11, color: C.txt3 },
  title:        { fontSize: 20, fontWeight: '800', color: '#ffffff', lineHeight: 27 },
  summary:      { fontSize: 14, color: C.txt2, lineHeight: 21 },
  openBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: C.gold, borderRadius: 10,
                  paddingVertical: 13, paddingHorizontal: 20,
                  marginTop: 8, justifyContent: 'center' },
  openBtnText:  { fontSize: 14, fontWeight: '700', color: '#02060e' },
})

// ── Bottom sheet (filter / sort) ──────────────────────────────────────────────
function BottomSheet({ visible, onClose, title, children }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
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
  sheet:   { backgroundColor: '#12141a', borderTopLeftRadius: 20, borderTopRightRadius: 20,
             paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  handle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)',
             alignSelf: 'center', marginBottom: 4 },
  title:   { fontSize: 16, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3 },
})

// ── News list item ────────────────────────────────────────────────────────────
function NewsListItem({ article, onPress }) {
  const color = SEV_COLOR[article.severity] || C.txt3
  return (
    <Pressable
      style={({ pressed }) => [s.listItem, { borderLeftColor: color },
        pressed && { backgroundColor: 'rgba(255,255,255,0.03)' }]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={s.listMeta}>{article.source} · {fmt(article.time)}</Text>
      </View>
      {article.image_url ? (
        <Image source={{ uri: article.image_url }} style={s.thumb} resizeMode="cover" />
      ) : null}
    </Pressable>
  )
}

// ── Hero card ─────────────────────────────────────────────────────────────────
function HeroCard({ article, onPress }) {
  return (
    <Pressable style={s.heroCard} onPress={onPress}>
      <Image source={{ uri: article.image_url }} style={s.heroImg} resizeMode="cover" />
      <View style={s.heroOverlay} />
      <View style={s.heroBody}>
        <View style={s.heroTop}>
          <SeverityBadge severity={article.severity} />
          <Text style={s.heroPub} numberOfLines={1}>{article.source} · {fmt(article.time)}</Text>
        </View>
        <Text style={s.heroTitle} numberOfLines={3}>{article.title}</Text>
      </View>
    </Pressable>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function NewsScreen() {
  const { t }     = useLang()
  const { profile } = useProfile()
  const { hPad }  = useBreakpoint()
  const hasTopics = (profile?.topics?.length || 0) > 0

  const [topicsOnly,  setTopicsOnly]  = useState(false)
  const [sevFilter,   setSevFilter]   = useState('all')
  const [zoneFilter,  setZoneFilter]  = useState('all')
  const [sort,        setSort]        = useState('newest')
  const [search,      setSearch]      = useState('')
  const [showFilter,  setShowFilter]  = useState(false)
  const [showSort,    setShowSort]    = useState(false)
  const [selected,    setSelected]    = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)

  const { articles, zones, loading } = useNewsFeed({
    topicsOnly: topicsOnly && hasTopics,
  })

  const allZones = useMemo(() => ['all', ...zones], [zones])

  const SEV_LABEL  = useMemo(() => ({
    all: t('common.all'), high: t('common.high'),
    medium: t('common.medium'), low: t('common.low'),
  }), [t])

  const SORT_LABEL = useMemo(() => ({
    newest:   t('news.sort_newest'),
    severity: t('news.sort_severity'),
    oldest:   t('news.sort_oldest'),
  }), [t])

  const filtered = useMemo(() => {
    let list = articles.filter(n => {
      if (sevFilter !== 'all' && n.severity !== sevFilter) return false
      if (zoneFilter !== 'all' && !(n.zones || []).includes(zoneFilter)) return false
      if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    if (sort === 'severity') {
      list = [...list].sort((a, b) =>
        (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
      )
    } else if (sort === 'oldest') {
      list = [...list].sort((a, b) => new Date(a.time) - new Date(b.time))
    }
    return list
  }, [articles, sevFilter, zoneFilter, search, sort])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const activeTopicsOnly = topicsOnly && hasTopics
  const activeFilterCount = (sevFilter !== 'all' ? 1 : 0)
                          + (zoneFilter !== 'all' ? 1 : 0)
                          + (activeTopicsOnly ? 1 : 0)

  return (
    <View style={s.root}>
      <PageHeader
        title={t('news.title')}
        subtitle={t('news.count', { n: filtered.length })}
      />

      {/* Search + Sort + Filter row */}
      <View style={[s.searchRow, { paddingHorizontal: hPad }]}>
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={15} color={C.txt3} style={s.searchIcon} />
          <TextInput
            style={s.search}
            placeholder={t('news.search')}
            placeholderTextColor={C.txt3}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Sort button */}
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

        {/* Filter button */}
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
          {activeFilterCount > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* News list */}
      <FlatList
        data={filtered}
        keyExtractor={a => String(a.id)}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />
        }
        renderItem={({ item, index }) => {
          if (index === 0 && item.image_url) {
            return <HeroCard article={item} onPress={() => setSelected(item)} />
          }
          return (
            <View>
              <NewsListItem article={item} onPress={() => setSelected(item)} />
              <View style={s.sep} />
            </View>
          )
        }}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '📰'}
            title={loading ? t('news.loading')
              : activeTopicsOnly ? t('news.topics_empty')
              : t('news.empty')}
            subtitle={loading || activeTopicsOnly ? null : t('news.suggest')}
          />
        }
      />

      {/* Article detail modal */}
      {selected && (
        <ArticleModal article={selected} onClose={() => setSelected(null)} />
      )}

      {/* Filter sheet */}
      <BottomSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        title={t('news.filter')}
      >
        {/* My Feed */}
        {hasTopics && (
          <View style={s.filterSection}>
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
                {t('news.my_feed')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Severity */}
        <View style={s.filterSection}>
          <Text style={s.filterLabel}>{t('news.filter_sev')}</Text>
          <View style={s.pillWrap}>
            {SEV_FILTERS.map(f => (
              <FilterPill
                key={f}
                label={SEV_LABEL[f]}
                active={sevFilter === f}
                onPress={() => setSevFilter(f)}
              />
            ))}
          </View>
        </View>

        {/* Zone */}
        {zones.length > 0 && (
          <View style={s.filterSection}>
            <Text style={s.filterLabel}>{t('news.filter_zone')}</Text>
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

        <Pressable
          style={({ pressed }) => [s.applyBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setShowFilter(false)}
        >
          <Text style={s.applyBtnText}>{t('news.filter_apply')}</Text>
        </Pressable>
      </BottomSheet>

      {/* Sort sheet */}
      <BottomSheet
        visible={showSort}
        onClose={() => setShowSort(false)}
        title={t('news.sort')}
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
              {sort === key && (
                <Ionicons name="checkmark" size={16} color={C.gold} />
              )}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: C.bg0 },

  searchRow:     { flexDirection: 'row', alignItems: 'center', gap: 8,
                   paddingVertical: 10 },
  searchWrap:    { flex: 1, flexDirection: 'row', alignItems: 'center',
                   backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
                   paddingHorizontal: 10 },
  searchIcon:    { marginRight: 6 },
  search:        { flex: 1, paddingVertical: 9, fontSize: 14, color: '#ffffff' },

  iconBtn:       { width: 38, height: 38, borderRadius: 10,
                   backgroundColor: 'rgba(255,255,255,0.05)',
                   alignItems: 'center', justifyContent: 'center' },
  iconBtnPressed:{ opacity: 0.6 },
  iconBtnActive: { backgroundColor: C.goldFill, borderWidth: 1, borderColor: C.goldBorder },
  badge:         { position: 'absolute', top: 5, right: 5, width: 14, height: 14,
                   borderRadius: 7, backgroundColor: C.gold,
                   alignItems: 'center', justifyContent: 'center' },
  badgeText:     { fontSize: 9, fontWeight: '800', color: '#02060e' },

  heroCard:      { borderRadius: 12, overflow: 'hidden', marginBottom: 6,
                   height: 210, position: 'relative' },
  heroImg:       { width: '100%', height: '100%', position: 'absolute' },
  heroOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                   backgroundColor: 'rgba(8,9,13,0.60)' },
  heroBody:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, gap: 6 },
  heroTop:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroPub:       { fontSize: 10, color: 'rgba(255,255,255,0.55)', flex: 1 },
  heroTitle:     { fontSize: 16, fontWeight: '700', color: '#ffffff', lineHeight: 22 },

  listItem:      { flexDirection: 'row', alignItems: 'center',
                   paddingVertical: 11, paddingLeft: 12, paddingRight: 8,
                   borderLeftWidth: 2, gap: 10 },
  listTitle:     { fontSize: 13, fontWeight: '600', color: '#ffffff', lineHeight: 18, marginBottom: 3 },
  listMeta:      { fontSize: 10, color: C.txt3 },
  thumb:         { width: 64, height: 64, borderRadius: 8, flexShrink: 0 },
  sep:           { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 16 },

  filterSection: { gap: 8 },
  filterLabel:   { fontSize: 11, fontWeight: '700', color: C.txt3, letterSpacing: 1.5,
                   textTransform: 'uppercase' },
  pillWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  feedToggle:    { flexDirection: 'row', alignItems: 'center', gap: 8,
                   paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
                   backgroundColor: 'rgba(255,255,255,0.04)',
                   borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  feedToggleActive:{ backgroundColor: C.goldFill, borderColor: C.goldBorder },
  feedToggleText:{ fontSize: 13, fontWeight: '600', color: C.txt2 },

  applyBtn:      { backgroundColor: C.gold, borderRadius: 10, paddingVertical: 13,
                   alignItems: 'center', marginTop: 4 },
  applyBtnText:  { fontSize: 15, fontWeight: '700', color: '#02060e' },

  sortList:      { gap: 2 },
  sortItem:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                   paddingVertical: 13, paddingHorizontal: 4, borderRadius: 8 },
  sortText:      { fontSize: 15, color: '#ffffff' },
})
