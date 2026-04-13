// Home — dashboard preview of all modules
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { router }                                        from 'expo-router'
import { useQilinData }                                  from '../../hooks/useQilinData'
import { MOCK_NEWS }                                     from '../../data/mockNews'
import { MOCK_DOCUMENTS }                                from '../../data/mockDocuments'
import { MOCK_POSTS, TRENDING_TOPICS }                   from '../../data/mockSocial'
import { C, SEV_COLOR }                                  from '../../theme'

function Dot({ color }) {
  return <View style={[s.dot, { backgroundColor:color, shadowColor:color }]} />
}

function ModuleCard({ title, icon, subtitle, status, statusColor, onPress, children }) {
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <Text style={s.cardIcon}>{icon}</Text>
          <View>
            <Text style={s.cardTitle}>{title}</Text>
            <Text style={s.cardSub}>{subtitle}</Text>
          </View>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
          <Dot color={statusColor} />
          <Text style={[s.cardStatus, { color:statusColor }]}>{status}</Text>
        </View>
      </View>
      <View style={s.cardBody}>{children}</View>
    </Pressable>
  )
}

function StatGrid({ aircraft, vessels, alerts }) {
  const rows = [
    { label:'AERONAVES', value:aircraft.length, sub:`${aircraft.filter(a=>a.type==='military').length} mil`, color:C.cyan },
    { label:'BUQUES',    value:vessels.length,  sub:`${vessels.filter(v=>v.type==='military').length} mil`,  color:C.green },
    { label:'ALT HIGH',  value:alerts.filter(a=>a.severity==='high').length,   sub:'activas', color:C.red },
    { label:'ALT MED',   value:alerts.filter(a=>a.severity==='medium').length, sub:'activas', color:C.amber },
  ]
  return (
    <View style={s.statGrid}>
      {rows.map(r => (
        <View key={r.label} style={s.statCell}>
          <Text style={[s.statVal, { color:r.color }]}>{r.value}</Text>
          <Text style={s.statLabel}>{r.label}</Text>
          <Text style={s.statSub}>{r.sub}</Text>
        </View>
      ))}
    </View>
  )
}

function NewsRows() {
  return (
    <>
      {MOCK_NEWS.slice(0,3).map(n => (
        <View key={n.id} style={s.row}>
          <View style={[s.rowDot, { backgroundColor:SEV_COLOR[n.severity] }]} />
          <View style={{ flex:1 }}>
            <Text style={s.rowTitle} numberOfLines={1}>{n.title}</Text>
            <Text style={s.rowMeta}>{n.source} · {n.time} UTC</Text>
          </View>
        </View>
      ))}
    </>
  )
}

function TrendRows() {
  return (
    <>
      {TRENDING_TOPICS.slice(0,3).map(t => (
        <View key={t.topic} style={s.row}>
          <View style={{ flex:1 }}>
            <Text style={[s.rowTitle, { color:C.cyan }]}>{t.topic}</Text>
            <Text style={s.rowMeta}>{t.zone}</Text>
          </View>
          <View style={{ alignItems:'flex-end' }}>
            <Text style={[s.rowTitle, { color:C.txt1 }]}>{(t.count/1000).toFixed(1)}K</Text>
            <Text style={[s.rowMeta, { color:C.green }]}>{t.delta}</Text>
          </View>
        </View>
      ))}
    </>
  )
}

