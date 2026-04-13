import { useState }                          from 'react'
import { View, Text, TextInput, Pressable,
         KeyboardAvoidingView, Platform,
         StyleSheet, ActivityIndicator }     from 'react-native'
import { router }                            from 'expo-router'
import { C }                                from '../theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'

export default function LoginPage() {
  const [user,    setUser]    = useState('')
  const [pass,    setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError(''); setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
      })
      if (res.ok) {
        const { access_token } = await res.json()
        // TODO: store in expo-secure-store
        // await SecureStore.setItemAsync('qilin_token', access_token)
        router.replace('/(tabs)')
        return
      }
      setError('Credenciales incorrectas')
    } catch {
      // Dev fallback
      if (user === 'carlos' && pass === '12345') {
        router.replace('/(tabs)')
      } else {
        setError('Sin conexión al servidor')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.root}
    >
      <View style={s.card}>
        {/* Logo */}
        <Text style={s.logo}>◎ QILIN</Text>
        <Text style={s.sub}>INTELIGENCIA GEOPOLÍTICA</Text>

        {/* Fields */}
        <TextInput
          style={s.input}
          placeholder="usuario"
          placeholderTextColor={C.txt3}
          value={user}
          onChangeText={setUser}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={s.input}
          placeholder="contraseña"
          placeholderTextColor={C.txt3}
          value={pass}
          onChangeText={setPass}
          secureTextEntry
          onSubmitEditing={handleLogin}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color={C.bg0} />
            : <Text style={s.btnText}>ACCEDER</Text>
          }
        </Pressable>

        <Text style={s.hint}>SISTEMA RESTRINGIDO · USO AUTORIZADO ÚNICAMENTE</Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:    { flex:1, backgroundColor:C.bg0, justifyContent:'center', alignItems:'center', padding:24 },
  card:    { width:'100%', maxWidth:360, gap:12 },
  logo:    { fontSize:26, color:C.cyan, fontFamily:'SpaceMono', letterSpacing:4, textAlign:'center', marginBottom:2 },
  sub:     { fontSize:9, color:C.txt3, letterSpacing:3, textAlign:'center', marginBottom:24 },
  input:   {
    backgroundColor: C.bg2,
    borderWidth:1, borderColor:C.borderMd,
    color:C.txt1, fontFamily:'SpaceMono',
    fontSize:12, letterSpacing:1,
    padding:14, borderRadius:3,
  },
  error:   { fontSize:10, color:C.red, fontFamily:'SpaceMono', textAlign:'center', letterSpacing:1 },
  btn:     {
    backgroundColor: C.cyan,
    padding:14, borderRadius:3, alignItems:'center',
    marginTop:4,
  },
  btnText: { color:C.bg0, fontFamily:'SpaceMono', fontSize:12, letterSpacing:3, fontWeight:'700' },
  hint:    { fontSize:8, color:C.txt3, textAlign:'center', letterSpacing:1, marginTop:16 },
})
