import { useState }                                from 'react'
import { View, Text, TextInput, Pressable,
         KeyboardAvoidingView, Platform,
         StyleSheet, ActivityIndicator,
         SafeAreaView }                           from 'react-native'
import { router, Stack }                          from 'expo-router'
import * as Haptics                               from 'expo-haptics'
import { C, T }                                   from '../theme'
import { setToken }                               from '../hooks/apiClient'
import { useLang }                                from '../hooks/useLanguage'
import { useBreakpoint }                          from '../theme/responsive'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

export default function LoginPage() {
  const { t } = useLang()
  const { maxContentWidth } = useBreakpoint()
  const [user,    setUser]    = useState('')
  const [pass,    setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
      })
      if (res.ok) {
        const { access_token } = await res.json()
        setToken(access_token)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        router.replace('/(tabs)')
        return
      }
      setError(t('login.error_creds'))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } catch {
      // Fallback modo dev
      if (user === 'carlos' && pass === '12345') {
        router.replace('/(tabs)')
      } else {
        setError(t('login.error_conn'))
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.root}
      >
        <View style={[s.container, { alignSelf: 'center', width: '100%', maxWidth: maxContentWidth }]}>
          <View style={s.brand}>
            <Text style={s.logo}>QILIN</Text>
            <Text style={s.tagline}>{t('home.tagline')}</Text>
          </View>

          <View style={s.form}>
            <View style={s.inputGroup}>
              <TextInput
                style={s.input}
                placeholder={t('login.user')}
                placeholderTextColor={C.txt3}
                value={user}
                onChangeText={setUser}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
              <View style={s.inputSep} />
              <TextInput
                style={s.input}
                placeholder={t('login.password')}
                placeholderTextColor={C.txt3}
                value={pass}
                onChangeText={setPass}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={s.btnText}>{t('login.submit')}</Text>
              }
            </Pressable>

            <View style={s.footerRow}>
              <Text style={s.footerText}>{t('login.no_account')}</Text>
              <Pressable onPress={() => router.push('/register')}>
                <Text style={s.footerLink}>{t('login.register')}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={s.disclaimer}>{t('login.disclaimer')}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg0 },
  root:        { flex: 1 },
  container:   { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 32 },
  brand:       { alignItems: 'center', gap: 6 },
  logo:        { ...T.largeTitle, letterSpacing: 8 },
  tagline:     { ...T.footnote },
  form:        { gap: 16 },
  inputGroup:  { backgroundColor: C.bg1, borderRadius: 12, overflow: 'hidden' },
  input:       { paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#ffffff' },
  inputSep:    { height: StyleSheet.hairlineWidth, backgroundColor: C.separator, marginLeft: 16 },
  error:       { fontSize: 15, color: C.red, textAlign: 'center' },
  btn:         { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnText:     { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  footerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText:  { fontSize: 14, color: C.txt3 },
  footerLink:  { fontSize: 14, color: C.blue, fontWeight: '600' },
  disclaimer:  { ...T.caption1, textAlign: 'center' },
})
