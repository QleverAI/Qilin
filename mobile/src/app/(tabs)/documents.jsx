import { useState, useEffect }                                    from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView } from 'react-native'
import * as DocumentPicker                                         from 'expo-document-picker'
import { useDocsFeed }                                            from '../../hooks/useDocsFeed'
import { C }                                                      from '../../theme'

const STATUS_MAP    = { processed:'analyzed', failed:'archived', pending:'pending' }
const STATUS_LABELS = { analyzed:'ANALIZADO', analyzing:'ANALIZANDO', pending:'PENDIENTE', archived:'ARCHIVADO' }
const STATUS_COLORS = { analyzed:C.green, analyzing:C.amber, pending:C.txt3, archived:C.red }
const FILTERS       = ['TODOS', 'ANALIZADO', 'PENDIENTE', 'ARCHIVADO']

const ORG_ICONS = { defense:'🛡', international:'🌐', think_tank:'🔬', energy:'⚡', government:'🏛', default:'📄' }

function mapStatus(status) {
  return STATUS_MAP[status] || 'pending'
}

function fmtDate(iso) {
  if (!iso) return '?'
  return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
}

function fmtSize(kb) {
  if (!kb) return '?'
  return kb >= 1024 ? `${(kb/1024).toFixed(1)} MB` : `${kb} KB`
}

function DocRow({ doc, selected, onPress }) {
  const status = mapStatus(doc.status)
  const color  = STATUS_COLORS[status]
  return (
    <Pressable style={[s.row, selected && s.rowSelected]} onPress={onPress}>
      <Text style={s.docIcon}>{ORG_ICONS[doc.org_type] || ORG_ICONS.default}</Text>
      <View style={{ flex:1 }}>
        <Text style={s.docName} numberOfLines={1}>{doc.title}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:3 }}>
          <Text style={[s.docStatus, { color }]}>{STATUS_LABELS[status]}</Text>
          {(doc.sectors || []).slice(0,2).map(z => <Text key={z} style={s.docZone}>{z}</Text>)}
        </View>
      </View>
      <View style={{ alignItems:'flex-end' }}>
        <Text style={s.docSize}>{fmtSize(doc.file_size_kb)}</Text>
        <Text style={s.docPages}>{doc.page_count || '?'}p</Text>
      </View>
    </Pressable>
  )
}

function DocDetail({ doc, onClose }) {
  const status = mapStatus(doc.status)
  const color  = STATUS_COLORS[status]
  return (
    <ScrollView style={s.detail} contentContainerStyle={{ padding:16, gap:14, paddingBottom:32 }}>
      <Pressable style={s.closeBtn} onPress={onClose}>
        <Text style={s.closeText}>✕</Text>
      </Pressable>

      <Text style={s.detailIcon}>{ORG_ICONS[doc.org_type] || ORG_ICONS.default}</Text>
      <Text style={s.detailName}>{doc.title}</Text>

      <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
        <View style={[s.badge, { backgroundColor:`${color}18`, borderColor:`${color}44` }]}>
          <Text style={[s.badgeText, { color }]}>{STATUS_LABELS[status]}</Text>
        </View>
        <Text style={s.detailMeta}>{fmtSize(doc.file_size_kb)} · {doc.page_count || '?'} pág.</Text>
      </View>

      {[
        ['FUENTE',  doc.source],
        ['FECHA',   fmtDate(doc.time)],
        ['SECTORES',  (doc.sectors || []).join(', ') || '—'],
      ].map(([k,v]) => (
        <View key={k} style={s.metaRow}>
          <Text style={s.metaKey}>{k}</Text>
          <Text style={s.metaVal}>{v}</Text>
        </View>
      ))}

      <View style={s.divider} />

      <Text style={s.sectionLabel}>RESUMEN</Text>
      {status === 'analyzed' && doc.summary ? (
        <>
          <Text style={s.summary}>{doc.summary}</Text>
          {doc.relevance != null && (
            <View style={{ gap:6 }}>
              <Text style={s.metaKey}>RELEVANCIA GEOPOLÍTICA</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                <View style={s.relTrack}>
                  <View style={[s.relFill, {
                    width:`${doc.relevance}%`,
                    backgroundColor: doc.relevance >= 90 ? C.red : doc.relevance >= 75 ? C.amber : C.green,
                  }]} />
                </View>
                <Text style={s.relVal}>{doc.relevance}</Text>
              </View>
            </View>
          )}
        </>
      ) : (
        <Text style={[s.statusMsg, { color: status === 'analyzing' ? C.amber : C.txt3 }]}>
          {status === 'analyzing' ? 'ANÁLISIS EN CURSO...' : 'EN COLA PARA ANÁLISIS'}
        </Text>
      )}
    </ScrollView>
  )
}

