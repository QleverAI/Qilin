import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { router }                                         from 'expo-router'
import Ionicons                                           from '@expo/vector-icons/Ionicons'
import * as Haptics                                       from 'expo-haptics'
import { useSafeAreaInsets }                              from 'react-native-safe-area-context'
import { PageHeader }                                     from '../../components/PageHeader'
import { useLang }                                        from '../../hooks/useLanguage'
import { C }                                              from '../../theme'
import { useBreakpoint }                                  from '../../theme/responsive'
import { clearToken }                                     from '../../hooks/apiClient'
import { clearFeedCache }                                 from '../../hooks/feedCache'

function MenuItem({ icon, label, onPress, badge, color, fill, destructive }) {
  const iconColor = destructive ? C.red   : (color || C.blue)
  const iconFill  = destructive ? C.redFill : (fill || 'rgba(10,132,255,0.10)')
  return (
    <Pressable
      style={({ pressed }) => [s.item, pressed && s.itemPressed]}
      onPress={() => {
        Haptics.selectionAsync()
        onPress()
      }}
    >
      <View style={[s.iconBox, { backgroundColor: iconFill }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[s.label, destructive && s.labelRed]}>{label}</Text>
      {badge ? <Text style={s.badge}>{badge}</Text> : null}
      {!destructive && <Text style={s.chevron}>›</Text>}
    </Pressable>
  )
}

function Section({ title, accent, children }) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, accent && { color: C.gold }]}>{title}</Text>
      <View style={[s.card, accent && s.cardGold]}>{children}</View>
    </View>
  )
}

export default function MoreScreen() {
  const { t }    = useLang()
  const insets   = useSafeAreaInsets()
  const { hPad, maxContentWidth } = useBreakpoint()

  const go = (path) => () => router.push(path)

  async function handleLogout() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    await clearToken()
    await clearFeedCache()
    router.replace('/landing')
  }

  return (
    <View style={[s.root, { paddingBottom: insets.bottom }]}>
      <PageHeader title={t('tabs.more')} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: hPad,
          paddingTop: 12,
          paddingBottom: 32,
          gap: 20,
          alignSelf: 'center',
          width: '100%',
          maxWidth: maxContentWidth,
        }}
      >
        <Section title="FEEDS">
          <MenuItem icon="newspaper-outline"     color={C.blue}   fill="rgba(10,132,255,0.10)"
            label={t('news.title')}   onPress={go('/(tabs)/news')} />
          <View style={s.sep} />
          <MenuItem icon="people-outline"        color={C.indigo} fill="rgba(94,92,230,0.10)"
            label={t('social.title')} onPress={go('/(tabs)/social')} />
          <View style={s.sep} />
          <MenuItem icon="document-text-outline" color={C.teal}   fill={C.tealFill}
            label={t('docs.title')}   onPress={go('/(tabs)/documents')} />
        </Section>

        <Section title="MERCADOS">
          <MenuItem icon="trending-up-outline" color={C.green} fill="rgba(48,209,88,0.10)"
            label={t('markets.title')}    onPress={go('/(tabs)/markets')} />
          <View style={s.sep} />
          <MenuItem icon="pie-chart-outline"   color={C.amber} fill={C.amberFill}
            label={t('polymarket.title')} onPress={go('/(tabs)/polymarket')} />
        </Section>

        <Section title="OBSERVACIÓN">
          <MenuItem icon="map-outline"    color={C.blue} fill="rgba(10,132,255,0.10)"
            label={t('tabs.tactical')} onPress={go('/(tabs)/tactical')} />
          <View style={s.sep} />
          <MenuItem icon="planet-outline" color={C.teal} fill={C.tealFill}
            label={t('sentinel.title')} onPress={go('/(tabs)/sentinel')} />
        </Section>

        <Section title={t('profile.account').toUpperCase()} accent>
          <MenuItem icon="person-circle-outline" color={C.gold}  fill={C.goldFill}
            label={t('profile.title')} onPress={go('/profile')} />
          <View style={s.sep} />
          <MenuItem icon="card-outline"          color={C.green} fill="rgba(48,209,88,0.10)"
            label={t('plans.title')}   onPress={go('/plans')} />
          <View style={s.sep} />
          <MenuItem icon="log-out-outline" label={t('profile.logout')}
            onPress={handleLogout} destructive />
        </Section>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg0 },
  section:      { gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.txt3,
                  letterSpacing: 2, paddingHorizontal: 2, textTransform: 'uppercase' },
  card:         { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  cardGold:     { borderWidth: 1, borderColor: C.goldBorder },
  item:         { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 14, paddingVertical: 11, gap: 12 },
  itemPressed:  { backgroundColor: 'rgba(255,255,255,0.03)' },
  iconBox:      { width: 30, height: 30, borderRadius: 8,
                  alignItems: 'center', justifyContent: 'center' },
  label:        { flex: 1, fontSize: 15, fontWeight: '500', color: '#ffffff' },
  labelRed:     { color: C.red },
  badge:        { fontSize: 12, color: C.txt3, fontFamily: 'SpaceMono' },
  chevron:      { fontSize: 18, color: 'rgba(235,235,245,0.2)', fontWeight: '300' },
  sep:          { height: 1, backgroundColor: C.separator, marginLeft: 56 },
})