export default function HomeScreen() {
  const { aircraft, vessels, alerts, wsStatus } = useQilinData()
  const pending = MOCK_DOCUMENTS.filter(d => d.status === 'pending' || d.status === 'analyzing').length

  const statusItems = [
    { label:'ADS-B',   color:C.green, val:`${aircraft.length} ent.` },
    { label:'AIS',     color:C.green, val:`${vessels.length} ent.`  },
    { label:'NOTICIAS',color:C.amber, val:`${MOCK_NEWS.length} art.` },
    { label:'WS',      color: wsStatus==='live' ? C.green : C.amber, val:wsStatus.toUpperCase() },
  ]

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding:16, gap:12, paddingBottom:32 }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>◎ QILIN</Text>
        <Text style={s.headerSub}>INTELIGENCIA GEOPOLÍTICA</Text>
      </View>

      {/* System status strip */}
      <View style={s.statusStrip}>
        {statusItems.map(i => (
          <View key={i.label} style={s.statusItem}>
            <Dot color={i.color} />
            <Text style={[s.statusLabel, { color:i.color }]}>{i.label}</Text>
            <Text style={s.statusVal}>{i.val}</Text>
          </View>
        ))}
      </View>

      {/* Cards */}
      <ModuleCard
        title="Mapa Táctico"  icon="◎"
        subtitle="ADS-B · AIS · ALERTAS"
        status="LIVE"  statusColor={C.green}
        onPress={() => router.push('/(tabs)/tactical')}
      >
        <StatGrid aircraft={aircraft} vessels={vessels} alerts={alerts} />
      </ModuleCard>

      <ModuleCard
        title="Noticias"  icon="◈"
        subtitle="OSINT · PRENSA INT."
        status={`${MOCK_NEWS.filter(n=>n.severity==='high').length} CRÍTICAS`}
        statusColor={C.red}
        onPress={() => router.push('/(tabs)/news')}
      >
        <NewsRows />
      </ModuleCard>

      <ModuleCard
        title="Documentos"  icon="▣"
        subtitle="PDF · DOCX · ANÁLISIS IA"
        status={pending > 0 ? `${pending} PEND.` : 'AL DÍA'}
        statusColor={pending > 0 ? C.amber : C.green}
        onPress={() => router.push('/(tabs)/documents')}
      >
        {MOCK_DOCUMENTS.slice(0,3).map(d => (
          <View key={d.id} style={s.row}>
            <Text style={s.rowTitle} numberOfLines={1}>{d.name}</Text>
          </View>
        ))}
      </ModuleCard>

      <ModuleCard
        title="Redes Sociales"  icon="◉"
        subtitle="X · TELEGRAM · ZONAS"
        status={`${TRENDING_TOPICS.length} TREND`}
        statusColor={C.cyan}
        onPress={() => router.push('/(tabs)/social')}
      >
        <TrendRows />
      </ModuleCard>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:C.bg0 },
  header:      { alignItems:'center', paddingVertical:12 },
  headerTitle: { fontSize:22, color:C.cyan, letterSpacing:6, fontFamily:'SpaceMono' },
  headerSub:   { fontSize:8, color:C.txt3, letterSpacing:3, marginTop:3 },

  statusStrip: { flexDirection:'row', backgroundColor:C.bg1, borderWidth:1, borderColor:C.borderMd, borderRadius:3, padding:10, gap:12 },
  statusItem:  { flexDirection:'row', alignItems:'center', gap:4 },
  statusLabel: { fontSize:8, letterSpacing:1, fontFamily:'SpaceMono' },
  statusVal:   { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', marginLeft:2 },

  dot: { width:5, height:5, borderRadius:3, shadowOpacity:0.8, shadowRadius:4, elevation:2 },

  card:        { backgroundColor:C.bg1, borderWidth:1, borderColor:C.borderMd, borderRadius:3, overflow:'hidden' },
  cardHeader:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:12, borderBottomWidth:1, borderBottomColor:C.border },
  cardIcon:    { fontSize:18, color:C.cyan },
  cardTitle:   { fontSize:10, color:C.cyan, letterSpacing:2, fontFamily:'SpaceMono', fontWeight:'700' },
  cardSub:     { fontSize:8, color:C.txt3, letterSpacing:1, marginTop:1 },
  cardStatus:  { fontSize:8, letterSpacing:1, fontFamily:'SpaceMono' },
  cardBody:    { paddingVertical:4 },

  statGrid:    { flexDirection:'row', flexWrap:'wrap' },
  statCell:    { width:'50%', padding:12, borderRightWidth:1, borderBottomWidth:1, borderColor:C.border },
  statVal:     { fontSize:28, fontFamily:'SpaceMono', fontWeight:'500', lineHeight:32 },
  statLabel:   { fontSize:7, color:C.txt3, letterSpacing:2, marginTop:2, textTransform:'uppercase' },
  statSub:     { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', marginTop:1 },

  row:         { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:12, paddingVertical:7, borderBottomWidth:1, borderBottomColor:C.border },
  rowDot:      { width:6, height:6, borderRadius:3 },
  rowTitle:    { fontSize:10, color:C.txt1, flex:1 },
  rowMeta:     { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', marginTop:1 },
})
