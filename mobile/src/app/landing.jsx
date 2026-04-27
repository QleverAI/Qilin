import { View, Text, Pressable, StyleSheet, Image,
         SafeAreaView, StatusBar as RNStatusBar }      from 'react-native'
import { router, Stack }                               from 'expo-router'
import * as Haptics                                    from 'expo-haptics'
import { useLang }                                     from '../hooks/useLanguage'
import { C }                                           from '../theme'
import { useBreakpoint }                               from '../theme/responsive'

function LangToggle() {
  const { lang, switchLang } = useLang()
  return (
    <View style={s.langGroup}>
      {['es', 'en'].map(l => (
        <Pressable
          key={l}
          onPress={() => { Haptics.selectionAsync(); switchLang(l) }}
          style={[s.langBtn, lang === l && s.langBtnActive]}
        >
          <Text style={[s.langText, lang === l && s.langTextActive]}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export default function LandingScreen() {
  const { t } = useLang()
  const { hPad, maxContentWidth } = useBreakpoint()

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <RNStatusBar barStyle="light-content" />

      <View style={[s.container, { paddingHorizontal: hPad, maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>

        {/* Lang toggle – esquina superior derecha */}
        <View style={s.topBar}>
          <LangToggle />
        </View>

        {/* Logo centrado */}
        <View style={s.logoWrap}>
          <Image
            source={require('../../assets/logo.png')}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={s.wordmark}>QILIN</Text>
        </View>

        {/* CTAs */}
        <View style={s.ctaRow}>
          <Pressable
            style={s.ctaPrimary}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push('/register')
            }}
          >
            <Text style={s.ctaPrimaryText}>{t('landing.cta_register')}</Text>
          </Pressable>
          <Pressable
            style={s.ctaSecondary}
            onPress={() => router.push('/login')}
          >
            <Text style={s.ctaSecondaryText}>{t('landing.cta_login')}</Text>
          </Pressable>
        </View>

        <Text style={s.footerCopy}>© 2026 Qilin Intelligence</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#02060e' },
  container:      { flex: 1, justifyContent: 'center' },
  topBar:         { position: 'absolute', top: 16, right: 0, alignItems: 'flex-end' },
  logoWrap:       { alignItems: 'center', gap: 20 },
  logo:           { width: 200, height: 200 },
  wordmark:       { fontSize: 28, fontWeight: '800', color: '#c8a03c',
                    letterSpacing: 8, fontFamily: 'SpaceMono' },
  ctaRow:         { flexDirection: 'row', gap: 12, marginTop: 56, justifyContent: 'center' },
  ctaPrimary:     { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10,
                    backgroundColor: 'rgba(200,160,60,0.15)', borderWidth: 1,
                    borderColor: '#c8a03c' },
  ctaPrimaryText: { fontSize: 15, fontWeight: '700', color: '#e8c060' },
  ctaSecondary:   { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  ctaSecondaryText:{ fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  footerCopy:     { textAlign: 'center', fontSize: 11, color: 'rgba(220,230,245,0.25)',
                    marginTop: 40 },
  langGroup:      { flexDirection: 'row', backgroundColor: 'rgba(200,160,60,0.07)',
                    borderWidth: 1, borderColor: 'rgba(200,160,60,0.22)',
                    borderRadius: 16, padding: 2, gap: 2 },
  langBtn:        { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12 },
  langBtnActive:  { backgroundColor: '#c8a03c' },
  langText:       { fontSize: 11, fontWeight: '700',
                    color: 'rgba(200,160,60,0.55)', fontFamily: 'SpaceMono' },
  langTextActive: { color: '#02060e' },
})
