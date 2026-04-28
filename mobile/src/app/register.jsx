import { useState, useEffect }                              from 'react'
import { View, Text, TextInput, Pressable,
         KeyboardAvoidingView, Platform, StyleSheet,
         ActivityIndicator, ScrollView, Linking }           from 'react-native'
import { router, Stack, useLocalSearchParams }              from 'expo-router'
import { useSafeAreaInsets }                                from 'react-native-safe-area-context'
import * as Haptics                                         from 'expo-haptics'
import Ionicons                                             from '@expo/vector-icons/Ionicons'
import { useLang }                                          from '../hooks/useLanguage'
import { setToken, getToken }                               from '../hooks/apiClient'
import TopicSelector                                        from '../components/TopicSelector'
import { C }                                               from '../theme'
import { useBreakpoint }                                    from '../theme/responsive'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

const PLAN_TOPIC_LIMIT = { scout: 5, analyst: 20, command: null }

function LangToggle() {
  const { lang, switchLang } = useLang()
  return (
    <View style={s.langGroup}>
      {['es', 'en'].map(l => (
        <Pressable key={l} onPress={() => { Haptics.selectionAsync(); switchLang(l) }}
          style={[s.langBtn, lang === l && s.langBtnActive]}>
          <Text style={[s.langText, lang === l && s.langTextActive]}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function StepIndicator({ step, labels }) {
  return (
    <View style={si.row}>
      {labels.map((label, i) => {
        const idx    = i + 1
        const done   = step > idx
        const active = step === idx
        return (
          <View key={label} style={si.item}>
            <View style={[si.circle, done && si.circleDone, active && si.circleActive]}>
              <Text style={[si.num, done && si.numDone, active && si.numActive]}>
                {done ? '✓' : idx}
              </Text>
            </View>
            <Text style={[si.label, active && si.labelActive]} numberOfLines={1}>{label}</Text>
            {i < labels.length - 1 && <View style={si.line} />}
          </View>
        )
      })}
    </View>
  )
}

const si = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  item:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  circle:     { width: 22, height: 22, borderRadius: 11, borderWidth: 1,
                borderColor: C.borderMd, alignItems: 'center', justifyContent: 'center' },
  circleDone: { backgroundColor: C.gold, borderColor: C.gold },
  circleActive:{ borderColor: C.gold },
  num:        { fontSize: 10, fontWeight: '700', color: C.txt3 },
  numDone:    { color: '#02060e' },
  numActive:  { color: C.gold },
  label:      { fontSize: 11, color: C.txt3, maxWidth: 52 },
  labelActive:{ color: C.gold, fontWeight: '600' },
  line:       { width: 14, height: 1, backgroundColor: C.separator, marginHorizontal: 3 },
})

function PlanCard({ planId, tier, name, price, priceNote, topics, paid, features, selected, onSelect, t }) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onSelect(planId) }}
      style={[pc.card, selected && pc.cardSelected]}
    >
      {paid && (
        <View style={pc.paidBadge}>
          <Text style={pc.paidText}>{t('register.plan_select_paid_badge')}</Text>
        </View>
      )}
      <Text style={pc.tier}>{tier}</Text>
      <Text style={[pc.name, selected && pc.nameSelected]}>{name}</Text>
      <View style={pc.priceRow}>
        <Text style={pc.price}>{price}</Text>
        {priceNote ? <Text style={pc.priceNote}>{priceNote}</Text> : null}
      </View>
      <View style={pc.topicsBadge}>
        <Text style={pc.topicsText}>
          {topics === null
            ? t('register.plan_select_topics_unlimited')
            : t('register.plan_select_topics', { n: topics })}
        </Text>
      </View>
      {features.map((f, i) => (
        <View key={i} style={pc.featureRow}>
          <Text style={pc.featureDot}>·</Text>
          <Text style={pc.featureText}>{f}</Text>
        </View>
      ))}
      {selected && (
        <View style={pc.selectedBadge}>
          <Text style={pc.selectedText}>✓ {t('register.plan_select_selected')}</Text>
        </View>
      )}
    </Pressable>
  )
}

