import { View, Text, Pressable, StyleSheet, ScrollView,
         SafeAreaView }                                from 'react-native'
import { router }                                      from 'expo-router'
import Ionicons                                        from '@expo/vector-icons/Ionicons'
import * as Haptics                                    from 'expo-haptics'
import { PageHeader }                                  from '../../components/PageHeader'
import { useLang }                                     from '../../hooks/useLanguage'
import { C, T }                                        from '../../theme'
import { useBreakpoint }                               from '../../theme/responsive'

function MenuItem({ icon, label, onPress, badge, color = C.blue }) {
  return (
    <Pressable
      style={s.item}
      onPress={() => {
        Haptics.selectionAsync()
        onPress()
      }}
    >
      <View style={[s.iconBox, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={s.label}>{label}</Text>
      {badge ? <Text style={s.badge}>{badge}</Text> : null}
      <Text style={s.chevron}>›</Text>
    </Pressable>
  )
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  )
}

export default function MoreScreen() {
  const { t } = useLang()
  const { maxContentWidth } = useBreakpoint()

  const go = (path) => () => router.push(path)

  return (
    <SafeAreaView style={s.safe}>
      <PageHeader title={t('tabs.more')} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 24,
          alignSelf: 'center', width: '100%', maxWidth: maxContentWidth }}
      >
        <Section title="FEEDS">
          <MenuItem icon="chatbubble-ellipses-outline" color={C.cyan} label={t('chat.title')}
            onPress={go('/(tabs)/chat')} />
          <View style={s.sep} />
          <MenuItem icon="people-outline"        color={C.indigo} label={t('social.title')}
            onPress={go('/(tabs)/social')} />
          <View style={s.sep} />
          <MenuItem icon="document-text-outline" color={C.cyan}   label={t('docs.title')}
            onPress={go('/(tabs)/documents')} />
        </Section>

        <Section title="MERCADOS">
          <MenuItem icon="trending-up-outline"   color={C.green}  label={t('markets.title')}
            onPress={go('/(tabs)/markets')} />
          <View style={s.sep} />
          <MenuItem icon="pie-chart-outline"     color={C.amber}  label={t('polymarket.title')}
            onPress={go('/(tabs)/polymarket')} />
          <View style={s.sep} />
          <MenuItem icon="bar-chart-outline"     color={C.red}    label={t('sec.title')}
            onPress={go('/(tabs)/sec')} />
        </Section>

        <Section title="OBSERVACIÓN">
          <MenuItem icon="planet-outline"        color={C.cyan}   label={t('sentinel.title')}
            onPress={go('/(tabs)/sentinel')} />
        </Section>

        <Section title={t('profile.account').toUpperCase()}>
          <MenuItem icon="person-circle-outline" color={C.blue}   label={t('profile.title')}
            onPress={go('/profile')} />
          <View style={s.sep} />
          <MenuItem icon="card-outline"          color={C.green}  label={t('plans.title')}
            onPress={go('/plans')} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.bg0 },
  section:      { gap: 6 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.txt3,
                  letterSpacing: 0.5, paddingHorizontal: 4 },
  card:         { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  item:         { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  iconBox:      { width: 32, height: 32, borderRadius: 8,
                  alignItems: 'center', justifyContent: 'center' },
  label:        { flex: 1, fontSize: 16, color: '#ffffff' },
  badge:        { fontSize: 12, color: C.txt3, fontFamily: 'SpaceMono' },
  chevron:      { fontSize: 22, color: C.txt3, fontWeight: '300' },
  sep:          { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 58 },
})
