import { useState, useMemo }                                     from 'react'
import { View, Text, Pressable, StyleSheet, FlatList,
         ScrollView, Modal, Linking, SafeAreaView }              from 'react-native'
import { useSecFeed, SECTOR_COLOR, SECTOR_LABEL }               from '../../hooks/useSecFeed'
import { C }                                                     from '../../theme'

const SEV_BG     = { high:'rgba(255,59,74,0.12)', medium:'rgba(255,176,32,0.10)', low:'rgba(0,229,160,0.08)' }
const SEV_BORDER = { high:'rgba(255,59,74,0.3)',  medium:'rgba(255,176,32,0.28)', low:'rgba(0,229,160,0.22)' }
const SEV_C      = { high:C.red, medium:C.amber, low:C.green }

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
}

function clamp(v) { return Math.max(0, Math.min(100, v || 0)) }

function TickerBadge({ ticker, sector }) {
  const color = SECTOR_COLOR[sector] || C.cyan
  return (
    <View style={[s.tickerBadge, { borderColor:color }]}>
      <Text style={[s.tickerText, { color }]}>{ticker}</Text>
    </View>
  )
}

function SectorBadge({ sector }) {
  const color = SECTOR_COLOR[sector] || 'rgba(150,150,150,0.8)'
  return (
    <View style={[s.sectorBadge, { backgroundColor:color }]}>
      <Text style={s.sectorText}>{SECTOR_LABEL[sector] || sector}</Text>
    </View>
  )
}

function SevBadge({ severity }) {
  const sev = severity || 'low'
  return (
    <View style={[s.sevBadge, { backgroundColor:SEV_BG[sev], borderColor:SEV_BORDER[sev] }]}>
      <Text style={[s.sevText, { color:SEV_C[sev] }]}>{sev.toUpperCase()}</Text>
    </View>
  )
}

function RelevanceBar({ value }) {
  const pct   = clamp(value)
  const color = pct >= 70 ? C.red : pct >= 40 ? C.amber : C.green
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
      <View style={s.relTrack}>
        <View style={[s.relFill, { width:`${pct}%`, backgroundColor:color }]} />
      </View>
      <Text style={[s.relVal, { color }]}>{pct}</Text>
    </View>
  )
}

function FilingRow({ filing, selected, onPress }) {
  return (
    <Pressable
      style={[s.filingRow, selected && s.filingRowSelected]}
      onPress={onPress}
    >
      <View style={s.rowTop}>
        <TickerBadge ticker={filing.ticker} sector={filing.sector} />
        <Text style={s.formType}>{filing.form_type}</Text>
        <SevBadge severity={filing.severity} />
        <SectorBadge sector={filing.sector} />
      </View>
      <Text style={s.companyName} numberOfLines={2}>
        {filing.company_name} — {filing.title || 'Sin título'}
      </Text>
      <Text style={s.filingDate}>{fmt(filing.time)}</Text>
    </Pressable>
  )
}

