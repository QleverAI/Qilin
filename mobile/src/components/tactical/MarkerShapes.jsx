import { View, StyleSheet } from 'react-native'
import { Marker } from 'react-native-maps'

// ── Color palette per type ────────────────────────────────────────────────────
export const AIRCRAFT_COLORS = {
  civil:          '#64d2ff',
  military:       '#ff453a',
  vip:            '#ffd60a',
  fighter:        '#ff453a',
  helicopter:     '#f97316',
  transport:      '#ff453a',
  surveillance:   '#a78bfa',
}

export const VESSEL_COLORS = {
  military:  '#ff453a',
  tanker:    '#ffd60a',
  cargo:     '#60a5fa',
  passenger: '#a78bfa',
}

// ── Aircraft shapes ───────────────────────────────────────────────────────────

function CivilShape({ color }) {
  return (
    <View style={[ms.triBase, {
      borderBottomColor: color, borderBottomWidth: 14,
      borderLeftWidth: 7, borderRightWidth: 7,
    }]} />
  )
}

function MilitaryShape({ color }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={[ms.triBase, {
        borderBottomColor: 'rgba(255,255,255,0.45)', borderBottomWidth: 17,
        borderLeftWidth: 9, borderRightWidth: 9, position: 'absolute',
      }]} />
      <View style={[ms.triBase, {
        borderBottomColor: color, borderBottomWidth: 14,
        borderLeftWidth: 7, borderRightWidth: 7,
      }]} />
    </View>
  )
}

function VipShape({ color }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[ms.triBase, {
        borderBottomColor: color, borderBottomWidth: 13,
        borderLeftWidth: 6, borderRightWidth: 6,
      }]} />
      <View style={[ms.vipDot, { backgroundColor: '#ffd60a' }]} />
    </View>
  )
}

function FighterShape({ color }) {
  return (
    <View style={[ms.triBase, {
      borderBottomColor: color, borderBottomWidth: 10,
      borderLeftWidth: 12, borderRightWidth: 12,
    }]} />
  )
}

function HelicopterShape({ color }) {
  return (
    <View style={{ alignItems: 'center', gap: 1 }}>
      <View style={[ms.rotor, { backgroundColor: color }]} />
      <View style={[ms.helBody, { backgroundColor: color }]} />
    </View>
  )
}

function TransportShape({ color }) {
  return (
    <View style={[ms.triBase, {
      borderBottomColor: color, borderBottomWidth: 9,
      borderLeftWidth: 13, borderRightWidth: 13,
    }]} />
  )
}

function SurveillanceShape({ color }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>
      <View style={[ms.survRing, { borderColor: color }]} />
      <View style={[ms.triBase, {
        borderBottomColor: color, borderBottomWidth: 9,
        borderLeftWidth: 5, borderRightWidth: 5, position: 'absolute',
      }]} />
    </View>
  )
}

const AIRCRAFT_SHAPE = {
  civil:        CivilShape,
  military:     MilitaryShape,
  vip:          VipShape,
  fighter:      FighterShape,
  helicopter:   HelicopterShape,
  transport:    TransportShape,
  surveillance: SurveillanceShape,
}

// ── Vessel shapes ─────────────────────────────────────────────────────────────

function MilitaryVesselShape({ color }) {
  return (
    <View style={{ width: 10, height: 18, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[ms.diamond, { borderColor: color }]} />
    </View>
  )
}

function TankerShape({ color }) {
  return <View style={[ms.tanker, { backgroundColor: color }]} />
}

function CargoShape({ color }) {
  return <View style={[ms.cargo, { backgroundColor: color }]} />
}

const VESSEL_SHAPE = {
  military:  MilitaryVesselShape,
  tanker:    TankerShape,
  cargo:     CargoShape,
  passenger: CargoShape,
}

// ── Public marker components ──────────────────────────────────────────────────

export function AircraftMarker({ ac, onSelect }) {
  const type  = ac.type || 'civil'
  const color = AIRCRAFT_COLORS[type] || AIRCRAFT_COLORS.civil
  const Shape = AIRCRAFT_SHAPE[type] || CivilShape

  return (
    <Marker
      coordinate={{ latitude: ac.lat, longitude: ac.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={() => onSelect(ac)}
    >
      <Shape color={color} />
    </Marker>
  )
}

export function VesselMarker({ vessel, onSelect }) {
  const cat   = vessel.category || 'cargo'
  const color = VESSEL_COLORS[cat] || VESSEL_COLORS.cargo
  const Shape = VESSEL_SHAPE[cat] || CargoShape

  return (
    <Marker
      coordinate={{ latitude: vessel.lat, longitude: vessel.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={() => onSelect(vessel)}
    >
      <Shape color={color} />
    </Marker>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  triBase:  { width: 0, height: 0, backgroundColor: 'transparent',
              borderStyle: 'solid', borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  vipDot:   { width: 4, height: 4, borderRadius: 2, marginTop: -2 },
  rotor:    { width: 18, height: 3, borderRadius: 2 },
  helBody:  { width: 8, height: 8, borderRadius: 4 },
  survRing: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
              backgroundColor: 'transparent', position: 'absolute' },
  diamond:  { width: 8, height: 8, borderWidth: 2, backgroundColor: 'transparent',
              transform: [{ rotate: '45deg' }] },
  tanker:   { width: 6, height: 16, borderRadius: 2 },
  cargo:    { width: 12, height: 12, borderRadius: 3 },
})
