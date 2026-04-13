import { useState }                                               from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView } from 'react-native'
import * as DocumentPicker                                         from 'expo-document-picker'
import { MOCK_DOCUMENTS, DOC_STATUS_COLORS, DOC_TYPE_ICONS }      from '../../data/mockDocuments'
import { C }                                                       from '../../theme'

const STATUS_LABELS = { analyzed:'ANALIZADO', analyzing:'ANALIZANDO', pending:'PENDIENTE', archived:'ARCHIVADO' }
const FILTERS       = ['TODOS', 'ANALIZADO', 'ANALIZANDO', 'PENDIENTE']

function DocRow({ doc, selected, onPress }) {
  const color = DOC_STATUS_COLORS[doc.status]
  return (
    <Pressable style={[s.row, selected && s.rowSelected]} onPress={onPress}>
      <Text style={s.docIcon}>{DOC_TYPE_ICONS[doc.type] || '📄'}</Text>
      <View style={{ flex:1 }}>
        <Text style={s.docName} numberOfLines={1}>{doc.name}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:3 }}>
          <Text style={[s.docStatus, { color }]}>{STATUS_LABELS[doc.status]}</Text>
          {doc.zones.map(z => <Text key={z} style={s.docZone}>{z}</Text>)}
        </View>
      </View>
      <View style={{ alignItems:'flex-end' }}>
        <Text style={s.docSize}>{doc.size}</Text>
        <Text style={s.docPages}>{doc.pages}p</Text>
      </View>
    </Pressable>
  )
}

