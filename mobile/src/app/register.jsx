import { useState, useEffect, useMemo }                     from 'react'
import { View, Text, TextInput, Pressable,
         KeyboardAvoidingView, Platform, StyleSheet,
         ActivityIndicator, SafeAreaView, ScrollView }      from 'react-native'
import { router, Stack, useLocalSearchParams }              from 'expo-router'
import * as Haptics                                         from 'expo-haptics'
import { useLang }                                          from '../hooks/useLanguage'
import { setToken, getToken }                               from '../hooks/apiClient'
import TopicSelector                                        from '../components/TopicSelector'
import { C, T }                                             from '../theme'
import { useBreakpoint }                                    from '../theme/responsive'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

const PLAN_META = {
  scout:   { name: 'Scout',   price: '$0'   },
  analyst: { name: 'Analyst', price: '$49'  },
  command: { name: 'Command', price: '$199' },
}

const PLAN_TOPIC_LIMIT = { scout: 5, analyst: 20, command: null, free: 2 }

function StepIndicator({ step, labels }) {
  return (
    <View style={si.row}>
      {labels.map((label, i) => {
        const idx   = i + 1
        const done  = step > idx
        const active = step === idx
        return (
          <View key={label} style={si.item}>
            <View style={[si.circle, done && si.circleDone, active && si.circleActive]}>
              <Text style={[si.circleText, done && si.circleTextDone, active && si.circleTextActive]}>
                {done ? '✓' : idx}
              </Text>
            </View>
            <Text style={[si.label, active && si.labelActive]}>{label}</Text>
            {i < labels.length - 1 && <View style={si.line} />}
          </View>
        )
      })}
    </View>
  )
}

const si = StyleSheet.create({
  row:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 0, paddingVertical: 8 },
  item:           { flexDirection: 'row', alignItems: 'center', gap: 6 },
  circle:         { width: 24, height: 24, borderRadius: 12, borderWidth: 1,
                    borderColor: C.borderMd, alignItems: 'center', justifyContent: 'center' },
  circleDone:     { backgroundColor: C.blue, borderColor: C.blue },
  circleActive:   { borderColor: C.blue },
  circleText:     { fontSize: 11, fontWeight: '700', color: C.txt3 },
  circleTextDone: { color: '#ffffff' },
  circleTextActive: { color: C.blue },
  label:          { fontSize: 12, color: C.txt3 },
  labelActive:    { color: C.blue, fontWeight: '600' },
  line:           { width: 20, height: 1, backgroundColor: C.separator, marginHorizontal: 4 },
})

