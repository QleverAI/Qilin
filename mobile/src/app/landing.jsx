import { View, Text, Pressable, StyleSheet, ScrollView,
         SafeAreaView, StatusBar as RNStatusBar }      from 'react-native'
import { router, Stack }                               from 'expo-router'
import * as Haptics                                    from 'expo-haptics'
import { useLang }                                     from '../hooks/useLanguage'
import { C, T }                                        from '../theme'
import { useBreakpoint }                               from '../theme/responsive'

const FEATURES_KEY = [
  { icon: '✈', titleEs: 'Vigilancia aérea global',    titleEn: 'Global aerial surveillance',
    descEs: 'Militares + jets privados en tiempo real.', descEn: 'Military + private jets real-time.' },
  { icon: '⚓', titleEs: 'Tráfico naval',              titleEn: 'Naval traffic',
    descEs: 'Detección de buques dark.',                 descEn: 'Dark-vessel detection.' },
  { icon: '◉', titleEs: 'Alertas con IA',              titleEn: 'AI-powered alerts',
    descEs: 'Correlación multi-fuente en segundos.',     descEn: 'Multi-source correlation in seconds.' },
  { icon: '📡', titleEs: 'Señales satelitales',        titleEn: 'Satellite signals',
    descEs: 'Anomalías NO₂/SO₂ antes del parte oficial.',descEn: 'NO₂/SO₂ anomalies before official reports.' },
  { icon: '📰', titleEs: 'Inteligencia de medios',     titleEn: 'Media intelligence',
    descEs: '500+ fuentes agregadas y clasificadas.',    descEn: '500+ sources aggregated and classified.' },
  { icon: '◆', titleEs: 'Mercados de predicción',     titleEn: 'Prediction markets',
    descEs: 'Probabilidades vs. eventos reales.',        descEn: 'Probabilities vs. real events.' },
]

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

function FeatureCard({ feature, lang }) {
  return (
    <View style={s.feature}>
      <Text style={s.featureIcon}>{feature.icon}</Text>
      <Text style={s.featureTitle}>
        {lang === 'en' ? feature.titleEn : feature.titleEs}
      </Text>
      <Text style={s.featureDesc}>
        {lang === 'en' ? feature.descEn : feature.descEs}
      </Text>
    </View>
  )
}

export default function LandingScreen() {
  const { lang, t } = useLang()
  const { hPad, columns, maxContentWidth, isWide } = useBreakpoint()

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <RNStatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, alignSelf: 'center', width: '100%', maxWidth: maxContentWidth }}
      >
        <View style={[s.header, { paddingHorizontal: hPad }]}>
          <Text style={s.logo}>◈ QILIN</Text>
          <LangToggle />
        </View>

        <View style={[s.hero, { paddingHorizontal: hPad }]}>
          <View style={s.badge}>
            <View style={s.badgeDot} />
            <Text style={s.badgeText}>{t('landing.hero_badge')}</Text>
          </View>
          <Text style={[s.h1, isWide && { fontSize: 52 }]}>
            {t('landing.hero_h1a')}
          </Text>
          <Text style={[s.h1Accent, isWide && { fontSize: 52 }]}>
            {t('landing.hero_h1b')}
          </Text>
          <Text style={s.sub}>
            {t('landing.hero_sub')}
          </Text>

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
        </View>

        <View style={[s.featuresGrid, { paddingHorizontal: hPad,
          flexDirection: columns >= 2 ? 'row' : 'column',
          flexWrap: columns >= 2 ? 'wrap' : undefined,
        }]}>
          {FEATURES_KEY.map((f, i) => (
            <View
              key={i}
              style={{
                width: columns >= 2 ? '48%' : '100%',
                marginBottom: 12,
              }}
            >
              <FeatureCard feature={f} lang={lang} />
            </View>
          ))}
        </View>

        <Text style={s.footerCopy}>
          © 2026 Qilin Intelligence
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#02060e' },
  header:         { flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between', paddingTop: 12, paddingBottom: 20 },
  logo:           { fontSize: 16, fontWeight: '700', color: '#c8a03c',
                    letterSpacing: 3, fontFamily: 'SpaceMono' },
  langGroup:      { flexDirection: 'row', backgroundColor: 'rgba(200,160,60,0.07)',
                    borderWidth: 1, borderColor: 'rgba(200,160,60,0.22)',
                    borderRadius: 16, padding: 2, gap: 2 },
  langBtn:        { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12 },
  langBtnActive:  { backgroundColor: '#c8a03c' },
  langText:       { fontSize: 11, fontWeight: '700',
                    color: 'rgba(200,160,60,0.55)', fontFamily: 'SpaceMono' },
  langTextActive: { color: '#02060e' },
  hero:           { alignItems: 'center', paddingTop: 48, paddingBottom: 64, gap: 20 },
  badge:          { flexDirection: 'row', alignItems: 'center', gap: 8,
                    borderWidth: 1, borderColor: 'rgba(200,160,60,0.22)',
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
                    backgroundColor: 'rgba(200,160,60,0.07)' },
  badgeDot:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#c8a03c' },
  badgeText:      { fontSize: 11, color: 'rgba(200,160,60,0.55)', letterSpacing: 1.5,
                    textTransform: 'uppercase', fontFamily: 'SpaceMono' },
  h1:             { fontSize: 38, fontWeight: '800', color: '#ffffff',
                    textAlign: 'center', lineHeight: 44 },
  h1Accent:       { fontSize: 38, fontWeight: '800', color: '#e8c060',
                    textAlign: 'center', lineHeight: 44, fontStyle: 'italic' },
  sub:            { fontSize: 15, color: 'rgba(220,230,245,0.6)',
                    textAlign: 'center', lineHeight: 22, paddingHorizontal: 12 },
  ctaRow:         { flexDirection: 'row', gap: 12, marginTop: 20 },
  ctaPrimary:     { paddingHorizontal: 24, paddingVertical: 13, borderRadius: 8,
                    backgroundColor: 'rgba(200,160,60,0.15)', borderWidth: 1,
                    borderColor: '#c8a03c' },
  ctaPrimaryText: { fontSize: 14, fontWeight: '700', color: '#e8c060' },
  ctaSecondary:   { paddingHorizontal: 24, paddingVertical: 13, borderRadius: 8,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  ctaSecondaryText:{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  featuresGrid:   { paddingTop: 24, justifyContent: 'space-between' },
  feature:        { backgroundColor: '#040c18', borderRadius: 12, padding: 16, gap: 8,
                    borderWidth: 1, borderColor: 'rgba(200,160,60,0.12)', minHeight: 130 },
  featureIcon:    { fontSize: 24 },
  featureTitle:   { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  featureDesc:    { fontSize: 13, color: 'rgba(220,230,245,0.6)', lineHeight: 19 },
  footerCopy:     { textAlign: 'center', fontSize: 11, color: 'rgba(220,230,245,0.3)',
                    marginTop: 20 },
})