function DocDetail({ doc }) {
  if (!doc) return (
    <View style={s.emptyDetail}>
      <Text style={s.emptyText}>SELECCIONA UN{'\n'}DOCUMENTO</Text>
    </View>
  )

  const color = DOC_STATUS_COLORS[doc.status]
  return (
    <ScrollView style={s.detail} contentContainerStyle={{ padding:16, gap:14, paddingBottom:32 }}>
      <Text style={s.detailIcon}>{DOC_TYPE_ICONS[doc.type]}</Text>
      <Text style={s.detailName}>{doc.name}</Text>

      <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
        <View style={[s.badge, { backgroundColor:`${color}18`, borderColor:`${color}44` }]}>
          <Text style={[s.badgeText, { color }]}>{STATUS_LABELS[doc.status]}</Text>
        </View>
        <Text style={s.detailMeta}>{doc.size} · {doc.pages} pág.</Text>
      </View>

      {[['SUBIDO', doc.uploaded], ['ZONAS', doc.zones.join(', ')], ['TAGS', doc.tags.join(' · ')]].map(([k,v]) => (
        <View key={k} style={s.metaRow}>
          <Text style={s.metaKey}>{k}</Text>
          <Text style={s.metaVal}>{v}</Text>
        </View>
      ))}

      <View style={s.divider} />

      <Text style={s.sectionLabel}>RESUMEN DE ANÁLISIS</Text>
      {doc.status === 'analyzed' && doc.summary ? (
        <>
          <Text style={s.summary}>{doc.summary}</Text>
          {doc.relevance && (
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
      ) : doc.status === 'analyzing' ? (
        <Text style={[s.statusMsg, { color:C.amber }]}>ANÁLISIS EN CURSO...</Text>
      ) : (
        <Text style={[s.statusMsg, { color:C.txt3 }]}>EN COLA PARA ANÁLISIS</Text>
      )}

      <View style={s.aiPromo}>
        <Text style={s.aiPromoTitle}>FUSIÓN IA · PRÓXIMAMENTE</Text>
        <Text style={s.aiPromoText}>Correlación automática con alertas y noticias para señales de trading.</Text>
      </View>
    </ScrollView>
  )
}

export default function DocumentsScreen() {
  const [docs,    setDocs]    = useState(MOCK_DOCUMENTS)
  const [filter,  setFilter]  = useState('TODOS')
  const [selected,setSelected]= useState(null)

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ multiple:true, type:'*/*' })
    if (res.canceled) return
    const newDocs = res.assets.map((f, i) => ({
      id: Date.now() + i,
      name: f.name,
      type: f.name.split('.').pop().toLowerCase(),
      size: f.size ? `${(f.size/1024/1024).toFixed(1)} MB` : '?',
      uploaded: new Date().toLocaleString('es-ES'),
      status: 'pending',
      zones: [], summary:null, tags:[], relevance:null, pages:'?',
    }))
    setDocs(p => [...newDocs, ...p])
  }

  const filtered = filter === 'TODOS' ? docs : docs.filter(d => STATUS_LABELS[d.status] === filter)
  const selectedDoc = docs.find(d => d.id === selected)
  const counts = {
    TODOS:      docs.length,
    ANALIZADO:  docs.filter(d=>d.status==='analyzed').length,
    ANALIZANDO: docs.filter(d=>d.status==='analyzing').length,
    PENDIENTE:  docs.filter(d=>d.status==='pending').length,
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>▣ DOCUMENTOS</Text>
        <Pressable style={s.uploadBtn} onPress={pickDocument}>
          <Text style={s.uploadText}>+ SUBIR</Text>
        </Pressable>
      </View>

      {/* Filter tabs */}
      <View style={s.tabRow}>
        {FILTERS.map(f => (
          <Pressable key={f} style={[s.tab, filter===f && s.tabActive]} onPress={() => setFilter(f)}>
            <Text style={[s.tabLabel, filter===f && s.tabLabelActive]}>{f}</Text>
            <Text style={[s.tabCount, filter===f && s.tabCountActive]}>{counts[f]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.content}>
        {/* Doc list */}
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
        />

        {/* Detail panel (shown when selected) */}
        {selectedDoc && (
          <View style={s.detailPanel}>
            <Pressable style={s.closeBtn} onPress={() => setSelected(null)}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
            <DocDetail doc={selectedDoc} />
          </View>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex:1, backgroundColor:C.bg0 },
  header:       { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.borderMd },
  headerTitle:  { color:C.cyan, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, flex:1 },
  uploadBtn:    { backgroundColor:'rgba(0,200,255,0.1)', borderWidth:1, borderColor:'rgba(0,200,255,0.4)', paddingHorizontal:12, paddingVertical:6, borderRadius:2 },
  uploadText:   { color:C.cyan, fontFamily:'SpaceMono', fontSize:9, letterSpacing:2 },

  tabRow:       { flexDirection:'row', borderBottomWidth:1, borderBottomColor:C.borderMd },
  tab:          { flex:1, alignItems:'center', padding:10, borderBottomWidth:2, borderBottomColor:'transparent' },
  tabActive:    { borderBottomColor:C.cyan },
  tabLabel:     { fontFamily:'SpaceMono', fontSize:7, color:C.txt3, letterSpacing:1, textTransform:'uppercase' },
  tabLabelActive:{ color:C.cyan },
  tabCount:     { fontFamily:'SpaceMono', fontSize:16, color:C.txt2, marginTop:2 },
  tabCountActive:{ color:C.cyan },

  content:      { flex:1, position:'relative' },
  list:         { flex:1 },

  row:          { flexDirection:'row', alignItems:'center', gap:10, padding:12, marginHorizontal:6, marginBottom:2, borderRadius:2 },
  rowSelected:  { backgroundColor:C.bg3, borderWidth:1, borderColor:'rgba(0,200,255,0.3)' },
  docIcon:      { fontSize:20, width:28 },
  docName:      { fontSize:11, color:C.txt1 },
  docStatus:    { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  docZone:      { fontFamily:'SpaceMono', fontSize:8, color:C.txt3 },
  docSize:      { fontFamily:'SpaceMono', fontSize:9, color:C.txt3 },
  docPages:     { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, marginTop:2 },

  detailPanel:  { position:'absolute', bottom:0, left:0, right:0, top:0, backgroundColor:C.bg1, zIndex:10 },
  closeBtn:     { position:'absolute', top:12, right:12, zIndex:11, width:28, height:28, alignItems:'center', justifyContent:'center' },
  closeText:    { color:C.txt3, fontSize:16 },

  emptyDetail:  { flex:1, alignItems:'center', justifyContent:'center' },
  emptyText:    { fontFamily:'SpaceMono', fontSize:10, color:C.txt3, textAlign:'center', lineHeight:20 },

  detail:       { flex:1 },
  detailIcon:   { fontSize:32 },
  detailName:   { fontSize:13, fontWeight:'600', color:C.txt1, lineHeight:18 },
  badge:        { borderWidth:1, paddingHorizontal:8, paddingVertical:3, borderRadius:2 },
  badgeText:    { fontFamily:'SpaceMono', fontSize:9, letterSpacing:1 },
  detailMeta:   { fontFamily:'SpaceMono', fontSize:9, color:C.txt3, alignSelf:'center' },
  metaRow:      { flexDirection:'row', gap:12 },
  metaKey:      { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, letterSpacing:1, textTransform:'uppercase', width:56 },
  metaVal:      { fontFamily:'SpaceMono', fontSize:9, color:C.txt2, flex:1 },
  divider:      { height:1, backgroundColor:C.border },
  sectionLabel: { fontFamily:'SpaceMono', fontSize:8, letterSpacing:2, color:C.txt3, textTransform:'uppercase' },
  summary:      { fontSize:11, color:C.txt1, lineHeight:18 },
  relTrack:     { flex:1, height:4, backgroundColor:C.borderMd, borderRadius:2, overflow:'hidden' },
  relFill:      { height:'100%', borderRadius:2 },
  relVal:       { fontFamily:'SpaceMono', fontSize:13, color:C.txt1, fontWeight:'600' },
  statusMsg:    { fontFamily:'SpaceMono', fontSize:10, letterSpacing:1 },
  aiPromo:      { padding:12, backgroundColor:'rgba(0,200,255,0.03)', borderWidth:1, borderColor:C.border, borderRadius:3 },
  aiPromoTitle: { fontFamily:'SpaceMono', fontSize:8, letterSpacing:2, color:C.cyan, marginBottom:4 },
  aiPromoText:  { fontSize:9, color:C.txt3, lineHeight:14 },
})
