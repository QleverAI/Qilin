import { useState, useEffect, useCallback, useMemo }          from 'react'
import { View, Text, Pressable, StyleSheet, FlatList,
         Modal, ScrollView, SafeAreaView, RefreshControl }   from 'react-native'
import * as DocumentPicker                                    from 'expo-document-picker'
import * as Haptics                                           from 'expo-haptics'
import { useDocsFeed }                                        from '../../hooks/useDocsFeed'
import { useLang }                                            from '../../hooks/useLanguage'
import { PageHeader }                                         from '../../components/PageHeader'
import { SeverityBadge }                                      from '../../components/SeverityBadge'
import { EmptyState }                                         from '../../components/EmptyState'
import { C, T }                                               from '../../theme'
import { useBreakpoint }                                      from '../../theme/responsive'

const STATUS_MAP    = { processed: 'analyzed', failed: 'archived', pending: 'pending' }
const STATUS_COLOR  = { analyzed: C.green, analyzing: C.amber, pending: C.txt3, archived: C.red }
const ORG_ICONS     = { defense: '🛡', international: '🌐', think_tank: '🔬', energy: '⚡', government: '🏛', default: '📄' }
const FILTER_KEYS   = ['all', 'analyzed', 'pending', 'archived']

function mapStatus(s) { return STATUS_MAP[s] || 'pending' }

