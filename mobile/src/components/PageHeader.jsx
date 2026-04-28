import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets }      from 'react-native-safe-area-context'
import { C }                      from '../theme'
import { LangToggle }             from './LangToggle'

export function PageHeader({ category, title, subtitle, right }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          {category ? <Text style={s.category}>{category}</Text> : null}
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={s.right}>{right ?? <LangToggle />}</View>
      </View>
      <View style={s.sep} />
    </View>
  )
}

const s = StyleSheet.create({
  root:     { backgroundColor: C.bg0 },
  row:      { flexDirection: 'row', alignItems: 'flex-end',
              paddingHorizontal: 16, paddingBottom: 10 },
  category: { fontSize: 10, fontWeight: '700', color: C.gold,
              letterSpacing: 2, marginBottom: 2, textTransform: 'uppercase' },
  title:    { fontSize: 22, fontWeight: '900', color: '#ffffff',
              letterSpacing: -0.5, lineHeight: 26 },
  subtitle: { fontSize: 12, color: C.txt3, marginTop: 3 },
  right:    { paddingBottom: 4 },
  sep:      { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
})
