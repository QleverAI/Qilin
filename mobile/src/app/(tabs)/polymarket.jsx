import { useState, useCallback, useMemo }              from 'react'
import { View, Text, Pressable, StyleSheet, FlatList,
         ScrollView, Linking, RefreshControl }         from 'react-native'
import * as Haptics                                    from 'expo-haptics'
import { usePolymarketFeed }                           from '../../hooks/usePolymarketFeed'
import { useLang }                                     from '../../hooks/useLanguage'
import { PageHeader }                                  from '../../components/PageHeader'
import { FilterPill }                                  from '../../components/FilterPill'
import { EmptyState }                                  from '../../components/EmptyState'
import { C, T }                                        from '../../theme'
import { useBreakpoint }                               from '../../theme/responsive'

const CATEGORY_DEFS = {
  es: [
    { key: 'all',    label: 'Todos' },
    { key: 'geo',    label: 'Geopolítica' },
    { key: 'us',     label: 'EEUU' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'econ',   label: 'Economía' },
    { key: 'sports', label: 'Deportes' },
    { key: 'other',  label: 'Otros' },
  ],
  en: [
    { key: 'all',    label: 'All' },
    { key: 'geo',    label: 'Geopolitics' },
    { key: 'us',     label: 'US' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'econ',   label: 'Economy' },
    { key: 'sports', label: 'Sports' },
    { key: 'other',  label: 'Other' },
  ],
}

const BADGE_META = {
  'HIGH VALUE': { fill: C.greenFill,  color: C.green },
  'WATCH':      { fill: C.amberFill,  color: C.amber },
  'PRICED IN':  { fill: C.blueFill,   color: C.blue  },
}

function MarketCard({ market, onOpen }) {
  const pct = (market.yes_price || 0) * 100
  const color = pct >= 80 ? C.green : pct >= 50 ? C.cyan : pct >= 20 ? C.amber : C.red
  return (
    <Pressable style={s.card} onPress={onOpen}>
      <View style={s.topRow}>
        {market.category ? (
          <Text style={s.catPill}>{market.category.toUpperCase()}</Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text style={[s.yesPct, { color }]}>{pct.toFixed(0)}%</Text>
      </View>
      <Text style={s.question} numberOfLines={3}>{market.question}</Text>
      <View style={s.bottomRow}>
        <View style={s.probTrack}>
          <View style={[s.probFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={s.vol}>
          Vol. ${market.volume >= 1e6 ? `${(market.volume/1e6).toFixed(1)}M` :
                  market.volume >= 1e3 ? `${(market.volume/1e3).toFixed(0)}K` :
                  market.volume?.toFixed(0) || '0'}
        </Text>
      </View>
    </Pressable>
  )
}

function PickCard({ pick }) {
  const meta = BADGE_META[pick.badge] || BADGE_META['WATCH']
  return (
    <View style={[s.pick, { borderColor: meta.color }]}>
      <View style={[s.pickBadge, { backgroundColor: meta.fill, borderColor: meta.color }]}>
        <Text style={[s.pickBadgeText, { color: meta.color }]}>{pick.badge}</Text>
      </View>
      <Text style={s.pickQuestion}>{pick.question}</Text>
      {pick.reasoning ? <Text style={s.pickReason}>{pick.reasoning}</Text> : null}
      {pick.yes_price != null ? (
        <Text style={s.pickPrice}>YES {Math.round(pick.yes_price * 100)}%</Text>
      ) : null}
    </View>
  )
}

export default function PolymarketScreen() {
  const { lang, t } = useLang()
  const { markets, analysis, loading, analysisLoading } = usePolymarketFeed()
  const { hPad, columns } = useBreakpoint()
  const [filter, setFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  const categories = CATEGORY_DEFS[lang] || CATEGORY_DEFS.es

  const filtered = useMemo(() => {
    if (filter === 'all') return markets
    return markets.filter(m => m.category === filter)
  }, [markets, filter])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  return (
    <View style={s.root}>
      <PageHeader title={t('polymarket.title')} subtitle={t('polymarket.count', { n: filtered.length })} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pillRow}
        contentContainerStyle={{ paddingHorizontal: hPad, gap: 8, paddingBottom: 8 }}
      >
        {categories.map(c => (
          <FilterPill
            key={c.key}
            label={c.label}
            active={filter === c.key}
            onPress={() => setFilter(c.key)}
          />
        ))}
      </ScrollView>

      {analysis && !analysisLoading && analysis.picks?.length > 0 ? (
        <View style={[s.analysisBlock, { paddingHorizontal: hPad }]}>
          {analysis.summary ? (
            <Text style={s.analysisSummary}>{analysis.summary}</Text>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: hPad }}
            style={{ marginHorizontal: -hPad, paddingHorizontal: hPad }}
          >
            {analysis.picks.map((p, i) => <PickCard key={i} pick={p} />)}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        key={`poly-cols-${columns}`}
        numColumns={columns}
        data={filtered}
        keyExtractor={m => m.market_id || m.slug || m.question}
        contentContainerStyle={{ padding: hPad, gap: 10, paddingBottom: 32 }}
        columnWrapperStyle={columns > 1 ? { gap: 10 } : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        renderItem={({ item }) => (
          <View style={columns > 1 ? { flex: 1 } : undefined}>
            <MarketCard
              market={item}
              onOpen={() => {
                Haptics.selectionAsync()
                if (item.slug) {
                  Linking.openURL(`https://polymarket.com/market/${item.slug}`).catch(() => {})
                }
              }}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '◆'}
            title={loading ? t('polymarket.loading') : t('polymarket.empty')}
            subtitle={loading ? null : t('news.suggest')}
          />
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg0 },
  pillRow:        { flexGrow: 0, paddingTop: 12 },
  analysisBlock:  { paddingTop: 8, paddingBottom: 12, gap: 10 },
  analysisSummary:{ fontSize: 14, color: C.txt2, lineHeight: 20, fontStyle: 'italic' },
  card:           { backgroundColor: C.bg1, borderRadius: 12, padding: 14, gap: 10 },
  topRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catPill:        { fontSize: 11, fontWeight: '700', color: C.txt2, letterSpacing: 0.5,
                    backgroundColor: C.bg2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  yesPct:         { fontSize: 22, fontWeight: '700', fontFamily: 'SpaceMono' },
  question:       { fontSize: 15, color: '#ffffff', lineHeight: 21, fontWeight: '500' },
  bottomRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  probTrack:      { flex: 1, height: 4, backgroundColor: C.bg3, borderRadius: 2, overflow: 'hidden' },
  probFill:       { height: 4, borderRadius: 2 },
  vol:            { fontSize: 12, color: C.txt3, fontFamily: 'SpaceMono' },
  pick:           { width: 260, backgroundColor: C.bg1, borderRadius: 10, padding: 12,
                    gap: 6, borderWidth: 1 },
  pickBadge:      { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 4,
                    paddingHorizontal: 6, paddingVertical: 2 },
  pickBadgeText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  pickQuestion:   { fontSize: 13, color: '#ffffff', fontWeight: '600', lineHeight: 18 },
  pickReason:     { fontSize: 12, color: C.txt2, lineHeight: 17 },
  pickPrice:      { fontSize: 12, color: C.cyan, fontFamily: 'SpaceMono', fontWeight: '700' },
})
