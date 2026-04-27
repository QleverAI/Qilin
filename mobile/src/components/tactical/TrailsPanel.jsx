import { useState, useEffect, useMemo } from 'react'
import { View, Text, TextInput, Pressable, FlatList, Modal,
         StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useLang } from '../../hooks/useLanguage'
import { C } from '../../theme'

const TYPE_COLOR = {
  military:     C.red,
  civil:        C.cyan,
  vip:          C.amber,
  fighter:      C.red,
  helicopter:   '#f97316',
  transport:    C.red,
  surveillance: '#a78bfa',
}

function fmt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function TrailsPanel({ visible, onClose, trails, onRemoveTrail, onAddTrail, history, histLoading, fetchHistory }) {
  const { t }          = useLang()
  const [tab,          setTab]          = useState('active')
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('all')

  useEffect(() => {
    if (visible && tab === 'history' && history.length === 0 && !histLoading) {
      fetchHistory()
    }
  }, [visible, tab])

  const filteredHistory = useMemo(() => {
    const q = search.toLowerCase()
    return history.filter(item => {
      if (q && !(item.callsign || '').toLowerCase().includes(q) && !item.icao24.includes(q)) return false
      if (typeFilter === 'mil' && item.type !== 'military') return false
      if (typeFilter === 'civ' && item.type === 'military') return false
      return true
    })
  }, [history, search, typeFilter])

  const activeList = [...trails.entries()].map(([icao24, positions]) => ({ icao24, positions }))

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={tp.safe}>
        <View style={tp.header}>
          <Text style={tp.title}>{t('tactical.trails_title')}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={tp.closeBtn}>✕</Text>
          </Pressable>
        </View>

        <View style={tp.tabs}>
          {['active', 'history'].map(tabKey => (
            <Pressable
              key={tabKey}
              style={[tp.tab, tab === tabKey && tp.tabActive]}
              onPress={() => { Haptics.selectionAsync(); setTab(tabKey) }}
            >
              <Text style={[tp.tabText, tab === tabKey && tp.tabTextActive]}>
                {tabKey === 'active' ? t('tactical.tab_active') : t('tactical.tab_history')}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'active' && (
          activeList.length === 0
            ? <View style={tp.empty}><Text style={tp.emptyText}>{t('tactical.no_trails')}</Text></View>
            : <FlatList
                data={activeList}
                keyExtractor={i => i.icao24}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingTop: 12 }}
                renderItem={({ item }) => (
                  <View style={tp.activeRow}>
                    <View style={[tp.trailDot, { backgroundColor: C.cyan }]} />
                    <Text style={tp.trailId}>{item.icao24.toUpperCase()}</Text>
                    <Text style={tp.trailCount}>{item.positions.length} pts</Text>
                    <Pressable
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRemoveTrail(item.icao24) }}
                      hitSlop={8}
                    >
                      <Text style={tp.removeBtn}>✕</Text>
                    </Pressable>
                  </View>
                )}
              />
        )}

        {tab === 'history' && (
          <View style={{ flex: 1 }}>
            <View style={tp.searchBar}>
              <TextInput
                style={tp.searchInput}
                placeholder={t('tactical.search_aircraft')}
                placeholderTextColor={C.txt3}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={tp.typeFilters}>
              {['all', 'mil', 'civ'].map(f => (
                <Pressable
                  key={f}
                  style={[tp.typePill, typeFilter === f && tp.typePillActive]}
                  onPress={() => { Haptics.selectionAsync(); setTypeFilter(f) }}
                >
                  <Text style={[tp.typePillText, typeFilter === f && tp.typePillTextActive]}>
                    {t(`tactical.filter_${f}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {histLoading
              ? <ActivityIndicator color={C.cyan} style={{ marginTop: 40 }} />
              : filteredHistory.length === 0
                ? <View style={tp.empty}><Text style={tp.emptyText}>{t('tactical.no_history')}</Text></View>
                : <FlatList
                    data={filteredHistory}
                    keyExtractor={i => i.icao24}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingTop: 8, paddingBottom: 20 }}
                    renderItem={({ item }) => (
                      <Pressable
                        style={tp.histRow}
                        onPress={() => {
                          Haptics.selectionAsync()
                          onAddTrail(item.icao24)
                          onClose()
                        }}
                      >
                        <View style={[tp.typeBar, { backgroundColor: TYPE_COLOR[item.type] || C.txt3 }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={tp.histCallsign}>{item.callsign || item.icao24.toUpperCase()}</Text>
                          <Text style={tp.histMeta}>{item.icao24.toUpperCase()} · {t('tactical.last_seen')} {fmt(item.last_seen)}</Text>
                        </View>
                        <Text style={tp.addIcon}>+</Text>
                      </Pressable>
                    )}
                  />
            }
          </View>
        )}
      </SafeAreaView>
    </Modal>
  )
}

const tp = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.bg0 },
  header:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
                       paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
                       borderBottomColor: 'rgba(255,255,255,0.08)' },
  title:             { flex: 1, fontSize: 20, fontWeight: '700', color: '#ffffff' },
  closeBtn:          { fontSize: 16, color: 'rgba(235,235,245,0.4)', paddingLeft: 8 },
  tabs:              { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab:               { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10,
                       backgroundColor: 'rgba(255,255,255,0.05)' },
  tabActive:         { backgroundColor: 'rgba(100,210,255,0.15)' },
  tabText:           { fontSize: 14, fontWeight: '600', color: 'rgba(235,235,245,0.4)' },
  tabTextActive:     { color: C.cyan },
  empty:             { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText:         { fontSize: 15, color: 'rgba(235,235,245,0.3)' },
  activeRow:         { flexDirection: 'row', alignItems: 'center', gap: 10,
                       backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12 },
  trailDot:          { width: 8, height: 8, borderRadius: 4 },
  trailId:           { flex: 1, fontSize: 14, fontWeight: '600', color: '#ffffff', fontFamily: 'SpaceMono' },
  trailCount:        { fontSize: 12, color: 'rgba(235,235,245,0.4)' },
  removeBtn:         { fontSize: 14, color: 'rgba(235,235,245,0.3)', paddingHorizontal: 4 },
  searchBar:         { paddingHorizontal: 16, paddingTop: 12 },
  searchInput:       { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
                       paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#ffffff',
                       borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  typeFilters:       { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  typePill:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
                       backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
                       borderColor: 'rgba(255,255,255,0.08)' },
  typePillActive:    { backgroundColor: 'rgba(100,210,255,0.15)', borderColor: 'rgba(100,210,255,0.4)' },
  typePillText:      { fontSize: 13, fontWeight: '600', color: 'rgba(235,235,245,0.4)' },
  typePillTextActive:{ color: C.cyan },
  histRow:           { flexDirection: 'row', alignItems: 'center', gap: 10,
                       backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12 },
  typeBar:           { width: 3, height: 36, borderRadius: 2 },
  histCallsign:      { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  histMeta:          { fontSize: 11, color: 'rgba(235,235,245,0.4)', marginTop: 2, fontFamily: 'SpaceMono' },
  addIcon:           { fontSize: 20, color: 'rgba(100,210,255,0.6)', fontWeight: '300' },
})
