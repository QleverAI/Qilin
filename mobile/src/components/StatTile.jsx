import { View, Text, StyleSheet } from 'react-native'

export function StatTile({ value, label, color, colorFill, colorBorder, style }) {
  return (
    <View style={[
      s.tile,
      colorFill   && { backgroundColor: colorFill },
      colorBorder && { borderColor: colorBorder },
      style,
    ]}>
      <Text style={[s.value, color && { color }]}>{value ?? '—'}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  tile:  { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center', gap: 3,
           borderWidth: 1, borderColor: 'transparent',
           backgroundColor: 'rgba(255,255,255,0.04)' },
  value: { fontSize: 20, fontWeight: '900', color: '#ffffff', lineHeight: 24 },
  label: { fontSize: 8, fontWeight: '600', color: 'rgba(235,235,245,0.35)',
           textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
})
