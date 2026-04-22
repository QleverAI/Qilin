import { View, Text, StyleSheet } from 'react-native'
import { C } from '../theme'

export function StatTile({ value, label, color, style }) {
  return (
    <View style={[s.tile, style]}>
      <Text style={[s.value, color && { color }]}>{value ?? '—'}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  tile:  { flex: 1, backgroundColor: C.bg1, borderRadius: 12, padding: 16, alignItems: 'center', gap: 4 },
  value: { fontSize: 34, fontWeight: '700', color: '#ffffff', lineHeight: 40 },
  label: { fontSize: 12, fontWeight: '500', color: 'rgba(235,235,245,0.6)', textAlign: 'center' },
})
