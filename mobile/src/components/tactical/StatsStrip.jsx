import { View, Text, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLang } from '../../hooks/useLanguage'
import { C } from '../../theme'

const WS_COLOR = { live: C.green, connecting: C.amber, reconnecting: C.amber, error: C.red }

export function StatsStrip({ aircraft, vessels, alerts, wsStatus }) {
  const { t }    = useLang()
  const insets   = useSafeAreaInsets()
  const military  = aircraft.filter(a => a.type === 'military' || a.category === 'military').length
  const highAlert = alerts.filter(a => a.severity === 'high').length
  const wsColor   = WS_COLOR[wsStatus] || C.amber

  return (
    <View style={[ss.wrapper, { bottom: insets.bottom + 12 }]}>
      <BlurView intensity={80} tint="dark" style={ss.blur}>
        <View style={ss.row}>
          <Stat value={aircraft.length} label={t('tactical.aircraft')} />
          <Div />
          <Stat value={military} label={t('tactical.military')} color={military > 0 ? C.red : undefined} />
          <Div />
          <Stat value={vessels.length} label={t('tactical.vessels')} />
          <Div />
          <Stat value={highAlert} label={t('tactical.alerts')} color={highAlert > 0 ? C.red : undefined} />
          <Div />
          <View style={ss.stat}>
            <View style={[ss.dot, { backgroundColor: wsColor }]} />
          </View>
        </View>
      </BlurView>
    </View>
  )
}

function Stat({ value, label, color }) {
  return (
    <View style={ss.stat}>
      <Text style={[ss.val, color && { color }]}>{value}</Text>
      <Text style={ss.lbl}>{label}</Text>
    </View>
  )
}

function Div() {
  return <View style={ss.divider} />
}

const ss = StyleSheet.create({
  wrapper: { position: 'absolute', alignSelf: 'center', zIndex: 10 },
  blur:    { borderRadius: 20, overflow: 'hidden' },
  row:     { flexDirection: 'row', alignItems: 'center',
             paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  stat:    { alignItems: 'center', gap: 2 },
  val:     { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  lbl:     { fontSize: 9, fontWeight: '500', color: 'rgba(235,235,245,0.5)', letterSpacing: 0.2 },
  divider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.12)' },
  dot:     { width: 8, height: 8, borderRadius: 4 },
})