function fmtDate(iso) {
  if (!iso) return '?'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtSize(kb) {
  if (!kb) return '?'
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}

function DocRow({ doc, onPress, statusLabel, pagesLabel }) {
  const status = mapStatus(doc.status)
  const color  = STATUS_COLOR[status]
  const icon   = ORG_ICONS[doc.org_type] || ORG_ICONS.default
  return (
    <Pressable style={s.row} onPress={onPress}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{doc.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <Text style={[s.rowStatus, { color }]}>{statusLabel(status)}</Text>
          {(doc.sectors || []).slice(0, 2).map(sec => (
            <Text key={sec} style={s.rowSector}>{sec}</Text>
          ))}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={s.rowSize}>{fmtSize(doc.file_size_kb)}</Text>
        <Text style={s.rowPages}>{pagesLabel({ n: doc.page_count })}</Text>
      </View>
      <Text style={s.rowChevron}>›</Text>
    </Pressable>
  )
}

function DocModal({ doc, onClose, statusLabel, t }) {
  if (!doc) return null
  const status = mapStatus(doc.status)
  const color  = STATUS_COLOR[status]
  const icon   = ORG_ICONS[doc.org_type] || ORG_ICONS.default
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modalSafe}>
        <View style={s.modalHandle} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={s.modalIcon}>{icon}</Text>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>

          <Text style={s.modalTitle}>{doc.title}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.statusBadge, { backgroundColor: `${color}20` }]}>
              <Text style={[s.statusBadgeText, { color }]}>{statusLabel(status)}</Text>
            </View>
            <Text style={s.modalMeta}>{fmtSize(doc.file_size_kb)} · {t('docs.pages', { n: doc.page_count })}</Text>
          </View>

          <View style={s.metaCard}>
            {[
              [t('sec.meta_date'),     fmtDate(doc.time)],
              ['Source',               doc.source],
              [t('docs.status_' + status), statusLabel(status)],
            ].map(([k, v]) => (
              <View key={k} style={s.metaRow}>
                <Text style={s.metaKey}>{k}</Text>
                <Text style={s.metaVal}>{v}</Text>
              </View>
            ))}
          </View>

          <View style={s.divider} />

          <Text style={s.sectionLabel}>{t('sec.summary')}</Text>
          {status === 'analyzed' && doc.summary ? (
            <>
              <Text style={s.summary}>{doc.summary}</Text>
              {doc.relevance != null && (
                <View style={{ gap: 6 }}>
                  <Text style={s.sectionLabel}>{t('sec.relevance')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={s.relTrack}>
                      <View style={[s.relFill, {
                        width: `${doc.relevance}%`,
                        backgroundColor: doc.relevance >= 80 ? C.red : doc.relevance >= 60 ? C.amber : C.green,
                      }]} />
                    </View>
                    <Text style={s.relVal}>{doc.relevance}</Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <Text style={[s.summary, { color: status === 'analyzing' ? C.amber : C.txt3 }]}>
              {statusLabel(status)}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

export default function DocumentsScreen() {
  const { t } = useLang()
  const { documents, loading } = useDocsFeed()
  const { hPad } = useBreakpoint()
  const [localDocs,  setLocalDocs]  = useState([])
  const [filter,     setFilter]     = useState('all')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)

  const statusLabel = useCallback((key) => {
    return t(`docs.status_${key}`) || key
  }, [t])

  const filterLabel = useCallback((key) => {
    if (key === 'all') return t('common.all')
    return t(`docs.status_${key}`) || key
  }, [t])

  useEffect(() => {
    setLocalDocs(prev => {
      const localOnly = prev.filter(d => String(d.id).startsWith('local-'))
      return [...localOnly, ...documents]
    })
  }, [documents])

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, type: '*/*' })
    if (res.canceled) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
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

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const filtered = filter === 'all'
    ? localDocs
    : localDocs.filter(d => mapStatus(d.status) === filter)

  const counts = useMemo(() => {
    const out = { all: localDocs.length }
    for (const k of ['analyzed', 'pending', 'archived']) {
      out[k] = localDocs.filter(d => mapStatus(d.status) === k).length
    }
    return out
  }, [localDocs])

  return (
    <View style={s.root}>
      <PageHeader
        title={t('docs.title')}
        subtitle={t('docs.count', { n: localDocs.length })}
        right={
          <Pressable style={s.uploadBtn} onPress={pickDocument}>
            <Text style={s.uploadText}>+ {t('common.save')}</Text>
          </Pressable>
        }
      />

      <View style={s.filterTabs}>
        {FILTER_KEYS.map(f => (
          <Pressable key={f} style={[s.filterTab, filter === f && s.filterTabActive]} onPress={() => {
            Haptics.selectionAsync()
            setFilter(f)
          }}>
            <Text style={[s.filterTabLabel, filter === f && s.filterTabLabelActive]}>{filterLabel(f)}</Text>
            <Text style={[s.filterTabCount, filter === f && { color: C.blue }]}>{counts[f] || 0}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={d => String(d.id)}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        ItemSeparatorComponent={() => <View style={[s.sep, { marginLeft: 58 }]} />}
        renderItem={({ item }) => (
          <DocRow
            doc={item}
            onPress={() => setSelectedDoc(item)}
            statusLabel={statusLabel}
            pagesLabel={(params) => t('docs.pages', params)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={loading ? null : '📁'}
            title={loading ? t('docs.loading') : t('docs.empty')}
            subtitle={loading ? null : t('docs.suggest')}
          />
        }
      />

      <DocModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} statusLabel={statusLabel} t={t} />
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg0 },
  uploadBtn:    { backgroundColor: C.blueFill, paddingHorizontal: 14, paddingVertical: 7,
                  borderRadius: 20 },
  uploadText:   { fontSize: 14, fontWeight: '600', color: C.blue },
  filterTabs:   { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator },
  filterTab:    { flex: 1, alignItems: 'center', paddingVertical: 10,
                  borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterTabActive:      { borderBottomColor: C.blue },
  filterTabLabel:       { fontSize: 12, color: C.txt3, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  filterTabLabelActive: { color: C.blue },
  filterTabCount:       { fontSize: 22, fontWeight: '300', color: C.txt2, marginTop: 2 },
  sep:          { height: StyleSheet.hairlineWidth, backgroundColor: C.separator },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon:      { fontSize: 24, width: 34, textAlign: 'center' },
  rowTitle:     { fontSize: 15, fontWeight: '500', color: '#ffffff' },
  rowStatus:    { fontSize: 12, fontWeight: '500' },
  rowSector:    { fontSize: 12, color: C.txt3 },
  rowSize:      { fontSize: 13, color: C.txt3 },
  rowPages:     { fontSize: 12, color: C.txt3 },
  rowChevron:   { fontSize: 20, color: C.txt3, fontWeight: '300' },
  modalSafe:    { flex: 1, backgroundColor: C.bg1 },
  modalHandle:  { width: 36, height: 4, backgroundColor: C.bg3, borderRadius: 2,
                  alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalIcon:    { fontSize: 40 },
  modalTitle:   { fontSize: 22, fontWeight: '700', color: '#ffffff', lineHeight: 28 },
  modalMeta:    { fontSize: 13, color: C.txt3 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 13, fontWeight: '600' },
  metaCard:     { backgroundColor: C.bg2, borderRadius: 12, overflow: 'hidden' },
  metaRow:      { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
                  borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator },
  metaKey:      { fontSize: 13, color: C.txt3, width: 72 },
  metaVal:      { fontSize: 15, color: '#ffffff', flex: 1 },
  divider:      { height: StyleSheet.hairlineWidth, backgroundColor: C.separator },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: C.txt3,
                  textTransform: 'uppercase', letterSpacing: 0.5 },
  summary:      { fontSize: 16, color: '#ffffff', lineHeight: 24 },
  relTrack:     { flex: 1, height: 4, backgroundColor: C.bg3, borderRadius: 2, overflow: 'hidden' },
  relFill:      { height: '100%', borderRadius: 2 },
  relVal:       { fontSize: 15, fontWeight: '600', color: '#ffffff', width: 32, textAlign: 'right' },
  closeBtn:     { padding: 8 },
  closeText:    { fontSize: 18, color: C.txt3 },
})
