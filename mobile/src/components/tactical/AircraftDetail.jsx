import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { getToken } from '../../hooks/apiClient'
import { useLang } from '../../hooks/useLanguage'
import { AIRCRAFT_COLORS } from './MarkerShapes'
import { C } from '../../theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

const TYPE_LABEL = {
  civil: 'CIVIL', military: 'MILITARY', vip: 'VIP',
  fighter: 'FIGHTER', helicopter: 'HELO',
  transport: 'TRANSPORT', surveillance: 'ISR',
}

async function apiFetch(path) {
  const token = getToken()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(`${API_BASE}${path}`, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function AircraftDetail({ aircraft, isFav, onToggleFav, hasTrail, onToggleTrail, onClose }) {
  const { t }     = useLang()
  const [bases,   setBases]   = useState([])
  const [meta,    setMeta]    = useState(null)
  const [loading, setLoading] = useState(false)

  const icao24 = aircraft?.icao24 || aircraft?.id
  const type   = aircraft?.type || 'civil'
  const color  = AIRCRAFT_COLORS[type] || AIRCRAFT_COLORS.civil
  const label  = TYPE_LABEL[type] || 'UNKNOWN'

  useEffect(() => {
    if (!icao24) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      apiFetch(`/api/aircraft/${icao24}/bases`).catch(() => []),
      apiFetch(`/api/meta/${icao24}`).catch(() => null),
    ]).then(([b, m]) => {
      if (cancelled) return
      setBases(Array.isArray(b) ? b.slice(0, 5) : [])
      setMeta(m)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [icao24])

  if (!aircraft) return null

  return (
    <ScrollView style={ad.scroll} contentContainerStyle={ad.content} showsVerticalScrollIndicator={false}>
      <View style={ad.header}>
        <View style={[ad.badge, { backgroundColor: color + '28', borderColor: color + '88' }]}>
          <Text style={[ad.badgeText, { color }]}>{label}</Text>
        </View>
        <Text style={ad.callsign} numberOfLines={1}>
          {aircraft.callsign || icao24?.toUpperCase() || '—'}
        </Text>
        <Pressable onPress={() => { Haptics.selectionAsync(); onToggleFav() }} hitSlop={8}>
          <Text style={[ad.star, { color: isFav ? C.amber : 'rgba(255,255,255,0.25)' }]}>★</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={ad.close}>×</Text>
        </Pressable>
      </View>

      {meta?.photo_url ? (
        <View style={ad.photoWrap}>
          <Image source={{ uri: meta.photo_url }} style={ad.photo} resizeMode="cover" />
          {meta.photographer ? (
            <Text style={ad.photographer}>© {meta.photographer}</Text>
          ) : null}
        </View>
      ) : null}

      {(meta?.model || meta?.registration) ? (
        <View style={ad.metaRow}>
          {meta.model        && <Text style={ad.metaChip}>{meta.model}</Text>}
          {meta.registration && <Text style={[ad.metaChip, { color: C.cyan }]}>{meta.registration}</Text>}
        </View>
      ) : null}

      <View style={ad.grid}>
        <MetricCell label={t('tactical.altitude')} value={aircraft.altitude != null ? `${Math.round(aircraft.altitude).toLocaleString()} ft` : '—'} />
        <MetricCell label={t('tactical.speed')}    value={aircraft.velocity != null ? `${Math.round(aircraft.velocity * 1.94384)} kt` : '—'} />
        <MetricCell label={t('tactical.heading')}  value={aircraft.heading  != null ? `${aircraft.heading}°` : '—'} />
        <MetricCell label={t('tactical.zone')}     value={aircraft.zone || '—'} />
      </View>

      <Pressable
        style={[ad.trailBtn, { borderColor: hasTrail ? C.cyan + '88' : 'rgba(255,255,255,0.15)' }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggleTrail() }}
      >
        <Text style={[ad.trailText, { color: hasTrail ? C.cyan : 'rgba(255,255,255,0.5)' }]}>
          {hasTrail ? `╌ ${t('tactical.hide_trail')}` : `╌ ${t('tactical.show_trail')}`}
        </Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator size="small" color={C.cyan} style={{ marginTop: 12 }} />
      ) : (
        <View style={ad.section}>
          <Text style={ad.sectionLabel}>{t('tactical.bases')}</Text>
          {bases.length > 0
            ? bases.map((b, i) => (
                <Text key={i} style={ad.baseRow}>· {b.name || b.airfield_icao}</Text>
              ))
            : <Text style={ad.empty}>{t('tactical.no_bases')}</Text>
          }
        </View>
      )}
    </ScrollView>
  )
}

function MetricCell({ label, value }) {
  return (
    <View style={ad.cell}>
      <Text style={ad.cellLabel}>{label}</Text>
      <Text style={ad.cellValue}>{value}</Text>
    </View>
  )
}

const ad = StyleSheet.create({
  scroll:       { flex: 1 },
  content:      { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  callsign:     { flex: 1, fontSize: 17, fontWeight: '700', color: '#ffffff', fontFamily: 'SpaceMono' },
  star:         { fontSize: 20 },
  close:        { fontSize: 22, color: 'rgba(255,255,255,0.35)', paddingLeft: 4 },
  photoWrap:    { borderRadius: 10, overflow: 'hidden' },
  photo:        { width: '100%', height: 120 },
  photographer: { position: 'absolute', bottom: 4, right: 8, fontSize: 9,
                  color: 'rgba(255,255,255,0.5)' },
  metaRow:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaChip:     { fontSize: 11, fontFamily: 'SpaceMono', color: 'rgba(235,235,245,0.6)',
                  backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8,
                  paddingVertical: 3, borderRadius: 4 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell:         { width: '47%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10 },
  cellLabel:    { fontSize: 10, fontWeight: '600', color: 'rgba(235,235,245,0.4)',
                  letterSpacing: 0.5, marginBottom: 4 },
  cellValue:    { fontSize: 15, fontWeight: '700', color: '#ffffff', fontFamily: 'SpaceMono' },
  trailBtn:     { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  trailText:    { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  section:      { gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(235,235,245,0.4)', letterSpacing: 0.5 },
  baseRow:      { fontSize: 13, color: 'rgba(235,235,245,0.7)', fontFamily: 'SpaceMono' },
  empty:        { fontSize: 13, color: 'rgba(235,235,245,0.3)', fontStyle: 'italic' },
})
