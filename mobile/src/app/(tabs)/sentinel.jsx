import { useState, useMemo, useCallback }                              from 'react'
import { View, Text, Pressable, StyleSheet, FlatList,
         Modal, SafeAreaView, RefreshControl, ScrollView }             from 'react-native'
import MapView, { Polygon, PROVIDER_DEFAULT }                          from 'react-native-maps'
import * as Haptics                                                    from 'expo-haptics'
import { useSafeAreaInsets }                                            from 'react-native-safe-area-context'
import { useSentinelData }                                              from '../../hooks/useSentinelData'
import { useLang }                                                      from '../../hooks/useLanguage'
import { EmptyState }                                                   from '../../components/EmptyState'
import { C, T }                                                         from '../../theme'
import { useBreakpoint }                                                from '../../theme/responsive'
import { SENTINEL_ZONES, ZONE_BY_ID, ratioColor, ratioBadge }           from '../../data/sentinelZones'

const INITIAL_REGION = {
  latitude:       25,
  longitude:      20,
  latitudeDelta:  90,
  longitudeDelta: 120,
}

// ── helpers ──────────────────────────────────────────────────────────────────

function zoneRatio(zoneData, gas) {
  if (!zoneData) return null
  const d = gas === 'no2' ? zoneData.no2 : zoneData.so2
  return d?.ratio ?? null
}

function fmtExp(v) {
  if (v == null) return '—'
  if (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e5) return v.toExponential(2)
  return v.toFixed(3)
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const ago = Math.floor((Date.now() - d.getTime()) / 60000)
  if (ago < 60)   return `hace ${ago}m`
  if (ago < 1440) return `hace ${Math.floor(ago / 60)}h`
  return `hace ${Math.floor(ago / 1440)}d`
}

// ── Sparkline: barras de 1px normalizadas. Sin react-native-svg ─────────────

function Sparkline({ history }) {
  if (!history || history.length === 0) {
    return <Text style={s.sparkEmpty}>—</Text>
  }
  const values = history.map(h => h.value).filter(v => v != null && Number.isFinite(v))
  if (values.length === 0) return <Text style={s.sparkEmpty}>—</Text>
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  return (
    <View style={s.sparkContainer}>
      {values.map((v, i) => {
        const h = 4 + Math.round(((v - min) / range) * 32)   // 4-36 px
        return <View key={i} style={[s.sparkBar, { height: h }]} />
      })}
    </View>
  )
}

// ── ZoneSheet: bottom sheet con detalle ─────────────────────────────────────

function GasBlock({ gas, data, t }) {
  const ratio = data?.ratio
  const color = ratioColor(ratio)
  return (
    <View style={s.gasBlock}>
      <View style={s.gasHeader}>
        <Text style={s.gasName}>{gas === 'no2' ? 'NO₂' : 'SO₂'}</Text>
        {ratio != null && (
          <Text style={[s.gasRatio, { color }]}>{ratio.toFixed(2)}×</Text>
        )}
      </View>

      {data ? (
        <>
          <View style={s.metricsGrid}>
            {[
              [t('sentinel.anomaly') ?? 'Actual',  fmtExp(data.current ?? data.value)],
              [t('sentinel.baseline') ?? 'Baseline', fmtExp(data.baseline)],
            ].map(([k, v]) => (
              <View key={k} style={s.metricCell}>
                <Text style={s.metricKey}>{k}</Text>
                <Text style={s.metricVal}>{v}</Text>
              </View>
            ))}
          </View>

          <Text style={s.sparkLabel}>7 DÍAS</Text>
          <Sparkline history={data.history} />
        </>
      ) : (
        <Text style={s.noObs}>Sin observaciones recientes</Text>
      )}
    </View>
  )
}

