import { useState, useMemo }                                     from 'react'
import { View, Text, TextInput, ScrollView,
         Pressable, StyleSheet, FlatList }                       from 'react-native'
import { MOCK_NEWS }                                             from '../../data/mockNews'
import { C, SEV_COLOR }                                         from '../../theme'

const ALL_SEV   = ['TODOS', 'high', 'medium', 'low']
const SEV_LABEL = { high:'ALTO', medium:'MEDIO', low:'BAJO' }
const ALL_ZONES = ['TODAS', ...Array.from(new Set(MOCK_NEWS.map(n => n.zone)))]

function RelevanceBar({ value }) {
  const color = value >= 90 ? C.red : value >= 75 ? C.amber : C.green
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width:`${value}%`, backgroundColor:color }]} />
      </View>
      <Text style={[s.barVal, { color }]}>{value}</Text>
    </View>
  )
}

function NewsCard({ article, expanded, onPress }) {
  return (
    <Pressable style={[s.card, { borderLeftColor:SEV_COLOR[article.severity] }]} onPress={onPress}>
      <View style={s.cardMeta}>
        <View style={[s.sevBadge, { backgroundColor:`${SEV_COLOR[article.severity]}20`, borderColor:`${SEV_COLOR[article.severity]}44` }]}>
          <Text style={[s.sevText, { color:SEV_COLOR[article.severity] }]}>{SEV_LABEL[article.severity]}</Text>
        </View>
        <Text style={s.zone}>{article.zone}</Text>
        <Text style={s.time}>{article.time} · {article.source}</Text>
      </View>

      <Text style={s.title}>{article.title}</Text>

      {expanded && (
        <Text style={s.excerpt}>{article.excerpt}</Text>
      )}

      <View style={s.footer}>
        <View style={{ flexDirection:'row', gap:6, flex:1, flexWrap:'wrap' }}>
          {article.tags.map(t => (
            <Text key={t} style={s.tag}>#{t}</Text>
          ))}
        </View>
        <View style={{ width:80 }}>
          <RelevanceBar value={article.relevance} />
        </View>
      </View>
    </Pressable>
  )
}

export default function NewsScreen() {
  const [sevFilter,  setSevFilter]  = useState('TODOS')
  const [zoneFilter, setZoneFilter] = useState('TODAS')
  const [search,     setSearch]     = useState('')
  const [expanded,   setExpanded]   = useState(null)

  const filtered = useMemo(() => MOCK_NEWS.filter(n => {
    if (sevFilter  !== 'TODOS' && n.severity !== sevFilter)  return false
    if (zoneFilter !== 'TODAS' && n.zone     !== zoneFilter) return false
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [sevFilter, zoneFilter, search])

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>◈ NOTICIAS</Text>
        <Text style={s.count}>{filtered.length} resultados</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Buscar en titulares..."
          placeholderTextColor={C.txt3}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Severity filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:16 }}>
        {ALL_SEV.map(s2 => (
          <Pressable key={s2} style={[s.chip, sevFilter===s2 && s.chipActive]} onPress={() => setSevFilter(s2)}>
            <Text style={[s.chipText, sevFilter===s2 && s.chipTextActive]}>
              {s2 === 'TODOS' ? 'TODOS' : SEV_LABEL[s2]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Zone filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:16, paddingBottom:8 }}>
        {ALL_ZONES.map(z => (
          <Pressable key={z} style={[s.chip, zoneFilter===z && s.chipActive]} onPress={() => setZoneFilter(z)}>
            <Text style={[s.chipText, zoneFilter===z && s.chipTextActive]}>{z}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Articles */}
      <FlatList
        data={filtered}
        keyExtractor={a => String(a.id)}
        contentContainerStyle={{ padding:12, gap:8, paddingBottom:32 }}
        renderItem={({ item }) => (
          <NewsCard
            article={item}
            expanded={expanded === item.id}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={s.empty}>Sin resultados para los filtros seleccionados</Text>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex:1, backgroundColor:C.bg0 },
  header:       { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.borderMd },
  headerTitle:  { color:C.cyan, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, flex:1 },
  count:        { color:C.txt3, fontFamily:'SpaceMono', fontSize:9, letterSpacing:1 },
  searchWrap:   { padding:12, paddingBottom:6 },
  search:       { backgroundColor:C.bg2, borderWidth:1, borderColor:C.borderMd, color:C.txt1, fontFamily:'SpaceMono', fontSize:11, padding:10, borderRadius:3 },
  filterRow:    { flexGrow:0, paddingTop:6 },
  chip:         { paddingHorizontal:10, paddingVertical:5, borderRadius:2, borderWidth:1, borderColor:C.borderMd, backgroundColor:C.bg2 },
  chipActive:   { borderColor:'rgba(0,200,255,0.5)', backgroundColor:'rgba(0,200,255,0.08)' },
  chipText:     { color:C.txt3, fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  chipTextActive:{ color:C.cyan },

  card:         { backgroundColor:C.bg2, borderWidth:1, borderColor:C.borderMd, borderLeftWidth:3, borderRadius:2, padding:12, gap:8 },
  cardMeta:     { flexDirection:'row', alignItems:'center', gap:7 },
  sevBadge:     { borderWidth:1, paddingHorizontal:6, paddingVertical:2, borderRadius:2 },
  sevText:      { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  zone:         { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, letterSpacing:1, flex:1 },
  time:         { fontFamily:'SpaceMono', fontSize:8, color:C.txt3 },
  title:        { fontSize:12, fontWeight:'600', color:C.txt1, lineHeight:17 },
  excerpt:      { fontSize:11, color:C.txt2, lineHeight:17 },
  footer:       { flexDirection:'row', alignItems:'center', gap:8 },
  tag:          { fontSize:8, fontFamily:'SpaceMono', color:C.txt3, backgroundColor:C.bg3, paddingHorizontal:5, paddingVertical:2, borderRadius:2 },
  barTrack:     { flex:1, height:2, backgroundColor:C.borderMd, borderRadius:1, overflow:'hidden' },
  barFill:      { height:'100%', borderRadius:1 },
  barVal:       { fontFamily:'SpaceMono', fontSize:8 },
  empty:        { textAlign:'center', padding:40, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },
})
