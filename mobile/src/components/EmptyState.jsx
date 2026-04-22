import { View, Text, StyleSheet } from 'react-native'

export function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={s.root}>
      {icon ? <Text style={s.icon}>{icon}</Text> : null}
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  root:     { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 8 },
  icon:     { fontSize: 44, marginBottom: 8 },
  title:    { fontSize: 17, fontWeight: '600', color: 'rgba(235,235,245,0.6)', textAlign: 'center' },
  subtitle: { fontSize: 15, color: 'rgba(235,235,245,0.3)', textAlign: 'center', lineHeight: 22 },
})
