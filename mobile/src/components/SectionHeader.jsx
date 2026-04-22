import { View, Text, StyleSheet } from 'react-native'
import { C } from '../theme'

export function SectionHeader({ title, count }) {
  return (
    <View style={s.row}>
      <Text style={s.title}>{title}</Text>
      {count != null ? <Text style={s.count}>{count}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
           paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8 },
  title: { fontSize: 13, fontWeight: '600', color: 'rgba(235,235,245,0.6)',
           textTransform: 'uppercase', letterSpacing: 0.5 },
  count: { fontSize: 13, color: 'rgba(235,235,245,0.3)' },
})
