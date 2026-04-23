import { useEffect } from 'react'
import { Tabs }      from 'expo-router'
import Ionicons       from '@expo/vector-icons/Ionicons'
import { C }          from '../../theme'
import { prefetchNewsFeed }   from '../../hooks/useNewsFeed'
import { prefetchSocialFeed } from '../../hooks/useSocialFeed'
import { prefetchDocsFeed }   from '../../hooks/useDocsFeed'
import { prefetchSecFeed }    from '../../hooks/useSecFeed'

function icon(name) {
  return ({ color, size }) => <Ionicons name={name} size={size ?? 22} color={color} />
}

export default function TabsLayout() {
  // Tras entrar a las tabs (post-login), precalentamos todos los feeds en
  // paralelo. Cuando el usuario toca una pestaña la data ya está en memCache
  // y la pantalla monta sin spinner.
  useEffect(() => {
    prefetchNewsFeed()
    prefetchSocialFeed()
    prefetchDocsFeed()
    prefetchSecFeed()
  }, [])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(28,28,30,0.97)',
          borderTopColor:  C.separator,
          borderTopWidth:  0.5,
        },
        tabBarActiveTintColor:   C.blue,
        tabBarInactiveTintColor: C.txt3,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
      }}
    >
      <Tabs.Screen name="index"     options={{ title: 'Inicio',   tabBarIcon: icon('home') }} />
      <Tabs.Screen name="tactical"  options={{ title: 'Mapa',     tabBarIcon: icon('map') }} />
      <Tabs.Screen name="news"      options={{ title: 'Noticias', tabBarIcon: icon('newspaper') }} />
      <Tabs.Screen name="social"    options={{ title: 'Social',   tabBarIcon: icon('people') }} />
      <Tabs.Screen name="markets"   options={{ title: 'Mercados', tabBarIcon: icon('bar-chart') }} />
      <Tabs.Screen name="documents" options={{ tabBarButton: () => null }} />
    </Tabs>
  )
}
