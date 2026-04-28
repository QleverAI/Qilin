import { Pressable, Text, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { C } from '../theme'

export function FilterPill({ label, active, onPress }) {
  function handle() {
    Haptics.selectionAsync()
    onPress()
  }
  return (
    <Pressable style={[s.pill, active && s.active]} onPress={handle} hitSlop={4}>
      <Text style={[s.text, active && s.textActive]}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  pill:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  active:     { backgroundColor: C.goldFill, borderColor: C.goldBorder },
  text:       { fontSize: 12, fontWeight: '600', color: 'rgba(235,235,245,0.4)' },
  textActive: { color: C.gold, fontWeight: '700' },
})
