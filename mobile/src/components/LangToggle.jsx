import { Pressable, Text, StyleSheet } from 'react-native'
import { useLang }                    from '../hooks/useLanguage'
import { C }                          from '../theme'

export function LangToggle() {
  const { lang, switchLang } = useLang()
  const next = lang === 'es' ? 'en' : 'es'
  return (
    <Pressable
      style={({ pressed }) => [s.btn, pressed && s.pressed]}
      onPress={() => switchLang(next)}
      hitSlop={8}
    >
      <Text style={s.text}>{lang.toUpperCase()}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  btn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
             backgroundColor: 'rgba(255,255,255,0.06)',
             borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  pressed: { opacity: 0.6 },
  text:    { fontSize: 11, fontWeight: '700', color: C.txt2, letterSpacing: 1.5 },
})
