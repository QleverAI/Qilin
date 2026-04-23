import { useEffect } from 'react'
import { Tabs }      from 'expo-router'
import Ionicons       from '@expo/vector-icons/Ionicons'
import { C }          from '../../theme'
import { useLang }    from '../../hooks/useLanguage'
import { prefetchNewsFeed }      from '../../hooks/useNewsFeed'
import { prefetchSocialFeed }    from '../../hooks/useSocialFeed'
import { prefetchDocsFeed }      from '../../hooks/useDocsFeed'
import { prefetchSecFeed }       from '../../hooks/useSecFeed'
import { prefetchIntelTimeline } from '../../hooks/useIntelTimeline'
import { prefetchMarkets }       from '../../hooks/useMarkets'
import { prefetchPolymarket }    from '../../hooks/usePolymarketFeed'
import { prefetchSentinel }      from '../../hooks/useSentinelData'

function icon(name) {
  return ({ color, size }) => <Ionicons name={name} size={size ?? 22} color={color} />
}

export default function TabsLayout() {
  const { t } = useLang()

  // Post-login prefetch: todos los feeds en paralelo. Al tocar una pestaña
  // la data ya está en memCache → pantalla monta sin spinner.
  useEffect(() => {
    prefetchNewsFeed()
    prefetchSocialFeed()
    prefetchDocsFeed()
    prefetchSecFeed()
    prefetchIntelTimeline()
    prefetchMarkets()
    prefetchPolymarket()
    prefetchSentinel()
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
      {/* ── Primarias (visibles en la tab bar) ─────────────────────────── */}
      <Tabs.Screen name="index"    options={{ title: t('tabs.home'),     tabBarIcon: icon('home') }} />
      <Tabs.Screen name="tactical" options={{ title: t('tabs.tactical'), tabBarIcon: icon('map') }} />
      <Tabs.Screen name="intel"    options={{ title: t('tabs.intel'),    tabBarIcon: icon('radio') }} />
      <Tabs.Screen name="news"     options={{ title: t('tabs.news'),     tabBarIcon: icon('newspaper') }} />
      <Tabs.Screen name="more"     options={{ title: t('tabs.more'),     tabBarIcon: icon('ellipsis-horizontal') }} />

      {/* ── Secundarias (ocultas del tab bar, accesibles desde "Más") ──── */}
      <Tabs.Screen name="social"     options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="documents"  options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="sec"        options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="markets"    options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="polymarket" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="sentinel"   options={{ tabBarButton: () => null }} />
    </Tabs>
  )
}
