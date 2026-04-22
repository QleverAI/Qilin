import { View, Text, StyleSheet } from 'react-native'
import { SEV_COLOR, SEV_FILL, SEV_LABEL } from '../theme'

export function SeverityBadge({ severity }) {
  const color = SEV_COLOR[severity] || 'rgba(235,235,245,0.3)'
  const fill  = SEV_FILL[severity]  || 'rgba(255,255,255,0.06)'
  const label = SEV_LABEL[severity] || (severity || '').toUpperCase()
  return (
    <View style={[s.badge, { backgroundColor: fill }]}>
      <Text style={[s.text, { color }]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  text:  { fontSize: 12, fontWeight: '600' },
})
