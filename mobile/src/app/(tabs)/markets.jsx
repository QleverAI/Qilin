import { useState, useMemo, useCallback }              from 'react'
import { View, Text, Pressable, StyleSheet, FlatList,
         ScrollView, Modal, Linking, SafeAreaView,
         RefreshControl }                              from 'react-native'
import * as Haptics                                    from 'expo-haptics'
import { useSecFeed, SECTOR_COLOR, SECTOR_LABEL }     from '../../hooks/useSecFeed'
import { PageHeader }                                  from '../../components/PageHeader'
import { FilterPill }                                  from '../../components/FilterPill'
import { SeverityBadge }                               from '../../components/SeverityBadge'
import { EmptyState }                                  from '../../components/EmptyState'
import { C, T, SEV_COLOR, SEV_FILL }                  from '../../theme'

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function clamp(v) { return Math.max(0, Math.min(100, v || 0)) }

function TickerBadge({ ticker, sector }) {
  const color = SECTOR_COLOR[sector] || C.cyan
  return (
    <View style={[s.tickerBadge, { borderColor: color }]}>
      <Text style={[s.tickerText, { color }]}>{ticker}</Text>
    </View>
  )
}

function FilingRow({ filing, onPress }) {
  return (
    <Pressable style={s.filingRow} onPress={onPress}>
      <View style={s.filingTop}>
        <TickerBadge ticker={filing.ticker} sector={filing.sector} />
        <Text style={s.formType}>{filing.form_type}</Text>
        <SeverityBadge severity={filing.severity} />
        <View style={{ flex: 1 }} />
        <Text style={s.filingDate}>{fmt(filing.time)}</Text>
      </View>
      <Text style={s.companyName} numberOfLines={2}>
        {filing.company_name}
        {filing.title ? ` — ${filing.title}` : ''}
      </Text>
      {SECTOR_LABEL[filing.sector] ? (
        <Text style={s.sectorLabel}>{SECTOR_LABEL[filing.sector]}</Text>
      ) : null}
    </Pressable>
  )
}

function RelevanceBar({ value }) {
  const pct   = clamp(value)
  const color = pct >= 70 ? C.red : pct >= 40 ? C.amber : C.green
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={s.relTrack}>
        <View style={[s.relFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.relVal, { color }]}>{pct}</Text>
    </View>
  )
}

