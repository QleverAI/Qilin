import { Pressable, Text, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { C } from '../theme'

export function FilterPill({ label, active, onPress }) {
  function handle() {
    Haptics.selectionAsync()
    onPress()
  }
  return (
    <Pressable
      style={[s.pill, active && s.active]}
      onPress={handle}
      hitSlop={4}
    >
      <Text style={[s.text, active && s.textActive]}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  pill:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg2 },
  active:     { backgroundColor: C.blue },
  text:       { fontSize: 14, fontWeight: '500', color: 'rgba(235,235,245,0.6)' },
  textActive: { color: '#ffffff', fontWeight: '600' },
})
