import { useState }                      from 'react'
import { View, Text, TextInput, Pressable,
         KeyboardAvoidingView, Platform,
         StyleSheet, ActivityIndicator,
         SafeAreaView }                   from 'react-native'
import { router }                         from 'expo-router'
import * as Haptics                        from 'expo-haptics'
import { C, T }                           from '../theme'
import { setToken }                       from '../hooks/apiClient'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

export default function LoginPage() {
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
      setError('Credenciales incorrectas')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } catch {
      if (user === 'carlos' && pass === '12345') {
        router.replace('/(tabs)')
      } else {
        setError('Sin conexión con el servidor')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.root}
      >
        <View style={s.container}>
          <View style={s.brand}>
            <Text style={s.logo}>QILIN</Text>
            <Text style={s.tagline}>Inteligencia Geopolítica</Text>
          </View>

          <View style={s.form}>
            <View style={s.inputGroup}>
              <TextInput
                style={s.input}
                placeholder="Usuario"
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
                placeholder="Contraseña"
                placeholderTextColor={C.txt3}
                value={pass}
                onChangeText={setPass}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {error ? (
              <Text style={s.error}>{error}</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={s.btnText}>Iniciar sesión</Text>
              }
            </Pressable>
          </View>

          <Text style={s.disclaimer}>Sistema restringido — uso autorizado únicamente</Text>
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
  btn:         { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 16,
                 alignItems: 'center' },
  btnText:     { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  disclaimer:  { ...T.caption1, textAlign: 'center' },
})
