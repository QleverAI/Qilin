import { View, Text, StyleSheet } from 'react-native'

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
           paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  title: { fontSize: 10, fontWeight: '700', color: 'rgba(235,235,245,0.35)',
           textTransform: 'uppercase', letterSpacing: 2 },
  count: { fontSize: 10, color: 'rgba(235,235,245,0.25)' },
})
