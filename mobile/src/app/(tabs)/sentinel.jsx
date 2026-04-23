import { useState, useMemo, useCallback }              from 'react'
import { View, Text, StyleSheet, FlatList,
         RefreshControl }                              from 'react-native'
import { useSentinelData }                             from '../../hooks/useSentinelData'
import { useLang }                                     from '../../hooks/useLanguage'
import { PageHeader }                                  from '../../components/PageHeader'
import { EmptyState }                                  from '../../components/EmptyState'
import { C, T }                                        from '../../theme'
import { useBreakpoint }                               from '../../theme/responsive'

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function anomalyColor(ratio) {
  if (ratio == null) return C.txt3
  if (ratio >= 2)    return C.red
  if (ratio >= 1.5)  return C.amber
  if (ratio >= 1)    return C.cyan
  return C.green
}

function ZoneCard({ zone }) {
  const no2  = zone.no2
  const so2  = zone.so2
  const no2Color = anomalyColor(no2?.ratio)
  const so2Color = anomalyColor(so2?.ratio)

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Text style={s.zoneName}>{zone.name || zone.zone_id}</Text>
        {zone.last_reading ? (
          <Text style={s.zoneTime}>{fmtTime(zone.last_reading)}</Text>
        ) : null}
      </View>
      {zone.country ? <Text style={s.country}>{zone.country}</Text> : null}

      <View style={s.gases}>
        <View style={s.gas}>
          <Text style={s.gasLabel}>NO₂</Text>
          {no2 ? (
            <>
              <Text style={[s.gasRatio, { color: no2Color }]}>
                {no2.ratio != null ? `${no2.ratio.toFixed(2)}×` : '—'}
              </Text>
              <Text style={s.gasBaseline}>
                {no2.value?.toFixed(2)} / baseline {no2.baseline?.toFixed(2)}
              </Text>
            </>
          ) : (
            <Text style={s.gasBaseline}>sin datos</Text>
          )}
        </View>

        <View style={s.gasDivider} />

        <View style={s.gas}>
          <Text style={s.gasLabel}>SO₂</Text>
          {so2 ? (
            <>
              <Text style={[s.gasRatio, { color: so2Color }]}>
                {so2.ratio != null ? `${so2.ratio.toFixed(2)}×` : '—'}
              </Text>
              <Text style={s.gasBaseline}>
                {so2.value?.toFixed(2)} / baseline {so2.baseline?.toFixed(2)}
              </Text>
            </>
          ) : (
            <Text style={s.gasBaseline}>sin datos</Text>
          )}
        </View>
      </View>

      {zone.recent_count ? (
        <Text style={s.recent}>{zone.recent_count} readings recientes</Text>
      ) : null}
    </View>
  )
}

export default function SentinelScreen() {
  const { t } = useLang()
  const { zones, loading, error } = useSentinelData()
  const { hPad, columns } = useBreakpoint()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1200)
  }, [])

  const sorted = useMemo(() => {
    return [...zones].sort((a, b) => {
      const ra = Math.max(a.no2?.ratio || 0, a.so2?.ratio || 0)
      const rb = Math.max(b.no2?.ratio || 0, b.so2?.ratio || 0)
      return rb - ra
    })
  }, [zones])

  return (
    <View style={s.root}>
      <PageHeader title={t('sentinel.title')} subtitle={`${zones.length} · NO₂ / SO₂`} />

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>Error: {error}</Text>
        </View>
      ) : null}

      <FlatList
        key={`sent-cols-${columns}`}
        numColumns={columns}
        data={sorted}
        keyExtractor={z => z.zone_id || z.name}
        contentContainerStyle={{ padding: hPad, gap: 10, paddingBottom: 32 }}
        columnWrapperStyle={columns > 1 ? { gap: 10 } : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.txt3} />}
        renderItem={({ item }) => (
          <View style={columns > 1 ? { flex: 1 } : undefined}>
            <ZoneCard zone={item} />
          </View>
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
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg0 },
  errorBanner:  { backgroundColor: C.redFill, paddingHorizontal: 16, paddingVertical: 10 },
  errorText:    { fontSize: 13, color: C.red },
  card:         { backgroundColor: C.bg1, borderRadius: 12, padding: 14, gap: 10 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneName:     { flex: 1, fontSize: 17, fontWeight: '600', color: '#ffffff' },
  zoneTime:     { fontSize: 12, color: C.txt3 },
  country:      { fontSize: 13, color: C.txt3 },
  gases:        { flexDirection: 'row', alignItems: 'stretch',
                  backgroundColor: C.bg2, borderRadius: 8, padding: 10 },
  gas:          { flex: 1, gap: 4 },
  gasDivider:   { width: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginHorizontal: 8 },
  gasLabel:     { fontSize: 11, fontWeight: '700', color: C.txt3,
                  textTransform: 'uppercase', letterSpacing: 0.5 },
  gasRatio:     { fontSize: 22, fontWeight: '700', fontFamily: 'SpaceMono' },
  gasBaseline:  { fontSize: 11, color: C.txt3, fontFamily: 'SpaceMono' },
  recent:       { fontSize: 12, color: C.txt3, fontFamily: 'SpaceMono' },
})