function ZoneSheet({ visible, zone, onClose, t }) {
  if (!zone) return null
  const maxRatio = Math.max(zone.no2?.ratio ?? 0, zone.so2?.ratio ?? 0)
  const badge    = ratioBadge(maxRatio > 0 ? maxRatio : null)
  const label    = ZONE_BY_ID[zone.zone_id]?.label || zone.zone_id

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.sheetSafe}>
        <View style={s.sheetHandle} />
        <View style={s.sheetHeader}>
          <Text style={s.sheetLabel}>{label}</Text>
          <View style={[s.sheetBadge, { backgroundColor: badge.bg, borderColor: badge.color + '88' }]}>
            <Text style={[s.sheetBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }}>
          <GasBlock gas="no2" data={zone.no2} t={t} />
          <GasBlock gas="so2" data={zone.so2} t={t} />
          {zone.last_reading ? (
            <Text style={s.lastReading}>Último reading: {fmtTime(zone.last_reading)}</Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

// ── Lista lateral en tablet / overlay en móvil ──────────────────────────────

function ZoneListItem({ zone, gas, onPress }) {
  const ratio = zoneRatio(zone, gas)
  const color = ratioColor(ratio)
  const label = ZONE_BY_ID[zone.zone_id]?.label || zone.zone_id
  return (
    <Pressable style={s.listItem} onPress={onPress}>
      <View style={[s.listDot, { backgroundColor: color }]} />
      <Text style={s.listLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.listRatio, { color }]}>{ratio != null ? `${ratio.toFixed(2)}×` : '—'}</Text>
    </Pressable>
  )
}

// ── Pantalla ────────────────────────────────────────────────────────────────

export default function SentinelScreen() {
  const { t } = useLang()
  const insets = useSafeAreaInsets()
  const { isTablet, isWide } = useBreakpoint()
  const { zones, loading, error } = useSentinelData()

  const [activeGas, setActiveGas] = useState('no2')
  const [selectedId, setSelectedId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const dataByZone = useMemo(() => {
    const map = new Map()
    for (const z of zones) map.set(z.zone_id, z)
    return map
  }, [zones])

  const selectedZone = selectedId ? dataByZone.get(selectedId) : null

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1000)
  }, [])

  const sortedZones = useMemo(() => {
    return SENTINEL_ZONES
      .map(z => ({ ...z, data: dataByZone.get(z.zone_id) }))
      .sort((a, b) => (zoneRatio(b.data, activeGas) || 0) - (zoneRatio(a.data, activeGas) || 0))
  }, [dataByZone, activeGas])

  const showSidePanel = isTablet || isWide

  return (
    <View style={s.root}>
      <View style={{ flex: 1, flexDirection: showSidePanel ? 'row' : 'column' }}>
        {/* MAPA */}
        <View style={{ flex: 1, position: 'relative' }}>
          <MapView
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_DEFAULT}
            initialRegion={INITIAL_REGION}
            mapType="mutedStandard"
            showsCompass={false}
            showsPointsOfInterest={false}
            showsBuildings={false}
            showsTraffic={false}
          >
            {SENTINEL_ZONES.map(zone => {
              const data = dataByZone.get(zone.zone_id)
              const ratio = zoneRatio(data, activeGas)
              const fill = ratioColor(ratio)
              return (
                <Polygon
                  key={zone.zone_id}
                  coordinates={zone.coordinates}
                  fillColor={fill + '88'}
                  strokeColor={fill}
                  strokeWidth={1}
                  tappable
                  onPress={() => {
                    Haptics.selectionAsync()
                    setSelectedId(zone.zone_id)
                  }}
                />
              )
            })}
          </MapView>

          {/* Toggle NO2/SO2 */}
          <View style={[s.overlay, { top: insets.top + 10, left: 12 }]}>
            <View style={s.toggleGroup}>
              {['no2', 'so2'].map(gas => (
                <Pressable
                  key={gas}
                  onPress={() => { Haptics.selectionAsync(); setActiveGas(gas) }}
                  style={[s.toggleBtn, activeGas === gas && s.toggleBtnActive]}
                >
                  <Text style={[s.toggleText, activeGas === gas && s.toggleTextActive]}>
                    {gas === 'no2' ? 'NO₂' : 'SO₂'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Status */}
          <View style={[s.overlay, { top: insets.top + 10, right: 12 }]}>
            <View style={s.statusBox}>
              <Text style={[s.statusText, error && { color: C.amber }]}>
                {error ? 'DATOS DESACTUALIZADOS' :
                 loading ? 'CARGANDO...' :
                 `${zones.length} ZONAS`}
              </Text>
            </View>
          </View>

          {/* Leyenda */}
          <View style={[s.overlay, { bottom: 16, left: 12 }]}>
            <View style={s.legend}>
              {[
                { color: '#166534', label: '< 1.0× normal' },
                { color: '#854d0e', label: '1.0–1.5× elev.' },
                { color: '#9a3412', label: '1.5–2.0× anom.' },
                { color: '#991b1b', label: '> 2.0× severo' },
              ].map((it, i) => (
                <View key={i} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: it.color }]} />
                  <Text style={s.legendText}>{it.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {loading && zones.length === 0 ? (
            <View style={[StyleSheet.absoluteFillObject, s.loadingOverlay]} pointerEvents="none">
              <EmptyState icon={null} title={t('sentinel.loading')} />
            </View>
          ) : null}
        </View>

        {/* PANEL LATERAL (tablet/wide) */}
        {showSidePanel && (
          <View style={s.sidePanel}>
            <View style={s.sidePanelHeader}>
              <Text style={s.sidePanelTitle}>{t('sentinel.title')}</Text>
              <Text style={s.sidePanelSub}>
                {zones.length} · {activeGas.toUpperCase()}
              </Text>
            </View>
            <FlatList
              data={sortedZones}
              keyExtractor={z => z.zone_id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              renderItem={({ item }) => (
                <ZoneListItem
                  zone={item.data || { zone_id: item.zone_id }}
                  gas={activeGas}
                  onPress={() => {
                    Haptics.selectionAsync()
                    setSelectedId(item.zone_id)
                  }}
                />
              )}
              ListEmptyComponent={
                <EmptyState
                  icon={loading ? null : '📡'}
                  title={loading ? t('sentinel.loading') : t('sentinel.empty')}
                  subtitle={loading ? null : 'Copernicus CDSE'}
                />
              }
            />
          </View>
        )}
      </View>

      <ZoneSheet
        visible={!!selectedZone}
        zone={selectedZone}
        onClose={() => setSelectedId(null)}
        t={t}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg0 },

  overlay:    { position: 'absolute', zIndex: 10 },

  toggleGroup:{ flexDirection: 'row', backgroundColor: 'rgba(28,28,30,0.94)',
                borderWidth: 1, borderColor: C.borderMd, borderRadius: 6, overflow: 'hidden' },
  toggleBtn:  { paddingHorizontal: 16, paddingVertical: 6 },
  toggleBtnActive: { backgroundColor: C.amberFill },
  toggleText: { fontSize: 12, fontWeight: '700', color: C.txt2,
                letterSpacing: 0.5, fontFamily: 'SpaceMono' },
  toggleTextActive: { color: C.amber },

  statusBox:  { backgroundColor: 'rgba(28,28,30,0.94)', borderWidth: 1,
                borderColor: C.borderMd, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, color: C.txt3, fontFamily: 'SpaceMono',
                letterSpacing: 0.5 },

  legend:     { backgroundColor: 'rgba(28,28,30,0.94)', borderWidth: 1,
                borderColor: C.borderMd, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
                gap: 5 },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, color: C.txt2, fontFamily: 'SpaceMono' },

  loadingOverlay: { justifyContent: 'center', alignItems: 'center' },

  sidePanel:     { width: 300, backgroundColor: C.bg1, borderLeftWidth: StyleSheet.hairlineWidth,
                   borderLeftColor: C.separator },
  sidePanelHeader: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.separator },
  sidePanelTitle:{ fontSize: 17, fontWeight: '700', color: '#ffffff' },
  sidePanelSub:  { fontSize: 12, color: C.txt3, fontFamily: 'SpaceMono', marginTop: 2 },

  listItem:   { flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  listDot:    { width: 10, height: 10, borderRadius: 2 },
  listLabel:  { flex: 1, fontSize: 14, color: '#ffffff' },
  listRatio:  { fontSize: 14, fontWeight: '700', fontFamily: 'SpaceMono' },

  sep:        { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 14 },

  // ── Sheet ──
  sheetSafe:  { flex: 1, backgroundColor: C.bg1 },
  sheetHandle:{ width: 36, height: 4, backgroundColor: C.bg3, borderRadius: 2,
                alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHeader:{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row',
                alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: C.separator },
  sheetLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: '#ffffff' },
  sheetBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  sheetBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, fontFamily: 'SpaceMono' },
  closeBtn:   { padding: 6 },
  closeText:  { fontSize: 18, color: C.txt3 },

  gasBlock:   { backgroundColor: C.bg2, borderRadius: 10, padding: 12, gap: 10 },
  gasHeader:  { flexDirection: 'row', alignItems: 'center' },
  gasName:    { fontSize: 13, fontWeight: '700', color: C.txt2,
                letterSpacing: 1, fontFamily: 'SpaceMono' },
  gasRatio:   { marginLeft: 'auto', fontSize: 18, fontWeight: '800', fontFamily: 'SpaceMono' },
  metricsGrid:{ flexDirection: 'row', gap: 10 },
  metricCell: { flex: 1, backgroundColor: C.bg1, borderRadius: 8, padding: 10 },
  metricKey:  { fontSize: 11, color: C.txt3, fontFamily: 'SpaceMono',
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  metricVal:  { fontSize: 14, color: '#ffffff', fontFamily: 'SpaceMono' },
  sparkLabel: { fontSize: 11, color: C.txt3, fontFamily: 'SpaceMono',
                textTransform: 'uppercase', letterSpacing: 0.5 },
  sparkContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 40,
                    gap: 2, paddingTop: 4 },
  sparkBar:   { flex: 1, backgroundColor: C.amber, borderRadius: 1 },
  sparkEmpty: { fontSize: 12, color: C.txt3, fontFamily: 'SpaceMono' },
  noObs:      { fontSize: 13, color: C.txt3, fontFamily: 'SpaceMono' },
  lastReading:{ fontSize: 12, color: C.txt3, textAlign: 'center', marginTop: 4 },
})
