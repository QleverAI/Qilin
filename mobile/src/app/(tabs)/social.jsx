import { useState, useMemo }                                      from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView } from 'react-native'
import { useSocialFeed }                                          from '../../hooks/useSocialFeed'
import { C }                                                      from '../../theme'

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
}

function PostCard({ post }) {
  const engagements = (post.likes || 0) + (post.retweets || 0)
  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <View style={s.platBadge}>
          <Text style={s.platText}>X</Text>
        </View>
        <Text style={s.postUser}>@{post.handle}</Text>
        {post.display ? <Text style={s.displayName}>{post.display}</Text> : null}
        <Text style={s.postTime}>{fmt(post.time)} UTC</Text>
      </View>

      <Text style={s.postText}>{post.content}</Text>

      <View style={s.postFooter}>
        {post.category ? (
          <Text style={s.catTag}>{post.category}</Text>
        ) : null}
        <Text style={s.engagements}>↑ {engagements.toLocaleString()}</Text>
        {post.zone ? (
          <View style={s.zonePill}>
            <Text style={s.zoneText}>{post.zone}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default function SocialScreen() {
  const { posts, zones, categories, loading } = useSocialFeed()

  const [zoneFilter,     setZoneFilter]     = useState('TODAS')
  const [categoryFilter, setCategoryFilter] = useState('TODOS')

  const ALL_ZONES      = ['TODAS', ...zones]
  const ALL_CATEGORIES = ['TODOS', ...categories]

  const filtered = useMemo(() => posts.filter(p => {
    if (zoneFilter     !== 'TODAS' && p.zone     !== zoneFilter)     return false
    if (categoryFilter !== 'TODOS' && p.category !== categoryFilter) return false
    return true
  }), [posts, zoneFilter, categoryFilter])

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>◉ SOCIAL</Text>
        <Text style={s.count}>{filtered.length} publicaciones</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:12, paddingVertical:8 }}>
        {ALL_ZONES.map(z => (
          <Pressable key={z} style={[s.chip, zoneFilter===z && s.chipActive]} onPress={() => setZoneFilter(z)}>
            <Text style={[s.chipText, zoneFilter===z && { color:C.cyan }]}>{z}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap:6, paddingHorizontal:12, paddingBottom:8 }}>
        {ALL_CATEGORIES.map(c => (
          <Pressable key={c} style={[s.chip, categoryFilter===c && s.chipActive]} onPress={() => setCategoryFilter(c)}>
            <Text style={[s.chipText, categoryFilter===c && { color:C.cyan }]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={p => String(p.tweet_id)}
        contentContainerStyle={{ padding:12, gap:8, paddingBottom:32 }}
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={
          <Text style={s.empty}>
            {loading ? 'Cargando publicaciones...' : 'No hay publicaciones para los filtros seleccionados'}
          </Text>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:C.bg0 },
  header:     { flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.borderMd },
  headerTitle:{ color:C.cyan, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, flex:1 },
  count:      { color:C.txt3, fontFamily:'SpaceMono', fontSize:9, letterSpacing:1 },
  filterRow:  { flexGrow:0 },
  chip:       { paddingHorizontal:10, paddingVertical:5, borderRadius:2, borderWidth:1, borderColor:C.borderMd, backgroundColor:C.bg2 },
  chipActive: { borderColor:'rgba(0,200,255,0.4)', backgroundColor:'rgba(0,200,255,0.06)' },
  chipText:   { color:C.txt3, fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  postCard:   { backgroundColor:C.bg2, borderWidth:1, borderColor:C.borderMd, borderRadius:3, padding:12, gap:8 },
  postHeader: { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' },
  platBadge:  { backgroundColor:'rgba(0,0,0,0.4)', borderWidth:1, borderColor:'rgba(255,255,255,0.15)', paddingHorizontal:5, paddingVertical:1, borderRadius:2 },
  platText:   { fontFamily:'SpaceMono', fontSize:8, color:C.txt2, letterSpacing:1 },
  postUser:   { fontFamily:'SpaceMono', fontSize:10, color:C.cyan },
  displayName:{ fontFamily:'SpaceMono', fontSize:8, color:C.txt3, flex:1 },
  postTime:   { fontFamily:'SpaceMono', fontSize:8, color:C.txt3 },
  postText:   { fontSize:11, color:C.txt1, lineHeight:17 },
  postFooter: { flexDirection:'row', alignItems:'center', gap:6 },
  catTag:     { fontSize:8, fontFamily:'SpaceMono', color:C.txt3, backgroundColor:C.bg3, paddingHorizontal:5, paddingVertical:2, borderRadius:2 },
  engagements:{ fontFamily:'SpaceMono', fontSize:9, color:C.txt3, flex:1 },
  zonePill:   { backgroundColor:C.bg3, borderWidth:1, borderColor:C.borderMd, paddingHorizontal:6, paddingVertical:2, borderRadius:2 },
  zoneText:   { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, letterSpacing:1 },
  empty:      { textAlign:'center', padding:40, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },
})
