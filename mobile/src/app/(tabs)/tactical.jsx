import { View, Text, StyleSheet }    from 'react-native'
import MapView, { Marker, Callout } from 'react-native-maps'
import { useSafeAreaInsets }        from 'react-native-safe-area-context'
import { useQilinData }             from '../../hooks/useQilinData'
import { C, T }                     from '../../theme'

const INITIAL_REGION = {
  latitude:       35.0,
  longitude:      20.0,
  latitudeDelta:  50.0,
  longitudeDelta: 60.0,
}

const WS_COLOR = { live: C.green, connecting: C.amber, reconnecting: C.amber, error: C.red }

function AircraftMarker({ ac }) {
  const isMil = ac.category === 'military' || ac.type === 'military'
  return (
    <Marker
      coordinate={{ latitude: ac.lat, longitude: ac.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View style={[s.markerDot, { backgroundColor: isMil ? C.red : C.cyan }]} />
      <Callout tooltip={false}>
        <View style={s.callout}>
          <Text style={s.calloutId}>{ac.callsign || ac.icao24?.toUpperCase()}</Text>
          {ac.altitude != null && (
            <Text style={s.calloutMeta}>
              {Math.round(ac.altitude / 0.3048).toLocaleString()} ft
            </Text>
          )}
          {ac.velocity != null && (
            <Text style={s.calloutMeta}>
              {Math.round(ac.velocity * 1.94384)} kt
            </Text>
          )}
          <Text style={[s.calloutType, { color: isMil ? C.red : C.cyan }]}>
            {isMil ? 'Militar' : 'Civil'}
          </Text>
        </View>
      </Callout>
    </Marker>
  )
}

export default function TacticalScreen() {
  const insets = useSafeAreaInsets()
  const { aircraft, alerts, vessels, wsStatus } = useQilinData()

  const visible    = aircraft.filter(a => a.lat != null && a.lon != null)
  const military   = visible.filter(a => a.category === 'military' || a.type === 'military')
  const highAlerts = alerts.filter(a => a.severity === 'high')

  const panelHeight = 90 + insets.bottom

  return (
    <View style={s.root}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        mapType="hybrid"
        initialRegion={INITIAL_REGION}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {visible.map(ac => (
          <AircraftMarker key={ac.icao24} ac={ac} />
        ))}
      </MapView>

      <View style={[s.panel, { height: panelHeight, paddingBottom: insets.bottom + 8 }]}>
        <View style={s.handle} />
        <View style={s.panelRow}>
          <View style={s.stat}>
            <Text style={s.statVal}>{visible.length}</Text>
            <Text style={s.statLabel}>Aeronaves</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: C.red }]}>{military.length}</Text>
            <Text style={s.statLabel}>Militares</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: vessels.length > 0 ? C.cyan : C.txt3 }]}>
              {vessels.length}
            </Text>
            <Text style={s.statLabel}>Buques</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: highAlerts.length > 0 ? C.red : C.txt3 }]}>
              {highAlerts.length}
            </Text>
            <Text style={s.statLabel}>Alertas</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <View style={[s.wsDot, { backgroundColor: WS_COLOR[wsStatus] || C.amber }]} />
            <Text style={[s.statLabel, { color: WS_COLOR[wsStatus] || C.amber }]}>
              {wsStatus === 'live' ? 'En vivo' : wsStatus}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#000' },
  markerDot:   { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  callout:     { backgroundColor: C.bg1, padding: 12, borderRadius: 10, minWidth: 130,
                 shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  calloutId:   { fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  calloutMeta: { fontSize: 13, color: C.txt2, marginTop: 2 },
  calloutType: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  panel:       { position: 'absolute', bottom: 0, left: 0, right: 0,
                 backgroundColor: 'rgba(28,28,30,0.96)',
                 borderTopLeftRadius: 16, borderTopRightRadius: 16,
                 borderTopWidth: 0.5, borderTopColor: C.separator },
  handle:      { width: 36, height: 4, backgroundColor: C.bg3, borderRadius: 2,
                 alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  panelRow:    { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, alignItems: 'center' },
  stat:        { flex: 1, alignItems: 'center', gap: 4 },
  statVal:     { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  statLabel:   { fontSize: 11, color: 'rgba(235,235,245,0.6)', fontWeight: '500', textAlign: 'center' },
  statDivider: { width: 0.5, height: 36, backgroundColor: C.separator },
  wsDot:       { width: 10, height: 10, borderRadius: 5 },
})
