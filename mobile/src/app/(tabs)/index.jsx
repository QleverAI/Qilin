import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { router }                                        from 'expo-router'
import { useQilinData }                                  from '../../hooks/useQilinData'
import { useNewsFeed }                                   from '../../hooks/useNewsFeed'
import { useDocsFeed }                                   from '../../hooks/useDocsFeed'
import { useSocialFeed }                                 from '../../hooks/useSocialFeed'
import { useSecFeed }                                    from '../../hooks/useSecFeed'
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

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
}

export default function HomeScreen() {
  const { aircraft, vessels, alerts, wsStatus } = useQilinData()
  const { articles }  = useNewsFeed()
  const { documents } = useDocsFeed()
  const { posts }     = useSocialFeed()
  const { filings }   = useSecFeed()

  const today = new Date().toDateString()
  const todayFilings = filings.filter(f => f.time && new Date(f.time).toDateString() === today)

  const statusItems = [
    { label:'ADS-B',    color:C.green, val:`${aircraft.length} ent.` },
    { label:'AIS',      color:C.green, val:`${vessels.length} ent.`  },
    { label:'NOTICIAS', color:articles.length ? C.green : C.amber, val:`${articles.length} art.` },
    { label:'WS',       color:wsStatus==='live' ? C.green : C.amber, val:wsStatus.toUpperCase() },
  ]

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding:16, gap:12, paddingBottom:32 }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>◎ QILIN</Text>
        <Text style={s.headerSub}>INTELIGENCIA GEOPOLÍTICA</Text>
      </View>

      <View style={s.statusStrip}>
        {statusItems.map(i => (
          <View key={i.label} style={s.statusItem}>
            <Dot color={i.color} />
            <Text style={[s.statusLabel, { color:i.color }]}>{i.label}</Text>
            <Text style={s.statusVal}>{i.val}</Text>
          </View>
        ))}
      </View>

      <ModuleCard
        title="Mapa Táctico" icon="◎"
        subtitle="ADS-B · AIS · ALERTAS"
        status="LIVE" statusColor={C.green}
        onPress={() => router.push('/(tabs)/tactical')}
      >
        <StatGrid aircraft={aircraft} vessels={vessels} alerts={alerts} />
      </ModuleCard>

      <ModuleCard
        title="Noticias" icon="◈"
        subtitle="OSINT · PRENSA INT."
        status={`${articles.filter(n=>n.severity==='high').length} CRÍTICAS`}
        statusColor={articles.some(n=>n.severity==='high') ? C.red : C.green}
        onPress={() => router.push('/(tabs)/news')}
      >
        {articles.slice(0,3).map(n => (
          <View key={n.id} style={s.row}>
            <View style={[s.rowDot, { backgroundColor:SEV_COLOR[n.severity] }]} />
            <View style={{ flex:1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={s.rowMeta}>{n.source} · {fmt(n.time)} UTC</Text>
            </View>
          </View>
        ))}
        {articles.length === 0 && <Text style={s.rowEmpty}>Sin noticias recientes</Text>}
      </ModuleCard>

      <ModuleCard
        title="Documentos" icon="▣"
        subtitle="PDF · ANÁLISIS"
        status={`${documents.length} docs`}
        statusColor={C.green}
        onPress={() => router.push('/(tabs)/documents')}
      >
        {documents.slice(0,3).map(d => (
          <View key={d.id} style={s.row}>
            <Text style={s.rowTitle} numberOfLines={1}>{d.title}</Text>
          </View>
        ))}
        {documents.length === 0 && <Text style={s.rowEmpty}>Sin documentos recientes</Text>}
      </ModuleCard>

      <ModuleCard
        title="Redes Sociales" icon="◉"
        subtitle="X · TELEGRAM · ZONAS"
        status={`${posts.length} posts`}
        statusColor={C.cyan}
        onPress={() => router.push('/(tabs)/social')}
      >
        {posts.slice(0,3).map(p => (
          <View key={p.tweet_id} style={s.row}>
            <View style={{ flex:1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{p.content}</Text>
              <Text style={s.rowMeta}>@{p.handle} · {p.zone || '—'}</Text>
            </View>
          </View>
        ))}
        {posts.length === 0 && <Text style={s.rowEmpty}>Sin publicaciones recientes</Text>}
      </ModuleCard>

      <ModuleCard
        title="Mercados" icon="$"
        subtitle="SEC 8-K · FILINGS"
        status={todayFilings.length > 0 ? `${todayFilings.length} HOY` : 'AL DÍA'}
        statusColor={todayFilings.length > 0 ? C.amber : C.green}
        onPress={() => router.push('/(tabs)/markets')}
      >
        {filings.slice(0,3).map(f => (
          <View key={f.id} style={s.row}>
            <View style={[s.rowDot, { backgroundColor: f.severity==='high' ? C.red : C.amber }]} />
            <View style={{ flex:1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>[{f.ticker}] {f.company_name}</Text>
              <Text style={s.rowMeta}>{f.form_type} · {f.sector}</Text>
            </View>
          </View>
        ))}
        {filings.length === 0 && <Text style={s.rowEmpty}>Sin filings recientes</Text>}
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
  dot:         { width:5, height:5, borderRadius:3, shadowOpacity:0.8, shadowRadius:4, elevation:2 },
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
  rowEmpty:    { fontSize:9, color:C.txt3, fontFamily:'SpaceMono', padding:12, textAlign:'center' },
})
