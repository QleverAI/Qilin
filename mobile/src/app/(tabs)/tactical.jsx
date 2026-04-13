// Tactical map — MapLibre via WebView (Expo Go compatible, no native build needed)
import { useRef, useState }                                        from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView }           from 'react-native'
import { WebView }                                                  from 'react-native-webview'
import { useQilinData }                                             from '../../hooks/useQilinData'
import { C, SEV_COLOR }                                             from '../../theme'

function buildMapHtml(aircraft, vessels, alerts) {
  const features = [
    ...aircraft.map(a => ({
      type: 'Feature',
      properties: { kind:'aircraft', type:a.type, label: a.callsign || a.icao || '?' },
      geometry: { type:'Point', coordinates:[a.lon, a.lat] },
    })),
    ...vessels.map(v => ({
      type: 'Feature',
      properties: { kind:'vessel', type:v.type, label: v.name || v.mmsi || '?' },
      geometry: { type:'Point', coordinates:[v.lon, v.lat] },
    })),
    ...alerts.map(a => ({
      type: 'Feature',
      properties: { kind:'alert', severity:a.severity, label: a.title },
      geometry: { type:'Point', coordinates:[a.lon, a.lat] },
    })),
  ]
  const geojson = JSON.stringify({ type:'FeatureCollection', features })

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#070b0f}
#map{width:100vw;height:100vh}
.maplibregl-ctrl-attrib,.maplibregl-ctrl-logo{display:none}
.maplibregl-popup-content{background:#111820;border:1px solid rgba(255,255,255,0.12);border-radius:2px;padding:6px 10px;font-family:monospace;font-size:11px;color:#e2e8f0;box-shadow:none}
.maplibregl-popup-tip{border-top-color:#111820}
</style>
</head>
<body>
<div id="map"></div>
<script>
const map = new maplibregl.Map({
  container:'map',
  style:'https://demotiles.maplibre.org/style.json',
  center:[30,20], zoom:2,
  attributionControl:false,
});

map.on('load',()=>{
  map.addSource('entities',{type:'geojson',data:${geojson}});

  map.addLayer({id:'vessels',type:'circle',source:'entities',
    filter:['==',['get','kind'],'vessel'],
    paint:{
      'circle-radius':5,
      'circle-color':['case',
        ['==',['get','type'],'military'],'#ff3b4a',
        ['==',['get','type'],'tanker'],'#ffb020','#00e5a0'],
      'circle-stroke-width':1,'circle-stroke-color':'#070b0f',
    }
  });

  map.addLayer({id:'aircraft',type:'circle',source:'entities',
    filter:['==',['get','kind'],'aircraft'],
    paint:{
      'circle-radius':5,
      'circle-color':['case',['==',['get','type'],'military'],'#ffb020','#00c8ff'],
      'circle-stroke-width':1,'circle-stroke-color':'#070b0f',
    }
  });

  map.addLayer({id:'alerts',type:'circle',source:'entities',
    filter:['==',['get','kind'],'alert'],
    paint:{
      'circle-radius':10,
      'circle-color':['case',
        ['==',['get','severity'],'high'],'rgba(255,59,74,0.2)',
        ['==',['get','severity'],'medium'],'rgba(255,176,32,0.2)','rgba(0,229,160,0.2)'],
      'circle-stroke-width':2,
      'circle-stroke-color':['case',
        ['==',['get','severity'],'high'],'#ff3b4a',
        ['==',['get','severity'],'medium'],'#ffb020','#00e5a0'],
    }
  });

  ['aircraft','vessels','alerts'].forEach(layer=>{
    map.on('click',layer,e=>{
      new maplibregl.Popup({closeButton:false})
        .setLngLat(e.lngLat)
        .setHTML(e.features[0].properties.label)
        .addTo(map);
    });
  });
});

window.addEventListener('message',e=>{
  try{
    const m=JSON.parse(e.data);
    if(m.type==='flyTo') map.flyTo({center:[m.lon,m.lat],zoom:7,duration:1200});
  }catch{}
});
<\/script>
</body>
</html>`
}

export default function TacticalScreen() {
  const { aircraft, vessels, alerts, wsStatus } = useQilinData()
  const webviewRef  = useRef(null)
  const [panelOpen, setPanelOpen] = useState(false)

  function flyTo(lon, lat) {
    webviewRef.current?.postMessage(JSON.stringify({ type:'flyTo', lon, lat }))
    setPanelOpen(false)
  }

  const wsColor = wsStatus === 'live' ? C.green : wsStatus === 'error' ? C.red : C.amber
  const mapHtml = buildMapHtml(aircraft, vessels, alerts)

  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.topTitle}>◎ TÁCTICO</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
          <View style={[s.wsDot, { backgroundColor:wsColor }]} />
          <Text style={[s.wsLabel, { color:wsColor }]}>{wsStatus.toUpperCase()}</Text>
        </View>
        <View style={s.counters}>
          <Text style={[s.ctr, { color:C.cyan }]}>{aircraft.length} ✈</Text>
          <Text style={[s.ctr, { color:C.green }]}>{vessels.length} ⛵</Text>
          <Text style={[s.ctr, { color:C.red }]}>{alerts.length} ⚠</Text>
        </View>
        <Pressable style={s.alertBtn} onPress={() => setPanelOpen(p => !p)}>
          <Text style={s.alertBtnTxt}>ALERTAS</Text>
        </Pressable>
      </View>

      {/* Map */}
      <WebView
        ref={webviewRef}
        source={{ html: mapHtml }}
        style={{ flex:1, backgroundColor:C.bg0 }}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
      />

      {/* Alert panel */}
      {panelOpen && (
        <View style={s.panel}>
          <View style={s.handle} />
          <Text style={s.panelTitle}>ALERTAS · {alerts.length}</Text>
          <ScrollView>
            {alerts.length === 0
              ? <Text style={s.noAlerts}>Sin alertas activas</Text>
              : alerts.map(a => (
                  <Pressable key={a.id} style={s.alertRow} onPress={() => flyTo(a.lon, a.lat)}>
                    <View style={[s.alertDot, { backgroundColor:SEV_COLOR[a.severity] }]} />
                    <View style={{ flex:1 }}>
                      <Text style={s.alertTitle} numberOfLines={1}>{a.title}</Text>
                      <Text style={s.alertMeta}>{a.zone} · {a.time}</Text>
                    </View>
                    <Text style={s.arrow}>→</Text>
                  </Pressable>
                ))
            }
          </ScrollView>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:       { flex:1, backgroundColor:C.bg0 },
  topBar:     { flexDirection:'row', alignItems:'center', gap:8, padding:12, backgroundColor:C.bg1, borderBottomWidth:1, borderBottomColor:C.borderMd },
  topTitle:   { color:C.cyan, fontFamily:'SpaceMono', fontSize:11, letterSpacing:3 },
  wsDot:      { width:6, height:6, borderRadius:3 },
  wsLabel:    { fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  counters:   { flex:1, flexDirection:'row', justifyContent:'center', gap:10 },
  ctr:        { fontFamily:'SpaceMono', fontSize:10 },
  alertBtn:   { backgroundColor:'rgba(255,59,74,0.12)', borderWidth:1, borderColor:'rgba(255,59,74,0.35)', paddingHorizontal:10, paddingVertical:5, borderRadius:2 },
  alertBtnTxt:{ color:C.red, fontFamily:'SpaceMono', fontSize:8, letterSpacing:1 },
  panel:      { position:'absolute', bottom:0, left:0, right:0, backgroundColor:C.bg1, borderTopWidth:1, borderTopColor:C.borderMd, borderTopLeftRadius:12, borderTopRightRadius:12, maxHeight:'50%', padding:14, paddingTop:10 },
  handle:     { width:36, height:4, borderRadius:2, backgroundColor:C.borderMd, alignSelf:'center', marginBottom:10 },
  panelTitle: { fontFamily:'SpaceMono', fontSize:8, letterSpacing:2, color:C.txt3, marginBottom:8 },
  alertRow:   { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:9, borderBottomWidth:1, borderBottomColor:C.border },
  alertDot:   { width:7, height:7, borderRadius:4 },
  alertTitle: { fontSize:11, color:C.txt1 },
  alertMeta:  { fontSize:8, color:C.txt3, fontFamily:'SpaceMono', marginTop:2 },
  arrow:      { color:C.txt3, fontSize:14 },
  noAlerts:   { textAlign:'center', padding:20, fontFamily:'SpaceMono', fontSize:10, color:C.txt3 },
})
