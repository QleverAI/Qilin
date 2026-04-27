import { useEffect, useState }        from 'react'
import { Stack, router }               from 'expo-router'
import { StatusBar }                   from 'expo-status-bar'
import * as SplashScreen               from 'expo-splash-screen'
import { GestureHandlerRootView }      from 'react-native-gesture-handler'
import { SafeAreaProvider }            from 'react-native-safe-area-context'
import { C }                           from '../theme'
import { loadToken, getToken }         from '../hooks/apiClient'
import { LanguageProvider }            from '../hooks/useLanguage'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    console.log('[Layout] starting loadToken')
    loadToken()
      .then(() => {
        const hasToken = !!getToken()
        console.log('[Layout] loadToken done, hasToken:', hasToken)
        if (!hasToken) router.replace('/landing')
      })
      .catch(err => console.error('[Layout] loadToken error:', err))
      .finally(() => {
        console.log('[Layout] hiding splash, setReady(true)')
        SplashScreen.hideAsync().catch(e => console.warn('[Layout] hideAsync failed:', e))
        setReady(true)
      })
  }, [])

  console.log('[Layout] render, ready:', ready)
  if (!ready) return null

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg0 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <StatusBar style="light" backgroundColor={C.bg0} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg0 } }}>
            <Stack.Screen name="(tabs)"   />
            <Stack.Screen name="landing"  options={{ animation: 'fade' }} />
            <Stack.Screen name="login"    options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="profile"  options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="plans"    options={{ animation: 'slide_from_right' }} />
          </Stack>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
