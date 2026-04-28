import { View, Pressable, StyleSheet,
         Animated, PanResponder, Image }   from 'react-native'
import { useEffect, useRef }               from 'react'
import { Tabs, router, usePathname }       from 'expo-router'
import Ionicons                            from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets }               from 'react-native-safe-area-context'

const DRAGON_LOGO = require('../../../assets/qilin-dragon.png')

function FloatingChatButton() {
  const insets   = useSafeAreaInsets()
  const pathname = usePathname()
  const pos      = useRef(new Animated.ValueXY()).current
  const moved    = useRef(false)

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,

      onPanResponderGrant: () => {
        pos.extractOffset()
        moved.current = false
      },

      onPanResponderMove: (_, g) => {
        moved.current = true
        pos.setValue({ x: g.dx, y: g.dy })
      },

      onPanResponderRelease: () => {
        pos.flattenOffset()
        if (!moved.current) router.push('/(tabs)/chat')
      },
    })
  ).current

  if (pathname.includes('chat')) return null

  const tabBarH = 60 + (insets.bottom || 0)

  return (
    <Animated.View
      style={[fab.btn, {
        bottom: tabBarH + 16,
        right:  20,
        transform: pos.getTranslateTransform(),
      }]}
      {...responder.panHandlers}
    >
      <Image source={DRAGON_LOGO} style={fab.logo} resizeMode="contain" />
    </Animated.View>
  )
}

const fab = StyleSheet.create({
  btn:  { position: 'absolute', zIndex: 999,
          width: 54, height: 54, borderRadius: 27,
          backgroundColor: '#0d1117',
          borderWidth: 1.5, borderColor: 'rgba(200,160,60,0.55)',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#c8a03c', shadowOpacity: 0.35,
          shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
          elevation: 10 },
  logo: { width: 36, height: 36 },
})
import { getToken }                        from '../../hooks/apiClient'
import { prefetchNewsFeed }                from '../../hooks/useNewsFeed'
import { prefetchSocialFeed }              from '../../hooks/useSocialFeed'
import { prefetchDocsFeed }                from '../../hooks/useDocsFeed'
import { prefetchSecFeed }                 from '../../hooks/useSecFeed'
import { prefetchIntelTimeline }           from '../../hooks/useIntelTimeline'
import { prefetchMarkets }                 from '../../hooks/useMarkets'
import { prefetchPolymarket }              from '../../hooks/usePolymarketFeed'
import { prefetchSentinel }                from '../../hooks/useSentinelData'

const PRIMARY = ['index', 'tactical', 'social', 'news', 'more']
const ICONS = {
  index:    ['home-outline',        'home'],
  tactical: ['map-outline',         'map'],
  social:   ['people-outline',      'people'],
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
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index"    options={{ title: 'Home' }} />
        <Tabs.Screen name="tactical" options={{ title: 'Mapa' }} />
        <Tabs.Screen name="social"   options={{ title: 'Social' }} />
        <Tabs.Screen name="news"     options={{ title: 'Noticias' }} />
        <Tabs.Screen name="more"     options={{ title: 'Más' }} />

        <Tabs.Screen name="chat"       options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="intel"      options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="documents"  options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="sec"        options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="markets"    options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="polymarket" options={{ tabBarButton: () => null }} />
        <Tabs.Screen name="sentinel"   options={{ tabBarButton: () => null }} />
      </Tabs>
      <FloatingChatButton />
    </View>
  )
}