function FilingModal({ filing, onClose }) {
  if (!filing) return null
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modalSafe}>
        <View style={s.modalHandle} />

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <TickerBadge ticker={filing.ticker} sector={filing.sector} />
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>

          <View>
            <Text style={s.modalCompany}>{filing.company_name}</Text>
            {SECTOR_LABEL[filing.sector] ? (
              <Text style={s.modalSector}>{SECTOR_LABEL[filing.sector]}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SeverityBadge severity={filing.severity} />
            <Text style={s.formTypeLarge}>{filing.form_type}</Text>
          </View>

          <View style={s.metaGrid}>
            {[
              ['Fecha',  fmt(filing.time)],
              ['CIK',    filing.cik],
              ['Sector', SECTOR_LABEL[filing.sector] || filing.sector],
              ['Accession', filing.accession_number],
            ].map(([k, v]) => (
              <View key={k} style={s.metaCell}>
                <Text style={s.metaKey}>{k}</Text>
                <Text style={s.metaVal} numberOfLines={2}>{v || '—'}</Text>
              </View>
            ))}
          </View>

          {filing.relevance != null && (
            <View style={{ gap: 8 }}>
              <Text style={s.sectionLabel}>Relevancia</Text>
              <RelevanceBar value={filing.relevance} />
            </View>
          )}

          {filing.title ? (
            <View style={{ gap: 8 }}>
              <Text style={s.sectionLabel}>Ítems reportados</Text>
              <Text style={s.sectionBody}>{filing.title}</Text>
            </View>
          ) : null}

          {filing.summary ? (
            <View style={{ gap: 8 }}>
              <Text style={s.sectionLabel}>Resumen</Text>
              <Text style={s.sectionBody}>{filing.summary}</Text>
            </View>
          ) : null}

          {filing.filing_url ? (
            <Pressable
              style={s.edgarBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                Linking.openURL(filing.filing_url)
              }}
            >
              <Text style={s.edgarBtnText}>Ver en EDGAR ↗</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

export default function MarketsScreen() {
  const { filings, sectors, failingSources, loading } = useSecFeed()

  const [selectedFiling, setSelectedFiling] = useState(null)
  const [filterSector,   setFilterSector]   = useState('Todos')
  const [filterSev,      setFilterSev]      = useState('Todos')
  const [refreshing,     setRefreshing]     = useState(false)

  const filtered = useMemo(() => filings.filter(f => {
    if (filterSector !== 'Todos' && f.sector   !== filterSector) return false
    if (filterSev    !== 'Todos' && f.severity !== filterSev)    return false
    return true
  }), [filings, filterSector, filterSev])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  return (
    <View style={s.root}>
      <PageHeader title="Mercados" subtitle={`${filtered.length} filings`} />

      {failingSources.length > 0 && (
        <View style={s.failBanner}>
          <Text style={s.failText}>
            Sin datos: {failingSources.map(src => src.ticker).join(', ')}
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pillRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}
      >
        <FilterPill label="Todos" active={filterSector === 'Todos'} onPress={() => setFilterSector('Todos')} />
        {sectors.map(sec => (
          <FilterPill
            key={sec}
            label={SECTOR_LABEL[sec] || sec}
            active={filterSector === sec}
            onPress={() => setFilterSector(sec)}
          />
        ))}
        <View style={s.pillDivider} />
        {['Todos', 'high', 'medium', 'low'].map(sev => (
          <FilterPill
            key={sev}
            label={sev === 'Todos' ? 'Todos' : sev === 'high' ? 'Alto' : sev === 'medium' ? 'Medio' : 'Bajo'}
            active={filterSev === sev}
            onPress={() => setFilterSev(sev)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={f => String(f.id)}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        renderItem={({ item }) => (
          <FilingRow
            filing={item}
            onPress={() => {
              Haptics.selectionAsync()
              setSelectedFiling(item)
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '📈'}
            title={loading ? 'Cargando filings...' : filings.length === 0 ? 'Sin filings disponibles' : 'Sin resultados'}
            subtitle={loading ? null : filings.length === 0 ? 'El ingestor SEC puede no estar activo' : 'Prueba ajustando los filtros'}
          />
        }
      />

      <FilingModal filing={selectedFiling} onClose={() => setSelectedFiling(null)} />
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg0 },
  pillRow:     { flexGrow: 0, paddingTop: 12 },
  pillDivider: { width: 1, backgroundColor: C.separator, alignSelf: 'center', height: 20 },
  failBanner:  { backgroundColor: C.amberFill, paddingHorizontal: 16, paddingVertical: 10 },
  failText:    { fontSize: 13, color: C.amber },
  sep:         { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 16 },
  filingRow:   { paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  filingTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tickerBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tickerText:  { fontSize: 13, fontWeight: '700', fontFamily: 'SpaceMono' },
  formType:    { fontSize: 13, color: C.txt3, fontFamily: 'SpaceMono' },
  filingDate:  { fontSize: 13, color: C.txt3 },
  companyName: { fontSize: 15, fontWeight: '500', color: '#ffffff', lineHeight: 21 },
  sectorLabel: { fontSize: 13, color: C.txt3 },
  relTrack:    { flex: 1, height: 4, backgroundColor: C.bg3, borderRadius: 2, overflow: 'hidden' },
  relFill:     { height: 4, borderRadius: 2 },
  relVal:      { fontSize: 15, fontWeight: '600', width: 28, textAlign: 'right' },
  modalSafe:   { flex: 1, backgroundColor: C.bg1 },
  modalHandle: { width: 36, height: 4, backgroundColor: C.bg3, borderRadius: 2,
                 alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  closeBtn:    { padding: 8 },
  closeText:   { fontSize: 18, color: C.txt3 },
  modalCompany:{ fontSize: 22, fontWeight: '700', color: '#ffffff' },
  modalSector: { fontSize: 13, color: C.txt3, marginTop: 4 },
  formTypeLarge:{ fontSize: 15, fontFamily: 'SpaceMono', color: C.txt2 },
  metaGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaCell:    { width: '47%', backgroundColor: C.bg2, borderRadius: 10, padding: 12 },
  metaKey:     { fontSize: 12, color: C.txt3, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  metaVal:     { fontSize: 13, color: '#ffffff', fontFamily: 'SpaceMono' },
  sectionLabel:{ fontSize: 13, fontWeight: '600', color: C.txt3,
                 textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBody: { fontSize: 15, color: C.txt2, lineHeight: 22 },
  edgarBtn:    { backgroundColor: C.blueFill, borderRadius: 12, paddingVertical: 14,
                 alignItems: 'center', marginTop: 8 },
  edgarBtnText:{ fontSize: 16, fontWeight: '600', color: C.blue },
})
