import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets }      from 'react-native-safe-area-context'
import { C, T }                   from '../theme'

export function PageHeader({ title, subtitle, right }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={s.right}>{right}</View> : null}
      </View>
      <View style={s.sep} />
    </View>
  )
}

const s = StyleSheet.create({
  root:     { backgroundColor: C.bg0 },
  row:      { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 10 },
  title:    { ...T.largeTitle },
  subtitle: { ...T.footnote, marginTop: 2 },
  right:    { paddingBottom: 4 },
  sep:      { height: StyleSheet.hairlineWidth, backgroundColor: C.separator },
})