export default function RegisterScreen() {
  const { t }  = useLang()
  const { maxContentWidth, hPad } = useBreakpoint()
  const params = useLocalSearchParams()
  const plan   = PLAN_META[params.plan] || null
  const topicLimit = PLAN_TOPIC_LIMIT[params.plan] ?? 2

  const [step, setStep] = useState(1)

  // Step 1
  const [email,       setEmail]       = useState('')
  const [user,        setUser]        = useState('')
  const [pass,        setPass]        = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)

  // Step 2
  const [catalog,  setCatalog]  = useState([])
  const [myTopics, setMyTopics] = useState([])
  const [saving2,  setSaving2]  = useState(false)

  // Step 3
  const [chatId,  setChatId]  = useState('')
  const [saving3, setSaving3] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/topics`)
      .then(r => r.ok ? r.json() : { topics: [] })
      .then(d => setCatalog(d.topics || []))
      .catch(() => {})
  }, [])

  async function handleStep1() {
    setError('')
    if (pass !== confirmPass) { setError(t('register.pw_mismatch')); return }
    if (pass.length < 8)      { setError(t('register.pw_too_short')); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: user.toLowerCase(), password: pass, email }),
      })
      if (res.status === 409) { setError('Username or email already registered'); return }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.detail || t('register.error'))
        return
      }
      const data = await res.json()
      if (data.access_token) setToken(data.access_token)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setStep(2)
    } catch {
      setError(t('login.error_conn'))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2Continue() {
    if (myTopics.length > 0) {
      setSaving2(true)
      try {
        await fetch(`${API_BASE}/api/me/topics`, {
          method:  'PUT',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ topics: myTopics }),
        })
      } catch {}
      setSaving2(false)
    }
    setStep(3)
  }

  async function handleStep3Finish() {
    if (chatId.trim()) {
      setSaving3(true)
      try {
        await fetch(`${API_BASE}/api/me/telegram`, {
          method:  'PUT',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ chat_id: chatId.trim() }),
        })
      } catch {}
      setSaving3(false)
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    router.replace('/(tabs)')
  }

  const stepLabels = [t('register.step_account'), t('register.step_topics'), t('register.step_telegram')]

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ headerShown: true, title: t('register.title'),
        headerStyle: { backgroundColor: C.bg0 }, headerTintColor: '#ffffff' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.root}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 16, paddingBottom: 40,
            gap: 20, alignSelf: 'center', width: '100%', maxWidth: maxContentWidth }}
          keyboardShouldPersistTaps="handled"
        >
          <StepIndicator step={step} labels={stepLabels} />

          {plan ? (
            <View style={s.planBlock}>
              <Text style={s.planLabel}>{t('register.selected_plan', { name: `${plan.name} (${plan.price})` })}</Text>
              <Pressable onPress={() => router.push('/plans')}>
                <Text style={s.planChange}>{t('register.change_plan')}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── Step 1: Account ─────────────────────────────────────────── */}
          {step === 1 && (
            <View style={{ gap: 16 }}>
              <View style={s.inputGroup}>
                <TextInput
                  style={s.input}
                  placeholder={t('register.email')}
                  placeholderTextColor={C.txt3}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoFocus
                />
                <View style={s.sep} />
                <TextInput
                  style={s.input}
                  placeholder={t('register.user')}
                  placeholderTextColor={C.txt3}
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={s.sep} />
                <TextInput
                  style={s.input}
                  placeholder={t('register.password')}
                  placeholderTextColor={C.txt3}
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry
                />
                <View style={s.sep} />
                <TextInput
                  style={s.input}
                  placeholder={t('register.confirm_pass')}
                  placeholderTextColor={C.txt3}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  secureTextEntry
                  onSubmitEditing={handleStep1}
                />
              </View>

              {error ? <Text style={s.error}>{error}</Text> : null}

              <Pressable
                style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                onPress={handleStep1}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text style={s.btnText}>{t('common.continue')} →</Text>
                }
              </Pressable>

              <View style={s.footer}>
                <Text style={s.footerText}>{t('register.have_account')}</Text>
                <Pressable onPress={() => router.replace('/login')}>
                  <Text style={s.footerLink}>{t('register.login')}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Step 2: Topics ──────────────────────────────────────────── */}
          {step === 2 && (
            <View style={{ gap: 16 }}>
              <Text style={s.stepSubtitle}>
                {t('register.topics_subtitle', { n: topicLimit })}
              </Text>
              <TopicSelector
                selected={myTopics}
                limit={topicLimit}
                onChange={setMyTopics}
                catalog={catalog}
              />
              <Pressable
                style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                onPress={handleStep2Continue}
                disabled={saving2}
              >
                {saving2
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text style={s.btnText}>
                      {myTopics.length > 0
                        ? `${t('common.continue')} (${myTopics.length}) →`
                        : `${t('common.continue')} →`}
                    </Text>
                }
              </Pressable>
              <Pressable style={s.skipBtn} onPress={() => setStep(3)}>
                <Text style={s.skipText}>{t('register.skip')}</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 3: Telegram ────────────────────────────────────────── */}
          {step === 3 && (
            <View style={{ gap: 16 }}>
              <View style={[s.inputGroup, { padding: 14, gap: 10, overflow: 'visible' }]}>
                <Text style={s.tgInstructions}>{t('register.tg_instructions')}</Text>
                <TextInput
                  style={[s.input, { backgroundColor: C.bg2, borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 10 }]}
                  placeholder={t('telegram.placeholder')}
                  placeholderTextColor={C.txt3}
                  value={chatId}
                  onChangeText={setChatId}
                  keyboardType="numeric"
                />
              </View>
              <Pressable
                style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                onPress={handleStep3Finish}
                disabled={saving3}
              >
                {saving3
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text style={s.btnText}>
                      {chatId.trim() ? t('register.finish') : `${t('common.continue')} →`}
                    </Text>
                }
              </Pressable>
              <Pressable style={s.skipBtn} onPress={() => router.replace('/(tabs)')}>
                <Text style={s.skipText}>{t('register.skip')}</Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.bg0 },
  root:          { flex: 1 },
  planBlock:     { backgroundColor: C.blueFill, borderRadius: 10, padding: 14,
                   flexDirection: 'row', alignItems: 'center', gap: 10 },
  planLabel:     { flex: 1, fontSize: 14, color: '#ffffff' },
  planChange:    { fontSize: 13, color: C.blue, fontWeight: '600' },
  inputGroup:    { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  input:         { paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#ffffff' },
  sep:           { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 16 },
  error:         { fontSize: 15, color: C.red, textAlign: 'center' },
  btn:           { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnText:       { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  skipBtn:       { alignItems: 'center', paddingVertical: 8 },
  skipText:      { fontSize: 14, color: C.txt3 },
  stepSubtitle:  { fontSize: 14, color: C.txt2, textAlign: 'center', lineHeight: 20 },
  tgInstructions:{ fontSize: 13, color: C.txt3, lineHeight: 20 },
  footer:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText:    { fontSize: 14, color: C.txt3 },
  footerLink:    { fontSize: 14, color: C.blue, fontWeight: '600' },
})
