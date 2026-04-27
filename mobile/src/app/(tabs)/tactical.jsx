import { useState, useMemo, useCallback }    from 'react'
import { View, Pressable, Text, StyleSheet } from 'react-native'
import MapView, { Polyline }                 from 'react-native-maps'
import { useSafeAreaInsets }                 from 'react-native-safe-area-context'
import * as Haptics                          from 'expo-haptics'

import { useQilinData }         from '../../hooks/useQilinData'
import { useAircraftTrails }    from '../../hooks/useAircraftTrails'
import { useVesselTrail }       from '../../hooks/useVesselTrail'
import { useAircraftHistory }   from '../../hooks/useAircraftHistory'
import { useTacticalFavorites } from '../../hooks/useTacticalFavorites'
import { useLang }              from '../../hooks/useLanguage'

import { AircraftMarker, VesselMarker, AIRCRAFT_COLORS } from '../../components/tactical/MarkerShapes'
import { FilterBar }     from '../../components/tactical/FilterBar'
import { StatsStrip }    from '../../components/tactical/StatsStrip'
import { DetailSheet }   from '../../components/tactical/DetailSheet'
import { AircraftDetail } from '../../components/tactical/AircraftDetail'
import { VesselDetail }   from '../../components/tactical/VesselDetail'
import { TrailsPanel }   from '../../components/tactical/TrailsPanel'
import { GlossaryModal } from '../../components/tactical/GlossaryModal'
import { C }             from '../../theme'

const INITIAL_REGION = {
  latitude: 35.0, longitude: 20.0,
  latitudeDelta: 50.0, longitudeDelta: 60.0,
}

