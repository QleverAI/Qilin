import { useState, useMemo }                              from 'react'
import { View, Text, TextInput, Pressable,
         KeyboardAvoidingView, Platform, StyleSheet,
         ActivityIndicator, SafeAreaView, ScrollView } from 'react-native'
import { router, Stack, useLocalSearchParams }         from 'expo-router'
import * as Haptics                                    from 'expo-haptics'
import { useLang }                                     from '../hooks/useLanguage'
import { setToken }                                    from '../hooks/apiClient'
import { C, T }                                        from '../theme'
import { useBreakpoint }                               from '../theme/responsive'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

const PLAN_META = {
  scout:   { name: 'Scout',   price: '$0'   },
  analyst: { name: 'Analyst', price: '$49'  },
  command: { name: 'Command', price: '$199' },
}

export default function RegisterScreen() {
  const { t } = useLang()
  const { maxContentWidth, hPad } = useBreakpoint()
  const params = useLocalSearchParams()
  const plan   = PLAN_META[params.plan] || null

  const [email,   setEmail]   = useState('')
  const [user,    setUser]    = useState('')
  const [pass,    setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: user, password: pass, email }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.access_token) setToken(data.access_token)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        router.replace('/(tabs)')
        return
      }
      const body = await res.json().catch(() => ({}))
      setError(body.detail || t('register.error'))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } catch {
      setError(t('login.error_conn'))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ headerShown: true, title: t('register.title'),
        headerStyle: { backgroundColor: C.bg0 }, headerTintColor: '#ffffff' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.root}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 32, gap: 24,
            alignSelf: 'center', width: '100%', maxWidth: maxContentWidth }}
          keyboardShouldPersistTaps="handled"
        >
          {plan ? (
            <View style={s.planBlock}>
              <Text style={s.planLabel}>{t('register.selected_plan', { name: `${plan.name} (${plan.price})` })}</Text>
              <Pressable onPress={() => router.push('/plans')}>
                <Text style={s.planChange}>{t('register.change_plan')}</Text>
              </Pressable>
            </View>
          ) : null}

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
              onSubmitEditing={handleRegister}
            />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={s.btnText}>{t('register.submit')}</Text>
            }
          </Pressable>

          <View style={s.footer}>
            <Text style={s.footerText}>{t('register.have_account')}</Text>
            <Pressable onPress={() => router.replace('/login')}>
              <Text style={s.footerLink}>{t('register.login')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg0 },
  root:       { flex: 1 },
  planBlock:  { backgroundColor: C.blueFill, borderRadius: 10, padding: 14,
                flexDirection: 'row', alignItems: 'center', gap: 10 },
  planLabel:  { flex: 1, fontSize: 14, color: '#ffffff' },
  planChange: { fontSize: 13, color: C.blue, fontWeight: '600' },
  inputGroup: { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  input:      { paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#ffffff' },
  sep:        { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 16 },
  error:      { fontSize: 15, color: C.red, textAlign: 'center' },
  btn:        { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnText:    { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText: { fontSize: 14, color: C.txt3 },
  footerLink: { fontSize: 14, color: C.blue, fontWeight: '600' },
})