function FilingDetailModal({ filing, onClose }) {
  if (!filing) return null
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.modalRoot}>
        <View style={s.modalHandle} />

        <View style={s.modalHeader}>
          <TickerBadge ticker={filing.ticker} sector={filing.sector} />
          <View style={{ flex:1 }}>
            <Text style={s.modalCompany}>{filing.company_name}</Text>
            <Text style={s.modalSector}>{SECTOR_LABEL[filing.sector] || filing.sector}</Text>
          </View>
          <SevBadge severity={filing.severity} />
          <Pressable onPress={onClose} style={s.modalClose}>
            <Text style={s.modalCloseText}>✕</Text>
          </Pressable>
        </View>

        <View style={s.metaGrid}>
          {[
            ['Formulario', filing.form_type],
            ['Sector',     SECTOR_LABEL[filing.sector] || filing.sector],
            ['Fecha',      fmt(filing.time)],
            ['CIK',        filing.cik],
          ].map(([k,v]) => (
            <View key={k} style={s.metaCell}>
              <Text style={s.metaKey}>{k}</Text>
              <Text style={s.metaVal}>{v || '—'}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>ACCESSION NUMBER</Text>
          <Text style={s.accession}>{filing.accession_number}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>RELEVANCIA</Text>
          <RelevanceBar value={filing.relevance} />
        </View>

        {filing.title ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>ÍTEMS REPORTADOS</Text>
            <Text style={s.sectionBody}>{filing.title}</Text>
          </View>
        ) : null}

        {filing.summary ? (
          <View style={[s.section, { flex:1 }]}>
            <Text style={s.sectionLabel}>RESUMEN</Text>
            <Text style={s.sectionBody}>{filing.summary}</Text>
          </View>
        ) : null}

        {filing.filing_url ? (
          <Pressable
            style={s.edgarBtn}
            onPress={() => Linking.openURL(filing.filing_url)}
          >
            <Text style={s.edgarBtnText}>VER EN EDGAR ↗</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </Modal>
  )
}

export default function MarketsScreen() {
  const { filings, sectors, failingSources, loading } = useSecFeed()

  const [selectedId,    setSelectedId]    = useState(null)
  const [filterSector,  setFilterSector]  = useState('TODOS')
  const [filterSev,     setFilterSev]     = useState('TODOS')

  const filtered = useMemo(() => filings.filter(f => {
    if (filterSector !== 'TODOS' && f.sector   !== filterSector) return false
    if (filterSev    !== 'TODOS' && f.severity !== filterSev)    return false
    return true
  }), [filings, filterSector, filterSev])

  const selected = filings.find(f => f.id === selectedId) || null

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>$ MERCADOS</Text>
        <Text style={s.count}>{filtered.length} filings</Text>
      </View>

      {failingSources.length > 0 && (
        <View style={s.failBanner}>
          <Text style={s.failText}>
            ⚠ Fallos de fetch: {failingSources.map(s => s.ticker).join(', ')}
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:12, paddingVertical:8 }}>
        {['TODOS', ...sectors].map(sec => (
          <Pressable key={sec} style={[s.chip, filterSector===sec && s.chipActive]} onPress={() => setFilterSector(sec)}>
            <Text style={[s.chipText, filterSector===sec && { color:C.cyan }]}>
              {sec === 'TODOS' ? 'TODOS' : (SECTOR_LABEL[sec] || sec).toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:12, paddingBottom:8 }}>
        {['TODOS', 'high', 'medium', 'low'].map(sev => (
          <Pressable key={sev} style={[s.chip, filterSev===sev && s.chipActive]} onPress={() => setFilterSev(sev)}>
            <Text style={[s.chipText, filterSev===sev && { color:C.cyan }]}>
              {sev === 'TODOS' ? 'TODOS' : sev.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={f => String(f.id)}
        contentContainerStyle={{ paddingBottom:32 }}
        renderItem={({ item }) => (
          <FilingRow
            filing={item}
            selected={item.id === selectedId}
            onPress={() => setSelectedId(item.id === selectedId ? null : item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={s.empty}>
            {loading
              ? 'Cargando filings...'
              : filings.length === 0
                ? 'Ingestor SEC no activo o sin filings aún'
                : 'Sin resultados con los filtros aplicados'}
          </Text>
        }
      />

      <FilingDetailModal filing={selected} onClose={() => setSelectedId(null)} />
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex:1, backgroundColor:C.bg0 },
  header:        { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.borderMd },
  headerTitle:   { color:C.cyan, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, flex:1 },
  count:         { color:C.txt3, fontFamily:'SpaceMono', fontSize:9, letterSpacing:1 },
  failBanner:    { backgroundColor:'rgba(255,176,32,0.08)', borderBottomWidth:1, borderBottomColor:'rgba(255,176,32,0.25)', padding:10, paddingHorizontal:16 },
  failText:      { fontFamily:'SpaceMono', fontSize:9, color:C.amber },
  filterRow:     { flexGrow:0 },
  chip:          { paddingHorizontal:10, paddingVertical:5, borderRadius:2, borderWidth:1, borderColor:C.borderMd, backgroundColor:C.bg2 },
  chipActive:    { borderColor:'rgba(0,200,255,0.4)', backgroundColor:'rgba(0,200,255,0.06)' },
  chipText:      { color:C.txt3, fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  filingRow:     { padding:14, borderBottomWidth:1, borderBottomColor:C.border, borderLeftWidth:3, borderLeftColor:'transparent' },
  filingRowSelected: { backgroundColor:'rgba(0,200,255,0.05)', borderLeftColor:C.cyan },
  rowTop:        { flexDirection:'row', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' },
  tickerBadge:   { borderWidth:1, borderRadius:3, paddingHorizontal:6, paddingVertical:1, backgroundColor:'rgba(0,0,0,0.3)' },
  tickerText:    { fontFamily:'SpaceMono', fontSize:10, fontWeight:'700' },
  sectorBadge:   { paddingHorizontal:5, paddingVertical:1, borderRadius:2 },
  sectorText:    { fontSize:8, fontFamily:'SpaceMono', color:'#070b0f', fontWeight:'700' },
  sevBadge:      { borderWidth:1, paddingHorizontal:5, paddingVertical:1, borderRadius:2 },
  sevText:       { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  formType:      { fontFamily:'SpaceMono', fontSize:9, color:C.txt3 },
  companyName:   { fontSize:11, color:C.txt1, lineHeight:16 },
  filingDate:    { fontSize:9, color:C.txt3, fontFamily:'SpaceMono', marginTop:4 },
  empty:         { textAlign:'center', padding:40, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },

  modalRoot:     { flex:1, backgroundColor:C.bg1, paddingHorizontal:16 },
  modalHandle:   { width:40, height:4, backgroundColor:C.borderMd, borderRadius:2, alignSelf:'center', marginTop:8, marginBottom:16 },
  modalHeader:   { flexDirection:'row', alignItems:'flex-start', gap:10, marginBottom:16 },
  modalCompany:  { fontSize:14, fontWeight:'600', color:C.txt1, lineHeight:18 },
  modalSector:   { fontSize:9, color:C.txt3, fontFamily:'SpaceMono', marginTop:2 },
  modalClose:    { padding:4 },
  modalCloseText:{ color:C.txt3, fontSize:18 },
  metaGrid:      { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:16 },
  metaCell:      { width:'47%', backgroundColor:'rgba(255,255,255,0.03)', borderRadius:4, padding:10 },
  metaKey:       { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', textTransform:'uppercase', letterSpacing:.1, marginBottom:3 },
  metaVal:       { fontSize:11, color:C.txt1, fontFamily:'SpaceMono' },
  section:       { marginBottom:14 },
  sectionLabel:  { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', textTransform:'uppercase', letterSpacing:.1, marginBottom:6 },
  sectionBody:   { fontSize:11, color:C.txt2, lineHeight:17 },
  accession:     { fontSize:10, color:C.txt2, fontFamily:'SpaceMono' },
  relTrack:      { flex:1, height:4, backgroundColor:C.borderMd, borderRadius:2, overflow:'hidden' },
  relFill:       { height:4, borderRadius:2 },
  relVal:        { fontFamily:'SpaceMono', fontSize:11, fontWeight:'600' },
  edgarBtn:      { margin:16, padding:14, backgroundColor:'rgba(0,200,255,0.08)', borderWidth:1, borderColor:'rgba(0,200,255,0.3)', borderRadius:4, alignItems:'center' },
  edgarBtnText:  { color:C.cyan, fontFamily:'SpaceMono', fontSize:10, fontWeight:'600', letterSpacing:.1 },
})
