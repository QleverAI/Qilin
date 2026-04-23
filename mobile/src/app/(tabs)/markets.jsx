import { useState, useCallback, useMemo }       from 'react'
import { View, Text, StyleSheet, FlatList,
         SectionList, RefreshControl }         from 'react-native'
import { useMarkets }                           from '../../hooks/useMarkets'
import { useLang }                              from '../../hooks/useLanguage'
import { PageHeader }                           from '../../components/PageHeader'
import { EmptyState }                           from '../../components/EmptyState'
import { C, T }                                 from '../../theme'
import { useBreakpoint }                        from '../../theme/responsive'

function fmtPrice(p, ccy) {
  if (p == null) return '—'
  const fixed = Math.abs(p) >= 100 ? 2 : 4
  return `${p.toFixed(fixed)}${ccy === 'EUR' ? ' €' : ccy === 'GBP' ? ' £' : ccy === 'USD' || !ccy ? '' : ` ${ccy}`}`
}

function fmtPct(pct) {
  if (pct == null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function QuoteRow({ quote }) {
  const pct = quote.change_pct
  const color = pct == null ? C.txt3 : pct > 0 ? C.green : pct < 0 ? C.red : C.txt3
  const arrow = pct == null ? '·' : pct > 0 ? '▲' : pct < 0 ? '▼' : '·'
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{quote.name}</Text>
        <Text style={s.symbol}>{quote.symbol}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={s.price}>{fmtPrice(quote.price, quote.currency)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[s.pct, { color }]}>{arrow}</Text>
          <Text style={[s.pct, { color }]}>{fmtPct(pct)}</Text>
        </View>
      </View>
    </View>
  )
}

export default function MarketsScreen() {
  const { t } = useLang()
  const { groups, loading, error } = useMarkets()
  const { hPad } = useBreakpoint()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const sections = useMemo(
    () => groups.map(g => ({ title: g.name, data: g.items })),
    [groups]
  )

  return (
    <View style={s.root}>
      <PageHeader title={t('markets.title')} subtitle={loading ? t('common.loading') : `${groups.length} · ${groups.reduce((a,g)=>a+g.items.length,0)}`} />

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>Error: {error}</Text>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item, i) => `${item.symbol}-${i}`}
        stickySectionHeadersEnabled
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        renderSectionHeader={({ section: { title } }) => (
          <View style={[s.sectionHeader, { paddingHorizontal: hPad }]}>
            <Text style={s.sectionHeaderText}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[s.rowWrap, { paddingHorizontal: hPad }]}>
            <QuoteRow quote={item} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={[s.sep, { marginLeft: hPad }]} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '📉'}
            title={loading ? t('markets.loading') : t('markets.empty')}
            subtitle={loading ? null : 'Yahoo Finance'}
          />
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: C.bg0 },
  errorBanner:       { backgroundColor: C.redFill, paddingHorizontal: 16, paddingVertical: 10 },
  errorText:         { fontSize: 13, color: C.red },
  sectionHeader:     { backgroundColor: C.bg0, paddingTop: 18, paddingBottom: 6 },
  sectionHeaderText: { fontSize: 12, fontWeight: '700', color: C.txt3,
                       textTransform: 'uppercase', letterSpacing: 0.5 },
  rowWrap:           { backgroundColor: C.bg1 },
  row:               { flexDirection: 'row', alignItems: 'center',
                       paddingVertical: 12, gap: 16 },
  name:              { fontSize: 15, fontWeight: '500', color: '#ffffff' },
  symbol:            { fontSize: 12, color: C.txt3, fontFamily: 'SpaceMono', marginTop: 2 },
  price:             { fontSize: 16, fontWeight: '600', color: '#ffffff', fontFamily: 'SpaceMono' },
  pct:               { fontSize: 13, fontWeight: '600', fontFamily: 'SpaceMono' },
  sep:               { height: StyleSheet.hairlineWidth, backgroundColor: C.separator },
})
