import { View, Text, StyleSheet } from 'react-native'
import { SEV_COLOR, SEV_FILL, SEV_BORDER, SEV_LABEL } from '../theme'

export function SeverityBadge({ severity }) {
  const color  = SEV_COLOR[severity]  || 'rgba(235,235,245,0.3)'
  const fill   = SEV_FILL[severity]   || 'rgba(255,255,255,0.05)'
  const border = SEV_BORDER[severity] || 'rgba(235,235,245,0.10)'
  const label  = SEV_LABEL[severity]  || (severity || '').toUpperCase()
  return (
    <View style={[s.badge, { backgroundColor: fill, borderColor: border }]}>
      <Text style={[s.text, { color }]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  text:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
})
