import { View, Text, Pressable, StyleSheet, ScrollView,
         SafeAreaView, Linking }                       from 'react-native'
import { Stack, router }                               from 'expo-router'
import * as Haptics                                    from 'expo-haptics'
import { useLang }                                     from '../hooks/useLanguage'
import { C, T }                                        from '../theme'
import { useBreakpoint }                               from '../theme/responsive'

function buildTiers(t) {
  return [
    {
      key: 'scout',
      tier: 'TIER 01',
      name: t('plans.scout_name'),
      price: '$0',
      tagline: t('plans.scout_tagline'),
      popular: false,
      feats: [
        { on: true,  t: 'Mapa militar con retraso' },
        { on: true,  t: 'Feed de noticias — últimas 24h' },
        { on: true,  t: '5 alertas geopolíticas/día' },
        { on: false, t: 'Aviones privados' },
        { on: false, t: 'Tráfico naval' },
        { on: false, t: 'Análisis IA' },
      ],
      cta: t('plans.cta_free'),
      action: () => router.push('/register?plan=scout'),
    },
    {
      key: 'analyst',
      tier: 'TIER 02',
      name: t('plans.analyst_name'),
      price: '$49',
      tagline: t('plans.analyst_tagline'),
      popular: true,
      feats: [
        { on: true, t: 'Mapa tiempo real (militar + privado)' },
        { on: true, t: 'Tráfico naval completo' },
        { on: true, t: '500+ fuentes + 300+ cuentas' },
        { on: true, t: 'Alertas ilimitadas' },
        { on: true, t: 'Historial de rutas y bases' },
        { on: true, t: 'Documentos + mercados predicción' },
      ],
      cta: t('plans.cta_trial'),
      action: () => router.push('/register?plan=analyst'),
    },
    {
      key: 'command',
      tier: 'TIER 03',
      name: t('plans.command_name'),
      price: '$199',
      tagline: t('plans.command_tagline'),
      popular: false,
      feats: [
        { on: true, t: 'Todo de Analyst' },
        { on: true, t: 'Datos satelitales (Sentinel)' },
        { on: true, t: 'Informes semanales IA' },
        { on: true, t: 'Acceso API REST' },
        { on: true, t: 'Hasta 5 usuarios' },
        { on: true, t: 'Historial ilimitado' },
      ],
      cta: t('plans.cta_contact'),
      action: () => Linking.openURL('mailto:ventas@qilin.app?subject=Plan%20Command').catch(() => {}),
    },
  ]
}

function PlanCard({ plan, popularLabel, periodLabel }) {
  return (
    <View style={[s.card, plan.popular && s.cardFeatured]}>
      {plan.popular ? (
        <View style={s.popularBadge}>
          <Text style={s.popularText}>{popularLabel}</Text>
        </View>
      ) : null}
      <Text style={s.tier}>{plan.tier}</Text>
      <Text style={s.name}>{plan.name}</Text>
      <View style={s.priceRow}>
        <Text style={s.price}>{plan.price}</Text>
        <Text style={s.period}>{periodLabel}</Text>
      </View>
      <Text style={s.tagline}>{plan.tagline}</Text>
      <View style={s.divider} />
      <View style={s.featList}>
        {plan.feats.map((f, i) => (
          <View key={i} style={s.featRow}>
            <Text style={[s.featMark, { color: f.on ? C.green : C.txt3 }]}>
              {f.on ? '✓' : '✗'}
            </Text>
            <Text style={[s.featText, !f.on && { color: C.txt3 }]}>{f.t}</Text>
          </View>
        ))}
      </View>
      <Pressable
        style={[s.cta, plan.popular && s.ctaFeatured]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          plan.action()
        }}
      >
        <Text style={[s.ctaText, plan.popular && s.ctaTextFeatured]}>{plan.cta}</Text>
      </Pressable>
    </View>
  )
}

export default function PlansScreen() {
  const { t } = useLang()
  const { hPad, columns, maxContentWidth } = useBreakpoint()
  const tiers = buildTiers(t)

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ title: t('plans.title'), headerShown: true,
        headerStyle: { backgroundColor: C.bg0 }, headerTintColor: '#ffffff' }} />
      <ScrollView contentContainerStyle={{
        padding: hPad, gap: 16, paddingBottom: 40,
        alignSelf: 'center', width: '100%', maxWidth: maxContentWidth,
      }}>
        <Text style={s.headerSub}>{t('plans.sub')}</Text>

        <View style={columns >= 2 ? s.gridRow : s.column}>
          {tiers.map(p => (
            <View key={p.key} style={columns >= 2 ? { flex: 1 } : undefined}>
              <PlanCard plan={p} popularLabel={t('plans.popular')} periodLabel={t('plans.month')} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg0 },
  headerSub:     { fontSize: 15, color: C.txt2, textAlign: 'center' },
  column:        { flexDirection: 'column', gap: 14 },
  gridRow:       { flexDirection: 'row', gap: 14, alignItems: 'stretch' },
  card:          { backgroundColor: C.bg1, borderRadius: 14, padding: 20, gap: 8,
                   borderWidth: 1, borderColor: C.separator, position: 'relative' },
  cardFeatured:  { backgroundColor: C.bg2, borderColor: C.blue },
  popularBadge:  { position: 'absolute', top: -10, alignSelf: 'center',
                   backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  popularText:   { fontSize: 10, fontWeight: '700', color: '#ffffff',
                   letterSpacing: 0.7, fontFamily: 'SpaceMono' },
  tier:          { fontSize: 10, fontWeight: '700', color: C.txt3,
                   letterSpacing: 0.7, fontFamily: 'SpaceMono' },
  name:          { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  priceRow:      { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  price:         { fontSize: 36, fontWeight: '800', color: '#ffffff' },
  period:        { fontSize: 14, color: C.txt3 },
  tagline:       { fontSize: 14, color: C.txt2, lineHeight: 20, marginTop: 4 },
  divider:       { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginVertical: 10 },
  featList:      { gap: 8 },
  featRow:       { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featMark:      { fontSize: 14, fontWeight: '700', width: 16 },
  featText:      { fontSize: 14, color: C.txt2, flex: 1, lineHeight: 20 },
  cta:           { marginTop: 14, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
                   borderWidth: 1, borderColor: C.separator },
  ctaFeatured:   { backgroundColor: C.blue, borderColor: C.blue },
  ctaText:       { fontSize: 15, fontWeight: '600', color: C.txt2 },
  ctaTextFeatured:{ color: '#ffffff' },
})
