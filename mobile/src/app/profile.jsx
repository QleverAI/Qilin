import { useState, useEffect }                        from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView,
         SafeAreaView, Alert, TextInput, Image,
         ActivityIndicator }                          from 'react-native'
import { router, Stack }                               from 'expo-router'
import * as Haptics                                    from 'expo-haptics'
import * as ImagePicker                                from 'expo-image-picker'
import AsyncStorage                                    from '@react-native-async-storage/async-storage'
import Ionicons                                        from '@expo/vector-icons/Ionicons'
import { useProfile, clearProfileCache }               from '../hooks/useProfile'
import { useLang }                                     from '../hooks/useLanguage'
import { clearFeedCache }                              from '../hooks/feedCache'
import { setToken, getToken }                          from '../hooks/apiClient'
import TopicSelector                                   from '../components/TopicSelector'
import { C, T }                                        from '../theme'
import { useBreakpoint }                               from '../theme/responsive'

const AVATAR_KEY = 'qilin_avatar_uri'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

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

function SectionLabel({ children }) {
  return <Text style={s.sectionLabel}>{children}</Text>
}

function ActionBtn({ label, onPress, disabled, loading: isLoading }) {
  return (
    <Pressable
      style={[s.actionBtn, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled || isLoading}
    >
      {isLoading
        ? <ActivityIndicator size="small" color={C.cyan} />
        : <Text style={s.actionBtnText}>{label}</Text>
      }
    </Pressable>
  )
}

export default function ProfileScreen() {
  const { profile, loading } = useProfile()
  const { lang, switchLang, t } = useLang()
  const { maxContentWidth } = useBreakpoint()

  const [avatarUri,   setAvatarUri]   = useState(null)
  const [catalog,     setCatalog]     = useState([])
  const [myTopics,    setMyTopics]    = useState([])
  const [topicLimit,  setTopicLimit]  = useState(2)
  const [topicSaving, setTopicSaving] = useState(false)
  const [topicMsg,    setTopicMsg]    = useState('')

  const [chatId,    setChatId]    = useState('')
  const [tgSaving,  setTgSaving]  = useState(false)
  const [tgTesting, setTgTesting] = useState(false)
  const [tgMsg,     setTgMsg]     = useState('')
  const [tgTestMsg, setTgTestMsg] = useState('')

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then(uri => { if (uri) setAvatarUri(uri) })
  }, [])

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para cambiar la foto.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri
      setAvatarUri(uri)
      AsyncStorage.setItem(AVATAR_KEY, uri)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const token = getToken()
        if (!token) return
        const headers = { Authorization: `Bearer ${token}` }

        const [catRes, topRes, tgRes] = await Promise.all([
          fetch(`${API_BASE}/api/topics`,    { signal: controller.signal }),
          fetch(`${API_BASE}/api/me/topics`, { headers, signal: controller.signal }),
          fetch(`${API_BASE}/api/me/telegram`, { headers, signal: controller.signal }),
        ])
        if (!catRes.ok || !topRes.ok || !tgRes.ok) return
        const cat = await catRes.json()
        const top = await topRes.json()
        const tg  = await tgRes.json()
        setCatalog(cat.topics || [])
        setMyTopics(top.topics || [])
        setTopicLimit(top.limit ?? 2)
        setChatId(tg.chat_id || '')
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('[ProfileScreen] load failed:', e.message)
      }
    }

    load()
    return () => controller.abort()
  }, [])

  async function handleSaveTopics() {
    setTopicSaving(true); setTopicMsg('')
    try {
      const res = await fetch(`${API_BASE}/api/me/topics`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: myTopics }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setTopicMsg(data.detail || t('topics.error')); return }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      clearProfileCache()
      setTopicMsg(t('topics.saved'))
    } catch {
      setTopicMsg(t('topics.error'))
    } finally {
      setTopicSaving(false)
    }
  }

  async function handleSaveTelegram() {
    setTgSaving(true); setTgMsg('')
    try {
      const res = await fetch(`${API_BASE}/api/me/telegram`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId }),
      })
      if (!res.ok) { setTgMsg(t('telegram.error_save')); return }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setTgMsg(t('telegram.saved'))
    } catch {
      setTgMsg(t('telegram.error_save'))
    } finally {
      setTgSaving(false)
    }
  }

  async function handleTestTelegram() {
    setTgTesting(true); setTgTestMsg('')
    try {
      const res = await fetch(`${API_BASE}/api/me/telegram/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTgTestMsg(data.detail === 'no_chat_id' ? t('telegram.save_first') : t('telegram.error_test'))
        return
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setTgTestMsg(t('telegram.test_ok'))
    } catch {
      setTgTestMsg(t('telegram.error_test'))
    } finally {
      setTgTesting(false)
    }
  }

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
        headerStyle: { backgroundColor: C.bg0 }, headerTintColor: '#ffffff',
        headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24, alignSelf: 'center', width: '100%', maxWidth: maxContentWidth }}>

        {/* Avatar */}
        <View style={s.avatarBlock}>
          <Pressable onPress={pickAvatar} style={s.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Text style={s.avatarText}>
                  {(profile?.username || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={s.cameraBtn}>
              <Ionicons name="camera" size={14} color="#ffffff" />
            </View>
          </Pressable>
          <Text style={s.name}>{profile?.username || (loading ? t('common.loading') : '—')}</Text>
          {profile?.email ? <Text style={s.email}>{profile.email}</Text> : null}
        </View>

        {/* Account */}
        <View style={s.section}>
          <SectionLabel>{t('profile.account').toUpperCase()}</SectionLabel>
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

        {/* Preferences */}
        <View style={s.section}>
          <SectionLabel>{t('profile.preferences').toUpperCase()}</SectionLabel>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowLabel}>{t('profile.lang')}</Text>
              <View style={{ flex: 1 }} />
              <LangToggle lang={lang} onChange={switchLang} />
            </View>
          </View>
        </View>

        {/* My Topics */}
        <View style={s.section}>
          <SectionLabel>{t('topics.title').toUpperCase()}</SectionLabel>
          <View style={[s.card, { padding: 14, gap: 14 }]}>
            <TopicSelector
              selected={myTopics}
              limit={topicLimit}
              onChange={setMyTopics}
              catalog={catalog}
            />
            <View style={s.btnRow}>
              <ActionBtn
                label={topicSaving ? t('topics.saving') : t('topics.save')}
                onPress={handleSaveTopics}
                disabled={topicSaving}
                loading={topicSaving}
              />
              {topicMsg ? (
                <Text style={[s.msg, topicMsg.includes('✓') ? s.msgOk : s.msgErr]}>{topicMsg}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Telegram */}
        <View style={s.section}>
          <SectionLabel>{t('telegram.title').toUpperCase()}</SectionLabel>
          <View style={[s.card, { padding: 14, gap: 12 }]}>
            <Text style={s.tgInstructions}>{t('telegram.instructions')}</Text>
            <TextInput
              style={s.input}
              placeholder={t('telegram.placeholder')}
              placeholderTextColor={C.txt3}
              value={chatId}
              onChangeText={setChatId}
              keyboardType="numeric"
            />
            <View style={s.btnRow}>
              <ActionBtn
                label={tgSaving ? t('telegram.saving') : t('telegram.save')}
                onPress={handleSaveTelegram}
                disabled={tgSaving}
                loading={tgSaving}
              />
              <ActionBtn
                label={tgTesting ? t('telegram.testing') : t('telegram.test')}
                onPress={handleTestTelegram}
                disabled={tgTesting}
                loading={tgTesting}
              />
            </View>
            {tgMsg ? (
              <Text style={[s.msg, tgMsg.includes('✓') ? s.msgOk : s.msgErr]}>{tgMsg}</Text>
            ) : null}
            {tgTestMsg ? (
              <Text style={[s.msg, tgTestMsg.includes('✓') ? s.msgOk : s.msgErr]}>{tgTestMsg}</Text>
            ) : null}
          </View>
        </View>

        {/* Logout */}
        <Pressable style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>{t('profile.logout')}</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg0 },
  avatarBlock:       { alignItems: 'center', gap: 8, paddingTop: 16 },
  avatarWrap:        { position: 'relative' },
  avatar:            { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontSize: 34, fontWeight: '700', color: '#ffffff' },
  cameraBtn:         { position: 'absolute', bottom: 0, right: 0,
                       width: 26, height: 26, borderRadius: 13,
                       backgroundColor: C.blue, borderWidth: 2, borderColor: C.bg0,
                       alignItems: 'center', justifyContent: 'center' },
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
  input:         { backgroundColor: C.bg2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
                   fontSize: 15, color: '#ffffff' },
  tgInstructions:{ fontSize: 13, color: C.txt3, lineHeight: 20 },
  btnRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  actionBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                   borderWidth: 1, borderColor: C.cyan, backgroundColor: 'rgba(100,210,255,0.1)',
                   minWidth: 80, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: C.cyan, fontFamily: 'SpaceMono' },
  msg:           { fontSize: 12, fontFamily: 'SpaceMono' },
  msgOk:         { color: C.green },
  msgErr:        { color: C.red },
  logoutBtn:     { backgroundColor: C.redFill, borderRadius: 12, paddingVertical: 16,
                   alignItems: 'center' },
  logoutText:    { fontSize: 16, fontWeight: '600', color: C.red },
})
