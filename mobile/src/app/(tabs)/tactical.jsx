import { View, Text, StyleSheet }      from 'react-native'
import MapView, { Marker, Callout }   from 'react-native-maps'
import { useQilinData }               from '../../hooks/useQilinData'
import { C }                          from '../../theme'

const INITIAL_REGION = {
  latitude:       48.0,
  longitude:      10.0,
  latitudeDelta:  30.0,
  longitudeDelta: 40.0,
}

const WS_COLOR = { live:C.green, connecting:C.amber, reconnecting:C.amber, error:C.red }

export default function TacticalScreen() {
  const { aircraft, alerts, wsStatus } = useQilinData()

  const visibleAircraft = aircraft.filter(a => a.lat != null && a.lon != null)
  const highAlerts      = alerts.filter(a => a.severity === 'high')

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
        {visibleAircraft.map(aircraft => (
          <Marker
            key={aircraft.icao24}
            coordinate={{ latitude: aircraft.lat, longitude: aircraft.lon }}
            pinColor={aircraft.type === 'military' ? '#ff3b4a' : '#00c8ff'}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Callout tooltip={false}>
              <View style={s.callout}>
                <Text style={s.calloutCall}>{aircraft.callsign || aircraft.icao24}</Text>
                {aircraft.altitude != null && (
                  <Text style={s.calloutMeta}>Alt: {Math.round(aircraft.altitude).toLocaleString()} ft</Text>
                )}
                {aircraft.speed != null && (
                  <Text style={s.calloutMeta}>Vel: {Math.round(aircraft.speed)} kts</Text>
                )}
                <Text style={[s.calloutType, { color: aircraft.type === 'military' ? '#ff3b4a' : '#00c8ff' }]}>
                  {aircraft.type === 'military' ? 'MILITARY' : 'CIVIL'}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={s.panel}>
        <View style={s.panelItem}>
          <Text style={s.panelVal}>{visibleAircraft.length}</Text>
          <Text style={s.panelLabel}>✈ AERONAVES</Text>
        </View>
        <View style={s.panelDivider} />
        <View style={s.panelItem}>
          <Text style={[s.panelVal, { color:C.red }]}>
            {visibleAircraft.filter(a => a.type === 'military').length}
          </Text>
          <Text style={s.panelLabel}>🔴 MIL.</Text>
        </View>
        <View style={s.panelDivider} />
        <View style={s.panelItem}>
          <Text style={[s.panelVal, { color: highAlerts.length > 0 ? C.red : C.txt3 }]}>
            {highAlerts.length}
          </Text>
          <Text style={s.panelLabel}>⚠ ALERTAS</Text>
        </View>
        <View style={s.panelDivider} />
        <View style={s.panelItem}>
          <View style={[s.wsDot, { backgroundColor: WS_COLOR[wsStatus] || C.amber }]} />
          <Text style={[s.panelLabel, { color: WS_COLOR[wsStatus] || C.amber }]}>
            {wsStatus.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex:1, backgroundColor:C.bg0 },
  callout:      { backgroundColor:C.bg1, padding:10, borderRadius:4, borderWidth:1, borderColor:C.borderMd, minWidth:120 },
  calloutCall:  { fontFamily:'SpaceMono', fontSize:11, color:C.cyan, fontWeight:'700', marginBottom:2 },
  calloutMeta:  { fontFamily:'SpaceMono', fontSize:9,  color:C.txt2, marginTop:1 },
  calloutType:  { fontFamily:'SpaceMono', fontSize:9,  fontWeight:'700', marginTop:4 },
  panel:        { position:'absolute', bottom:0, left:0, right:0,
                  flexDirection:'row', backgroundColor:'rgba(7,11,15,0.92)',
                  borderTopWidth:1, borderTopColor:C.borderMd,
                  paddingVertical:12, paddingHorizontal:8,
                  paddingBottom:28 },
  panelItem:    { flex:1, alignItems:'center', gap:3 },
  panelVal:     { fontFamily:'SpaceMono', fontSize:18, fontWeight:'700', color:C.cyan },
  panelLabel:   { fontFamily:'SpaceMono', fontSize:7,  color:C.txt3, letterSpacing:1 },
  panelDivider: { width:1, backgroundColor:C.borderMd, marginVertical:4 },
  wsDot:        { width:8, height:8, borderRadius:4, marginBottom:2 },
})
