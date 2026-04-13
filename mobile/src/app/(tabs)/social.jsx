import { useState, useMemo }                                      from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView } from 'react-native'
import { MOCK_POSTS, TRENDING_TOPICS, PLATFORM_COLORS }            from '../../data/mockSocial'
import { C }                                                        from '../../theme'

const SENT_COLOR = { negative:C.red, neutral:C.amber, positive:C.green }
const SENT_LABEL = { negative:'NEG', neutral:'NEU', positive:'POS' }
const ALL_ZONES  = ['TODAS', ...Array.from(new Set(MOCK_POSTS.map(p => p.zone)))]

function TrendChip({ topic, active, onPress }) {
  return (
    <Pressable style={[s.trendChip, active && s.trendChipActive]} onPress={onPress}>
      <Text style={[s.trendTopic, active && { color:C.cyan }]}>{topic.topic}</Text>
      <Text style={s.trendCount}>{(topic.count/1000).toFixed(1)}K</Text>
      <Text style={s.trendDelta}>{topic.delta}</Text>
      <Text style={s.trendZone}>{topic.zone}</Text>
    </Pressable>
  )
}

function PostCard({ post }) {
  const sentColor = SENT_COLOR[post.sentiment]
  const platColor = PLATFORM_COLORS[post.platform] || '#888'
  return (
    <View style={s.postCard}>
      {/* Header */}
      <View style={s.postHeader}>
        <View style={[s.platBadge, { backgroundColor:`${platColor}18`, borderColor:`${platColor}44` }]}>
          <Text style={[s.platText, { color:platColor }]}>{post.platform}</Text>
        </View>
        <Text style={s.postUser}>{post.user}</Text>
        {post.verified && <Text style={s.verified}>✓</Text>}
        <Text style={s.postTime}>{post.time} UTC</Text>
        <View style={[s.sentBadge, { backgroundColor:`${sentColor}18`, borderColor:`${sentColor}33` }]}>
          <Text style={[s.sentText, { color:sentColor }]}>{SENT_LABEL[post.sentiment]}</Text>
        </View>
      </View>

      {/* Text */}
      <Text style={s.postText}>{post.text}</Text>

      {/* Footer */}
      <View style={s.postFooter}>
        <View style={{ flexDirection:'row', gap:6, flex:1, flexWrap:'wrap' }}>
          {post.tags.map(t => <Text key={t} style={s.tag}>#{t}</Text>)}
        </View>
        <Text style={s.engagements}>↑ {post.engagements.toLocaleString()}</Text>
        <View style={s.zonePill}>
          <Text style={s.zoneText}>{post.zone}</Text>
        </View>
      </View>
    </View>
  )
}

export default function SocialScreen() {
  const [zoneFilter,     setZoneFilter]     = useState('TODAS')
  const [platformFilter, setPlatformFilter] = useState('TODOS')
  const [sentFilter,     setSentFilter]     = useState('TODOS')

  const filtered = useMemo(() => MOCK_POSTS.filter(p => {
    if (zoneFilter     !== 'TODAS' && p.zone     !== zoneFilter)     return false
    if (platformFilter !== 'TODOS' && p.platform !== platformFilter) return false
    if (sentFilter     !== 'TODOS' && p.sentiment !== sentFilter)    return false
    return true
  }), [zoneFilter, platformFilter, sentFilter])

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>◉ SOCIAL</Text>
        <Text style={s.count}>{filtered.length} publicaciones</Text>
      </View>

      {/* Trending strip */}
      <View style={s.trendSection}>
        <Text style={s.sectionLabel}>TENDENCIAS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8, paddingHorizontal:16, paddingBottom:8 }}>
          {TRENDING_TOPICS.map(t => (
            <TrendChip
              key={t.topic}
              topic={t}
              active={zoneFilter === t.zone}
              onPress={() => setZoneFilter(zoneFilter === t.zone ? 'TODAS' : t.zone)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Platform + sentiment filters */}
      <View style={s.filterRow}>
        {['TODOS','X','Telegram'].map(p => (
          <Pressable key={p} style={[s.chip, platformFilter===p && s.chipActive]} onPress={() => setPlatformFilter(p)}>
            <Text style={[s.chipText, platformFilter===p && { color: p==='TODOS' ? C.cyan : PLATFORM_COLORS[p] }]}>{p}</Text>
          </Pressable>
        ))}
        <View style={{ width:1, height:16, backgroundColor:C.borderMd, marginHorizontal:4 }} />
        {['TODOS','negative','neutral','positive'].map(s2 => (
          <Pressable key={s2} style={[s.chip, sentFilter===s2 && s.chipActive]} onPress={() => setSentFilter(s2)}>
            <Text style={[s.chipText, sentFilter===s2 && { color:s2==='TODOS' ? C.cyan : SENT_COLOR[s2] }]}>
              {s2 === 'TODOS' ? 'TODOS' : SENT_LABEL[s2]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Feed */}
      <FlatList
        data={filtered}
        keyExtractor={p => String(p.id)}
        contentContainerStyle={{ padding:12, gap:8, paddingBottom:32 }}
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={
          <Text style={s.empty}>No hay publicaciones para los filtros seleccionados</Text>
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
  sectionLabel: { fontFamily:'SpaceMono', fontSize:7, letterSpacing:2, color:C.txt3, paddingHorizontal:16, paddingTop:10, marginBottom:6 },
  trendSection: { borderBottomWidth:1, borderBottomColor:C.border },
  trendChip:    { padding:10, backgroundColor:C.bg2, borderWidth:1, borderColor:C.borderMd, borderRadius:3, minWidth:100, gap:2 },
  trendChipActive:{ borderColor:'rgba(0,200,255,0.4)', backgroundColor:'rgba(0,200,255,0.06)' },
  trendTopic:   { fontFamily:'SpaceMono', fontSize:10, color:C.txt2 },
  trendCount:   { fontFamily:'SpaceMono', fontSize:13, color:C.txt1, fontWeight:'600' },
  trendDelta:   { fontFamily:'SpaceMono', fontSize:9, color:C.green },
  trendZone:    { fontSize:8, color:C.txt3, marginTop:1 },

  filterRow:    { flexDirection:'row', flexWrap:'wrap', gap:6, padding:10, borderBottomWidth:1, borderBottomColor:C.border },
  chip:         { paddingHorizontal:8, paddingVertical:4, borderRadius:2, borderWidth:1, borderColor:C.borderMd },
  chipActive:   { borderColor:'rgba(0,200,255,0.4)', backgroundColor:'rgba(0,200,255,0.06)' },
  chipText:     { color:C.txt3, fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },

  postCard:     { backgroundColor:C.bg2, borderWidth:1, borderColor:C.borderMd, borderRadius:3, padding:12, gap:8 },
  postHeader:   { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' },
  platBadge:    { borderWidth:1, paddingHorizontal:5, paddingVertical:1, borderRadius:2 },
  platText:     { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1, fontWeight:'700' },
  postUser:     { fontFamily:'SpaceMono', fontSize:10, color:C.cyan, flex:1 },
  verified:     { fontSize:10, color:'#1d9bf0' },
  postTime:     { fontFamily:'SpaceMono', fontSize:8, color:C.txt3 },
  sentBadge:    { borderWidth:1, paddingHorizontal:5, paddingVertical:1, borderRadius:2 },
  sentText:     { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  postText:     { fontSize:11, color:C.txt1, lineHeight:17 },
  postFooter:   { flexDirection:'row', alignItems:'center', gap:6 },
  tag:          { fontSize:8, fontFamily:'SpaceMono', color:C.txt3 },
  engagements:  { fontFamily:'SpaceMono', fontSize:9, color:C.txt3 },
  zonePill:     { backgroundColor:C.bg3, borderWidth:1, borderColor:C.borderMd, paddingHorizontal:6, paddingVertical:2, borderRadius:2 },
  zoneText:     { fontFamily:'SpaceMono', fontSize:8, color:C.txt3, letterSpacing:1 },
  empty:        { textAlign:'center', padding:40, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },
})