export default function DocumentsScreen() {
  const { documents, loading } = useDocsFeed()
  const [localDocs,  setLocalDocs]  = useState([])
  const [filter,     setFilter]     = useState('TODOS')
  const [selected,   setSelected]   = useState(null)

  useEffect(() => { setLocalDocs(documents) }, [documents])

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ multiple:true, type:'*/*' })
    if (res.canceled) return
    const newDocs = res.assets.map((f, i) => ({
      id: `local-${Date.now()}-${i}`,
      title: f.name,
      org_type: null,
      file_size_kb: f.size ? Math.round(f.size / 1024) : null,
      time: new Date().toISOString(),
      status: 'pending',
      sectors: [], summary: null, relevance: null, page_count: null, source: 'Local',
    }))
    setLocalDocs(p => [...newDocs, ...p])
  }

  const filtered = filter === 'TODOS'
    ? localDocs
    : localDocs.filter(d => STATUS_LABELS[mapStatus(d.status)] === filter)

  const counts = {
    TODOS:      localDocs.length,
    ANALIZADO:  localDocs.filter(d => mapStatus(d.status) === 'analyzed').length,
    PENDIENTE:  localDocs.filter(d => mapStatus(d.status) === 'pending').length,
    ARCHIVADO:  localDocs.filter(d => mapStatus(d.status) === 'archived').length,
  }

  const selectedDoc = localDocs.find(d => d.id === selected)

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>▣ DOCUMENTOS</Text>
        <Pressable style={s.uploadBtn} onPress={pickDocument}>
          <Text style={s.uploadText}>+ SUBIR</Text>
        </Pressable>
      </View>

      <View style={s.tabRow}>
        {FILTERS.map(f => (
          <Pressable key={f} style={[s.tab, filter===f && s.tabActive]} onPress={() => setFilter(f)}>
            <Text style={[s.tabLabel, filter===f && s.tabLabelActive]}>{f}</Text>
            <Text style={[s.tabCount, filter===f && s.tabCountActive]}>{counts[f]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.content}>
        <FlatList
          style={s.list}
          data={filtered}
          keyExtractor={d => String(d.id)}
          contentContainerStyle={{ padding:6, paddingBottom:32 }}
          renderItem={({ item }) => (
            <DocRow
              doc={item}
              selected={selected === item.id}
              onPress={() => setSelected(selected === item.id ? null : item.id)}
            />
          )}
          ListEmptyComponent={
            <Text style={s.empty}>
              {loading ? 'Cargando documentos...' : 'Sin documentos disponibles'}
            </Text>
          }
        />

        {selectedDoc && (
          <View style={s.detailPanel}>
            <DocDetail doc={selectedDoc} onClose={() => setSelected(null)} />
          </View>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex:1, backgroundColor:C.bg0 },
  header:        { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.borderMd },
  headerTitle:   { color:C.cyan, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, flex:1 },
  uploadBtn:     { backgroundColor:'rgba(0,200,255,0.1)', borderWidth:1, borderColor:'rgba(0,200,255,0.4)', paddingHorizontal:12, paddingVertical:6, borderRadius:2 },
  uploadText:    { color:C.cyan, fontFamily:'SpaceMono', fontSize:9, letterSpacing:2 },
  tabRow:        { flexDirection:'row', borderBottomWidth:1, borderBottomColor:C.borderMd },
  tab:           { flex:1, alignItems:'center', padding:10, borderBottomWidth:2, borderBottomColor:'transparent' },
  tabActive:     { borderBottomColor:C.cyan },
  tabLabel:      { fontFamily:'SpaceMono', fontSize:7, color:C.txt3, letterSpacing:1, textTransform:'uppercase' },
  tabLabelActive:{ color:C.cyan },
  tabCount:      { fontFamily:'SpaceMono', fontSize:16, color:C.txt2, marginTop:2 },
  tabCountActive:{ color:C.cyan },
  content:       { flex:1, position:'relative' },
  list:          { flex:1 },
  row:           { flexDirection:'row', alignItems:'center', gap:10, padding:12, marginHorizontal:6, marginBottom:2, borderRadius:2 },
  rowSelected:   { backgroundColor:C.bg3, borderWidth:1, borderColor:'rgba(0,200,255,0.3)' },
  docIcon:       { fontSize:20, width:28 },
  docName:       { fontSize:11, color:C.txt1 },
  docStatus:     { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  docZone:       { fontFamily:'SpaceMono', fontSize:8, color:C.txt3 },
  docSize:       { fontFamily:'SpaceMono', fontSize:9, color:C.txt3 },
  docPages:      { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, marginTop:2 },
  detailPanel:   { position:'absolute', bottom:0, left:0, right:0, top:0, backgroundColor:C.bg1, zIndex:10 },
  closeBtn:      { alignSelf:'flex-end', padding:16 },
  closeText:     { color:C.txt3, fontSize:20 },
  detail:        { flex:1 },
  detailIcon:    { fontSize:32 },
  detailName:    { fontSize:13, fontWeight:'600', color:C.txt1, lineHeight:18 },
  badge:         { borderWidth:1, paddingHorizontal:8, paddingVertical:3, borderRadius:2 },
  badgeText:     { fontFamily:'SpaceMono', fontSize:9, letterSpacing:1 },
  detailMeta:    { fontFamily:'SpaceMono', fontSize:9, color:C.txt3, alignSelf:'center' },
  metaRow:       { flexDirection:'row', gap:12 },
  metaKey:       { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, letterSpacing:1, textTransform:'uppercase', width:64 },
  metaVal:       { fontFamily:'SpaceMono', fontSize:9, color:C.txt2, flex:1 },
  divider:       { height:1, backgroundColor:C.border },
  sectionLabel:  { fontFamily:'SpaceMono', fontSize:8, letterSpacing:2, color:C.txt3, textTransform:'uppercase' },
  summary:       { fontSize:11, color:C.txt1, lineHeight:18 },
  relTrack:      { flex:1, height:4, backgroundColor:C.borderMd, borderRadius:2, overflow:'hidden' },
  relFill:       { height:'100%', borderRadius:2 },
  relVal:        { fontFamily:'SpaceMono', fontSize:13, color:C.txt1, fontWeight:'600' },
  statusMsg:     { fontFamily:'SpaceMono', fontSize:10, letterSpacing:1 },
  empty:         { textAlign:'center', padding:40, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },
})
