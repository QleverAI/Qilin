import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { getToken } from '../../hooks/apiClient'
import { useLang } from '../../hooks/useLanguage'
import { VESSEL_COLORS } from './MarkerShapes'
import { C } from '../../theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

const CAT_LABEL = { military: 'MILITARY', tanker: 'TANKER', cargo: 'CARGO', passenger: 'PASSENGER' }

async function apiFetch(path) {
  const token = getToken()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function VesselDetail({ vessel, isFav, onToggleFav, hasTrail, onToggleTrail, onClose }) {
  const { t }     = useLang()
  const [ports,   setPorts]   = useState([])
  const [info,    setInfo]    = useState(null)
  const [loading, setLoading] = useState(false)

  const mmsi  = vessel?.mmsi || vessel?.id
  const cat   = vessel?.category || 'cargo'
  const color = VESSEL_COLORS[cat] || VESSEL_COLORS.cargo
  const label = CAT_LABEL[cat] || 'VESSEL'

  useEffect(() => {
    if (!mmsi) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      apiFetch(`/api/vessels/${mmsi}/ports`).catch(() => []),
      apiFetch(`/api/vessels/${mmsi}/info`).catch(() => null),
    ]).then(([p, i]) => {
      if (cancelled) return
      setPorts(Array.isArray(p) ? p.slice(0, 5) : [])
      setInfo(i)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mmsi])

  if (!vessel) return null

  return (
    <ScrollView style={vd.scroll} contentContainerStyle={vd.content} showsVerticalScrollIndicator={false}>
      <View style={vd.header}>
        <View style={[vd.badge, { backgroundColor: color + '28', borderColor: color + '88' }]}>
          <Text style={[vd.badgeText, { color }]}>{label}</Text>
        </View>
        <Text style={vd.name} numberOfLines={1}>
          {vessel.name || mmsi || '—'}
        </Text>
        <Pressable onPress={() => { Haptics.selectionAsync(); onToggleFav() }} hitSlop={8}>
          <Text style={[vd.star, { color: isFav ? C.amber : 'rgba(255,255,255,0.25)' }]}>★</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={vd.close}>×</Text>
        </Pressable>
      </View>

      {info?.photo_url ? (
        <View style={vd.photoWrap}>
          <Image source={{ uri: info.photo_url }} style={vd.photo} resizeMode="cover" />
        </View>
      ) : null}

      <View style={vd.grid}>
        <MetricCell label={t('tactical.speed')}   value={vessel.speed   != null ? `${vessel.speed.toFixed(1)} kt` : '—'} />
        <MetricCell label={t('tactical.heading')} value={vessel.heading != null ? `${vessel.heading}°` : '—'} />
        <MetricCell label={t('tactical.flag')}    value={vessel.flag || '—'} />
        <MetricCell label={t('tactical.type')}    value={label} color={color} />
      </View>

      <Pressable
        style={[vd.trailBtn, { borderColor: hasTrail ? C.amber + '88' : 'rgba(255,255,255,0.15)' }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggleTrail() }}
      >
        <Text style={[vd.trailText, { color: hasTrail ? C.amber : 'rgba(255,255,255,0.5)' }]}>
          {hasTrail ? `∿ ${t('tactical.hide_trail')}` : `∿ ${t('tactical.show_trail')}`}
        </Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator size="small" color={C.amber} style={{ marginTop: 12 }} />
      ) : (
        <View style={vd.section}>
          <Text style={vd.sectionLabel}>{t('tactical.ports')}</Text>
          {ports.length > 0
            ? ports.map((p, i) => (
                <Text key={i} style={vd.portRow}>· {p.name || p.port_id} ({p.visit_count}x)</Text>
              ))
            : <Text style={vd.empty}>{t('tactical.no_ports')}</Text>
          }
        </View>
      )}
    </ScrollView>
  )
}

function MetricCell({ label, value, color }) {
  return (
    <View style={vd.cell}>
      <Text style={vd.cellLabel}>{label}</Text>
      <Text style={[vd.cellValue, color && { color }]}>{value}</Text>
    </View>
  )
}

const vd = StyleSheet.create({
  scroll:       { flex: 1 },
  content:      { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  name:         { flex: 1, fontSize: 17, fontWeight: '700', color: '#ffffff', fontFamily: 'SpaceMono' },
  star:         { fontSize: 20 },
  close:        { fontSize: 22, color: 'rgba(255,255,255,0.35)', paddingLeft: 4 },
  photoWrap:    { borderRadius: 10, overflow: 'hidden' },
  photo:        { width: '100%', height: 120 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell:         { width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10 },
  cellLabel:    { fontSize: 10, fontWeight: '600', color: 'rgba(235,235,245,0.4)',
                  letterSpacing: 0.5, marginBottom: 4 },
  cellValue:    { fontSize: 15, fontWeight: '700', color: '#ffffff', fontFamily: 'SpaceMono' },
  trailBtn:     { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  trailText:    { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  section:      { gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(235,235,245,0.4)', letterSpacing: 0.5 },
  portRow:      { fontSize: 13, color: 'rgba(235,235,245,0.7)', fontFamily: 'SpaceMono' },
  empty:        { fontSize: 13, color: 'rgba(235,235,245,0.3)', fontStyle: 'italic' },
})
