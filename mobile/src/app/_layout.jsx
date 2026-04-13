import { useEffect } from 'react'
import { Stack }      from 'expo-router'
import { StatusBar }  from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { C } from '../theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => { SplashScreen.hideAsync() }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg0 }}>
      <StatusBar style="light" backgroundColor={C.bg0} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg0 } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login"  />
      </Stack>
    </GestureHandlerRootView>
  )
}
