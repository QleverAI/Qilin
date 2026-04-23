import { View, Text, Pressable, StyleSheet, ScrollView,
         SafeAreaView, Alert }                         from 'react-native'
import { router, Stack }                               from 'expo-router'
import * as Haptics                                    from 'expo-haptics'
import { useProfile, clearProfileCache }               from '../hooks/useProfile'
import { useLang }                                     from '../hooks/useLanguage'
import { clearFeedCache }                              from '../hooks/feedCache'
import { setToken }                                    from '../hooks/apiClient'
import { C, T }                                        from '../theme'
import { useBreakpoint }                               from '../theme/responsive'

function Row({ label, value, onPress }) {
  return (
    <Pressable style={s.row} onPress={onPress} disabled={!onPress}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      {onPress ? <Text style={s.chevron}>›</Text> : null}
    </Pressable>
  )
}

function LangToggle({ lang, onChange }) {
  return (
    <View style={s.langGroup}>
      {['es', 'en'].map(l => (
        <Pressable
          key={l}
          onPress={() => {
            Haptics.selectionAsync()
            onChange(l)
          }}
          style={[s.langBtn, lang === l && s.langBtnActive]}
        >
          <Text style={[s.langText, lang === l && s.langTextActive]}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export default function ProfileScreen() {
  const { profile, loading } = useProfile()
  const { lang, switchLang, t } = useLang()
  const { maxContentWidth } = useBreakpoint()

  async function handleLogout() {
    const run = async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      clearProfileCache()
      await clearFeedCache()
      setToken(null)
      router.replace('/landing')
    }
    Alert.alert(
      t('profile.logout'),
      t('profile.logout_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.logout'), style: 'destructive', onPress: run },
      ],
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ title: t('profile.title'), headerShown: true,
        headerStyle: { backgroundColor: C.bg0 }, headerTintColor: '#ffffff' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24, alignSelf: 'center', width: '100%', maxWidth: maxContentWidth }}>
        <View style={s.avatarBlock}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(profile?.username || '?')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={s.name}>{profile?.username || (loading ? t('common.loading') : '—')}</Text>
          {profile?.email ? <Text style={s.email}>{profile.email}</Text> : null}
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('profile.account').toUpperCase()}</Text>
          <View style={s.card}>
            <Row label={t('profile.username')} value={profile?.username || '—'} />
            <View style={s.sep} />
            <Row label={t('profile.email')} value={profile?.email || '—'} />
            <View style={s.sep} />
            <Row
              label={t('profile.plan')}
              value={profile?.plan || 'Scout'}
              onPress={() => router.push('/plans')}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('profile.preferences').toUpperCase()}</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowLabel}>{t('profile.lang')}</Text>
              <View style={{ flex: 1 }} />
              <LangToggle lang={lang} onChange={switchLang} />
            </View>
          </View>
        </View>

        <Pressable style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>{t('profile.logout')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg0 },
  avatarBlock:   { alignItems: 'center', gap: 8, paddingTop: 16 },
  avatar:        { width: 80, height: 80, borderRadius: 40, backgroundColor: C.bg2,
                   alignItems: 'center', justifyContent: 'center' },
  avatarText:    { fontSize: 34, fontWeight: '700', color: '#ffffff' },
  name:          { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  email:         { fontSize: 14, color: C.txt3 },
  section:       { gap: 6 },
  sectionLabel:  { fontSize: 12, fontWeight: '700', color: C.txt3,
                   letterSpacing: 0.5, paddingHorizontal: 4 },
  card:          { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  row:           { flexDirection: 'row', alignItems: 'center',
                   paddingHorizontal: 14, paddingVertical: 14, gap: 8 },
  rowLabel:      { fontSize: 15, color: '#ffffff' },
  rowValue:      { fontSize: 15, color: C.txt3 },
  chevron:       { fontSize: 18, color: C.txt3, fontWeight: '300' },
  sep:           { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 14 },
  langGroup:     { flexDirection: 'row', backgroundColor: C.bg2, borderRadius: 8, padding: 2 },
  langBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  langBtnActive: { backgroundColor: C.blue },
  langText:      { fontSize: 13, fontWeight: '700', color: C.txt3, fontFamily: 'SpaceMono' },
  langTextActive:{ color: '#ffffff' },
  logoutBtn:     { backgroundColor: C.redFill, borderRadius: 12, paddingVertical: 16,
                   alignItems: 'center' },
  logoutText:    { fontSize: 16, fontWeight: '600', color: C.red },
})