export default function TacticalScreen() {
  const insets = useSafeAreaInsets()
  const { t }  = useLang()

  // ── Data ──────────────────────────────────────────────────────────────────
  const { aircraft, vessels, alerts, wsStatus }          = useQilinData()
  const { trails, addTrail, removeTrail, hasTrail }      = useAircraftTrails()
  const { vesselTrail, showTrail, hideTrail }            = useVesselTrail()
  const { history, loading: histLoading, fetchHistory }  = useAircraftHistory()
  const { isFavAircraft, isFavVessel, toggleAircraft, toggleVessel } = useTacticalFavorites()

  // ── UI state ──────────────────────────────────────────────────────────────
  const [hidden,           setHidden]           = useState(new Set())
  const [selectedAircraft, setSelectedAircraft] = useState(null)
  const [selectedVessel,   setSelectedVessel]   = useState(null)
  const [showTrailsPanel,  setShowTrailsPanel]  = useState(false)
  const [showGlossary,     setShowGlossary]     = useState(false)

  // ── Filter toggle ─────────────────────────────────────────────────────────
  const handleToggleFilter = useCallback((key) => {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  // ── Filtered markers ──────────────────────────────────────────────────────
  const visibleAircraft = useMemo(() => {
    return aircraft.filter(a => {
      if (a.lat == null || a.lon == null) return false
      return !hidden.has(a.type || 'civil')
    })
  }, [aircraft, hidden])

  const visibleVessels = useMemo(() => {
    return vessels.filter(v => {
      if (v.lat == null || v.lon == null) return false
      if (!v.category || v.category === 'unknown') return false
      const key = v.category === 'military' ? 'vessel-military' : v.category
      return !hidden.has(key)
    })
  }, [vessels, hidden])

  // ── Selection handlers ────────────────────────────────────────────────────
  const handleSelectAircraft = useCallback((ac) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedVessel(null)
    setSelectedAircraft(ac)
  }, [])

  const handleSelectVessel = useCallback((v) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedAircraft(null)
    setSelectedVessel(v)
  }, [])

  const handleDismiss = useCallback(() => {
    setSelectedAircraft(null)
    setSelectedVessel(null)
  }, [])

  // ── Trail toggles ─────────────────────────────────────────────────────────
  const handleToggleAircraftTrail = useCallback(() => {
    const icao24 = selectedAircraft?.icao24 || selectedAircraft?.id
    if (!icao24) return
    hasTrail(icao24) ? removeTrail(icao24) : addTrail(icao24)
  }, [selectedAircraft, hasTrail, addTrail, removeTrail])

  const handleToggleVesselTrail = useCallback(() => {
    const mmsi = selectedVessel?.mmsi || selectedVessel?.id
    if (!mmsi) return
    vesselTrail?.mmsi === mmsi ? hideTrail() : showTrail(mmsi)
  }, [selectedVessel, vesselTrail, showTrail, hideTrail])

  const sheetVisible   = !!(selectedAircraft || selectedVessel)
  const selectedIcao24 = selectedAircraft?.icao24 || selectedAircraft?.id
  const selectedMmsi   = selectedVessel?.mmsi || selectedVessel?.id

  return (
    <View style={s.root}>
      {/* ── Map ── */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        mapType="hybrid"
        initialRegion={INITIAL_REGION}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        onPress={handleDismiss}
      >
        {visibleAircraft.map(ac => (
          <AircraftMarker
            key={ac.icao24 || ac.id}
            ac={ac}
            onSelect={handleSelectAircraft}
          />
        ))}

        {visibleVessels.map(v => (
          <VesselMarker
            key={v.mmsi || v.id}
            vessel={v}
            onSelect={handleSelectVessel}
          />
        ))}

        {[...trails.entries()].map(([icao24, positions]) => (
          positions.length > 1 && (
            <Polyline
              key={icao24}
              coordinates={positions.map(p => ({ latitude: p.lat, longitude: p.lon }))}
              strokeColor={AIRCRAFT_COLORS[
                aircraft.find(a => (a.icao24 || a.id) === icao24)?.type || 'civil'
              ] || '#64d2ff'}
              strokeWidth={2}
            />
          )
        ))}

        {vesselTrail && vesselTrail.positions.length > 1 && (
          <Polyline
            coordinates={vesselTrail.positions.map(p => ({ latitude: p.lat, longitude: p.lon }))}
            strokeColor={C.amber}
            strokeWidth={2}
            lineDashPattern={[6, 4]}
          />
        )}
      </MapView>

      {/* ── Filter bar (top) ── */}
      <FilterBar hidden={hidden} onToggle={handleToggleFilter} />

      {/* ── Action buttons (bottom-right) ── */}
      <View style={[s.actions, { bottom: insets.bottom + 80 }]}>
        <ActionBtn
          label="╌"
          onPress={() => { Haptics.selectionAsync(); setShowTrailsPanel(true) }}
          active={trails.size > 0}
          activeColor={C.cyan}
        />
        <ActionBtn
          label="?"
          onPress={() => { Haptics.selectionAsync(); setShowGlossary(true) }}
        />
      </View>

      {/* ── Stats strip (bottom-center) ── */}
      <StatsStrip
        aircraft={aircraft}
        vessels={vessels}
        alerts={alerts}
        wsStatus={wsStatus}
      />

      {/* ── Detail sheet ── */}
      <DetailSheet visible={sheetVisible} onDismiss={handleDismiss}>
        {selectedAircraft && (
          <AircraftDetail
            aircraft={selectedAircraft}
            isFav={isFavAircraft(selectedIcao24)}
            onToggleFav={() => toggleAircraft(selectedIcao24)}
            hasTrail={hasTrail(selectedIcao24)}
            onToggleTrail={handleToggleAircraftTrail}
            onClose={handleDismiss}
          />
        )}
        {selectedVessel && (
          <VesselDetail
            vessel={selectedVessel}
            isFav={isFavVessel(selectedMmsi)}
            onToggleFav={() => toggleVessel(selectedMmsi)}
            hasTrail={vesselTrail?.mmsi === selectedMmsi}
            onToggleTrail={handleToggleVesselTrail}
            onClose={handleDismiss}
          />
        )}
      </DetailSheet>

      {/* ── Modals ── */}
      <TrailsPanel
        visible={showTrailsPanel}
        onClose={() => setShowTrailsPanel(false)}
        trails={trails}
        onRemoveTrail={removeTrail}
        onAddTrail={(icao24) => { addTrail(icao24) }}
        history={history}
        histLoading={histLoading}
        fetchHistory={fetchHistory}
      />
      <GlossaryModal
        visible={showGlossary}
        onClose={() => setShowGlossary(false)}
      />
    </View>
  )
}

function ActionBtn({ label, onPress, active = false, activeColor = C.cyan }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.actionBtn,
        active && { borderColor: activeColor + '88', backgroundColor: activeColor + '18' },
      ]}
    >
      <Text style={[s.actionLabel, active && { color: activeColor }]}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#000' },
  actions:     { position: 'absolute', right: 14, zIndex: 10, gap: 8 },
  actionBtn:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center',
                 justifyContent: 'center', backgroundColor: 'rgba(3,8,17,0.80)',
                 borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  actionLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
})