const pc = StyleSheet.create({
  card:         { borderWidth: 1, borderColor: C.goldBorder, borderRadius: 12, padding: 14, gap: 6,
                  backgroundColor: 'rgba(255,255,255,0.02)' },
  cardSelected: { borderColor: C.gold, backgroundColor: C.goldFill },
  paidBadge:    { alignSelf: 'flex-end', backgroundColor: 'rgba(79,156,249,0.12)',
                  borderWidth: 1, borderColor: 'rgba(79,156,249,0.3)',
                  borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  paidText:     { fontSize: 9, color: 'rgba(79,156,249,0.8)', fontFamily: 'SpaceMono', letterSpacing: 0.5 },
  tier:         { fontSize: 9, letterSpacing: 1.5, color: 'rgba(200,160,60,0.5)', fontFamily: 'SpaceMono' },
  name:         { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  nameSelected: { color: C.gold },
  priceRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price:        { fontSize: 20, fontWeight: '800', color: C.gold },
  priceNote:    { fontSize: 11, color: 'rgba(200,160,60,0.6)' },
  topicsBadge:  { alignSelf: 'flex-start', backgroundColor: 'rgba(200,160,60,0.06)',
                  borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  topicsText:   { fontSize: 11, color: 'rgba(200,160,60,0.7)', fontFamily: 'SpaceMono' },
  featureRow:   { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  featureDot:   { fontSize: 12, color: C.txt3, lineHeight: 18 },
  featureText:  { fontSize: 12, color: C.txt2, lineHeight: 18, flex: 1 },
  selectedBadge:{ marginTop: 4, alignItems: 'center' },
  selectedText: { fontSize: 11, color: C.gold, fontFamily: 'SpaceMono', letterSpacing: 0.5 },
})

function Checkbox({ checked, onPress, label, link, onLinkPress }) {
  return (
    <Pressable style={cb.row} onPress={onPress}>
      <View style={[cb.box, checked && cb.boxChecked]}>
        {checked && <Ionicons name="checkmark" size={12} color="#02060e" />}
      </View>
      <Text style={cb.label}>
        {label}{link ? (
          <Text style={cb.link} onPress={e => { e.stopPropagation?.(); onLinkPress?.() }}> {link}</Text>
        ) : null}
      </Text>
    </Pressable>
  )
}

const cb = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  box:       { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
               borderColor: C.borderMd, alignItems: 'center', justifyContent: 'center',
               marginTop: 1, flexShrink: 0 },
  boxChecked:{ backgroundColor: C.gold, borderColor: C.gold },
  label:     { flex: 1, fontSize: 13, color: C.txt2, lineHeight: 20 },
  link:      { color: C.gold, textDecorationLine: 'underline' },
})

export default function RegisterScreen() {
  const { t }    = useLang()
  const insets   = useSafeAreaInsets()
  const { maxContentWidth, hPad } = useBreakpoint()
  const params   = useLocalSearchParams()

  const [step, setStep] = useState(params.plan ? 2 : 1)
  const [selectedPlan, setSelectedPlan] = useState(params.plan || 'scout')
  const topicLimit = PLAN_TOPIC_LIMIT[selectedPlan] ?? 5

  // Step 2 — Account
  const [email,       setEmail]       = useState('')
  const [user,        setUser]        = useState('')
  const [pass,        setPass]        = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptMkt,   setAcceptMkt]   = useState(false)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)

  // Step 3 — Topics
  const [catalog,  setCatalog]  = useState([])
  const [myTopics, setMyTopics] = useState([])
  const [saving2,  setSaving2]  = useState(false)

  // Step 4 — Telegram
  const [chatId,  setChatId]  = useState('')
  const [saving3, setSaving3] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/topics`)
      .then(r => r.ok ? r.json() : { topics: [] })
      .then(d => setCatalog(d.topics || []))
      .catch(() => {})
  }, [])

  async function handleStep2() {
    setError('')
    if (!acceptTerms) { setError(t('register.terms_required')); return }
    if (pass !== confirmPass) { setError(t('register.pw_mismatch')); return }
    if (pass.length < 8)     { setError(t('register.pw_too_short')); return }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          username:  user.toLowerCase(),
          password:  pass,
          email,
          marketing: acceptMkt,
        }),
      })
      if (res.status === 409) { setError('Usuario o email ya registrado'); return }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.detail || t('register.error')); return
      }
      const data = await res.json()
      if (data.access_token) setToken(data.access_token)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setStep(3)
    } catch {
      setError('Error de conexión')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStep3Continue() {
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
    setStep(4)
  }

  async function handleStep4Finish() {
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

  const stepLabels = [
    t('register.step_plan'),
    t('register.step_account'),
    t('register.step_topics'),
    t('register.step_telegram'),
  ]

  const plans = [
    {
      planId: 'scout', tier: 'TIER 01', name: 'Scout',
      price: t('register.plan_select_free_badge'), priceNote: '', topics: 5, paid: false,
      features: [t('register.plan_scout_f1'), t('register.plan_scout_f2'), t('register.plan_scout_f3')],
    },
    {
      planId: 'analyst', tier: 'TIER 02', name: 'Analyst',
      price: '49€', priceNote: t('register.plan_price_note'), topics: 20, paid: true,
      features: [t('register.plan_analyst_f1'), t('register.plan_analyst_f2'), t('register.plan_analyst_f3')],
    },
    {
      planId: 'command', tier: 'TIER 03', name: 'Command',
      price: '199€', priceNote: t('register.plan_price_note'), topics: null, paid: true,
      features: [t('register.plan_command_f1'), t('register.plan_command_f2'), t('register.plan_command_f3')],
    },
  ]

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.topBar}>
        <Pressable style={s.backBtn} onPress={() => step > 1 ? setStep(step - 1) : router.back()} hitSlop={8}>
          <Text style={s.backText}>← {t('common.back')}</Text>
        </Pressable>
        <LangToggle />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: hPad, paddingTop: 12, paddingBottom: 40,
            gap: 20, alignSelf: 'center', width: '100%', maxWidth: maxContentWidth,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <StepIndicator step={step} labels={stepLabels} />

          {/* ── Step 1: Plan ─────────────────────────────────────────────── */}
          {step === 1 && (
            <View style={{ gap: 16 }}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={s.stepTitle}>{t('register.plan_select_title')}</Text>
                <Text style={s.stepSub}>{t('register.plan_select_subtitle')}</Text>
              </View>
              <View style={{ gap: 10 }}>
                {plans.map(p => (
                  <PlanCard key={p.planId} {...p} selected={selectedPlan === p.planId}
                    onSelect={setSelectedPlan} t={t} />
                ))}
              </View>
              <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                onPress={() => setStep(2)}>
                <Text style={s.btnText}>
                  {t('register.plan_select_btn', { plan: plans.find(p => p.planId === selectedPlan)?.name || '' })}
                </Text>
              </Pressable>
              <View style={s.footer}>
                <Text style={s.footerText}>{t('register.have_account')}</Text>
                <Pressable onPress={() => router.replace('/login')}>
                  <Text style={s.footerLink}>{t('register.login')}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Step 2: Account ──────────────────────────────────────────── */}
          {step === 2 && (
            <View style={{ gap: 16 }}>
              <View style={s.inputGroup}>
                <TextInput style={s.input} placeholder={t('register.email')}
                  placeholderTextColor={C.txt3} value={email} onChangeText={setEmail}
                  autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoFocus />
                <View style={s.sep} />
                <TextInput style={s.input} placeholder={t('register.user')}
                  placeholderTextColor={C.txt3} value={user} onChangeText={setUser}
                  autoCapitalize="none" autoCorrect={false} />
                <View style={s.sep} />
                <TextInput style={s.input} placeholder={t('register.password')}
                  placeholderTextColor={C.txt3} value={pass} onChangeText={setPass} secureTextEntry />
                <View style={s.sep} />
                <TextInput style={s.input} placeholder={t('register.confirm_pass')}
                  placeholderTextColor={C.txt3} value={confirmPass} onChangeText={setConfirmPass}
                  secureTextEntry onSubmitEditing={handleStep2} />
              </View>

              <View style={{ gap: 12, paddingHorizontal: 4 }}>
                <Checkbox
                  checked={acceptTerms}
                  onPress={() => setAcceptTerms(v => !v)}
                  label={t('register.terms_accept')}
                  link={t('register.terms_link')}
                  onLinkPress={() => Linking.openURL(`${API_BASE}/terms`)}
                />
                <Checkbox
                  checked={acceptMkt}
                  onPress={() => setAcceptMkt(v => !v)}
                  label={t('register.marketing')}
                />
              </View>

              {error ? <Text style={s.error}>{error}</Text> : null}

              <Pressable
                style={({ pressed }) => [s.btn, (!acceptTerms || loading) && s.btnDisabled, pressed && { opacity: 0.85 }]}
                onPress={handleStep2}
                disabled={loading || !acceptTerms}
              >
                {loading
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text style={s.btnText}>{t('common.continue')} →</Text>}
              </Pressable>

              <View style={s.footer}>
                <Text style={s.footerText}>{t('register.have_account')}</Text>
                <Pressable onPress={() => router.replace('/login')}>
                  <Text style={s.footerLink}>{t('register.login')}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Step 3: Topics ───────────────────────────────────────────── */}
          {step === 3 && (
            <View style={{ gap: 16 }}>
              <Text style={s.stepSub}>
                {t('register.topics_subtitle', { n: topicLimit })}
              </Text>
              <TopicSelector selected={myTopics} limit={topicLimit}
                onChange={setMyTopics} catalog={catalog} />
              <Pressable
                style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                onPress={handleStep3Continue} disabled={saving2}>
                {saving2
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text style={s.btnText}>
                      {myTopics.length > 0
                        ? `${t('common.continue')} (${myTopics.length}) →`
                        : `${t('common.continue')} →`}
                    </Text>}
              </Pressable>
              <Pressable style={s.skipBtn} onPress={() => setStep(4)}>
                <Text style={s.skipText}>{t('register.skip')}</Text>
              </Pressable>
            </View>
          )}

          {/* ── Step 4: Telegram ─────────────────────────────────────────── */}
          {step === 4 && (
            <View style={{ gap: 16 }}>
              <View style={[s.inputGroup, { padding: 14, gap: 10 }]}>
                <Text style={s.tgHint}>{t('register.tg_instructions')}</Text>
                <TextInput
                  style={[s.input, { backgroundColor: C.bg2, borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 10 }]}
                  placeholder={t('telegram.placeholder')}
                  placeholderTextColor={C.txt3}
                  value={chatId} onChangeText={setChatId} keyboardType="numeric"
                />
              </View>
              <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                onPress={handleStep4Finish} disabled={saving3}>
                {saving3
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text style={s.btnText}>
                      {chatId.trim() ? t('register.finish') : `${t('common.continue')} →`}
                    </Text>}
              </Pressable>
              <Pressable style={s.skipBtn} onPress={() => router.replace('/(tabs)')}>
                <Text style={s.skipText}>{t('register.skip')}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg0 },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backText:    { fontSize: 15, color: C.txt2, fontWeight: '500' },
  langGroup:   { flexDirection: 'row', backgroundColor: C.goldFill,
                 borderWidth: 1, borderColor: C.goldBorder,
                 borderRadius: 16, padding: 2, gap: 2 },
  langBtn:     { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 12 },
  langBtnActive:{ backgroundColor: C.gold },
  langText:    { fontSize: 11, fontWeight: '700', color: 'rgba(200,160,60,0.55)', fontFamily: 'SpaceMono' },
  langTextActive:{ color: '#02060e' },
  stepTitle:   { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  stepSub:     { fontSize: 14, color: C.txt2, textAlign: 'center', lineHeight: 20 },
  inputGroup:  { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  input:       { paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#ffffff' },
  sep:         { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 16 },
  error:       { fontSize: 14, color: C.red, textAlign: 'center' },
  btn:         { backgroundColor: C.gold, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText:     { fontSize: 16, fontWeight: '700', color: '#02060e' },
  skipBtn:     { alignItems: 'center', paddingVertical: 8 },
  skipText:    { fontSize: 14, color: C.txt3 },
  tgHint:      { fontSize: 13, color: C.txt3, lineHeight: 20 },
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText:  { fontSize: 14, color: C.txt3 },
  footerLink:  { fontSize: 14, color: C.gold, fontWeight: '600' },
  backBtn:     {},
})
