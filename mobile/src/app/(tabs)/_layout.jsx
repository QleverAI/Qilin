import { View, Pressable, StyleSheet }     from 'react-native'
import { useEffect }                       from 'react'
import { Tabs, router }                    from 'expo-router'
import Ionicons                            from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets }               from 'react-native-safe-area-context'
import { getToken }                        from '../../hooks/apiClient'
import { prefetchNewsFeed }                from '../../hooks/useNewsFeed'
import { prefetchSocialFeed }              from '../../hooks/useSocialFeed'
import { prefetchDocsFeed }                from '../../hooks/useDocsFeed'
import { prefetchSecFeed }                 from '../../hooks/useSecFeed'
import { prefetchIntelTimeline }           from '../../hooks/useIntelTimeline'
import { prefetchMarkets }                 from '../../hooks/useMarkets'
import { prefetchPolymarket }              from '../../hooks/usePolymarketFeed'
import { prefetchSentinel }                from '../../hooks/useSentinelData'

const PRIMARY = ['index', 'tactical', 'intel', 'news', 'more']
const ICONS = {
  index:    ['home-outline',        'home'],
  tactical: ['map-outline',         'map'],
  intel:    ['radio-outline',       'radio'],
  news:     ['newspaper-outline',   'newspaper'],
  more:     ['ellipsis-horizontal', 'ellipsis-horizontal'],
}

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets()
  const routes = state.routes.filter(r => PRIMARY.includes(r.name))

  return (
    <View style={[tb.bar, { paddingBottom: insets.bottom || 12 }]}>
      {routes.map(route => {
        const idx     = state.routes.findIndex(r => r.name === route.name)
        const focused = state.index === idx
        const [off, on] = ICONS[route.name] || ['circle-outline', 'circle']
        return (
          <Pressable
            key={route.key}
            style={tb.tab}
            onPress={() => {
              const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !ev.defaultPrevented) navigation.navigate(route.name)
            }}
          >
            <Ionicons
              name={focused ? on : off}
              size={22}
              color={focused ? '#c8a03c' : 'rgba(255,255,255,0.28)'}
            />
            <View style={[tb.dot, focused && tb.dotActive]} />
          </Pressable>
        )
      })}
    </View>
  )
}

const tb = StyleSheet.create({
  bar:      { flexDirection: 'row', backgroundColor: '#08090d',
              borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8 },
  tab:      { flex: 1, alignItems: 'center', gap: 4 },
  dot:      { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  dotActive: { backgroundColor: '#c8a03c' },
})

export default function TabsLayout() {
  useEffect(() => {
    if (!getToken()) {
      router.replace('/landing')
      return
    }
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
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Home' }} />
      <Tabs.Screen name="tactical" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="intel"    options={{ title: 'Intel' }} />
      <Tabs.Screen name="news"     options={{ title: 'Noticias' }} />
      <Tabs.Screen name="more"     options={{ title: 'Más' }} />

      <Tabs.Screen name="chat"       options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="social"     options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="documents"  options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="sec"        options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="markets"    options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="polymarket" options={{ tabBarButton: () => null }} />
      <Tabs.Screen name="sentinel"   options={{ tabBarButton: () => null }} />
    </Tabs>
  )
}
