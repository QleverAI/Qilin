import { useEffect, useRef, useMemo } from 'react'
import { View, Animated, PanResponder, StyleSheet, Dimensions, Pressable } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { height: SCREEN_H } = Dimensions.get('window')
const SHEET_H           = Math.round(SCREEN_H * 0.58)
const DISMISS_THRESHOLD = 60

export function DetailSheet({ visible, onDismiss, children }) {
  const insets = useSafeAreaInsets()
  const slideY = useRef(new Animated.Value(SHEET_H)).current

  useEffect(() => {
    Animated.spring(slideY, {
      toValue:         visible ? 0 : SHEET_H,
      tension:         65,
      friction:        11,
      useNativeDriver: true,
    }).start()
  }, [visible, slideY])

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (_, g) => g.dy > 0,
    onMoveShouldSetPanResponder:  (_, g) => g.dy > 4,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) slideY.setValue(g.dy)
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_THRESHOLD) {
        onDismiss()
      } else {
        Animated.spring(slideY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start()
      }
    },
  }), [onDismiss, slideY])

  if (!visible) return null

  return (
    <>
      <Pressable style={ds.backdrop} onPress={onDismiss} />
      <Animated.View
        style={[ds.sheet, { height: SHEET_H, transform: [{ translateY: slideY }] }]}
        {...panResponder.panHandlers}
      >
        <BlurView intensity={90} tint="dark" style={[ds.blur, { paddingBottom: insets.bottom + 8 }]}>
          <View style={ds.handle} />
          {children}
        </BlurView>
      </Animated.View>
    </>
  )
}

const ds = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 19 },
  sheet:    { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
              borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  blur:     { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle:   { width: 36, height: 4, borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.25)',
              alignSelf: 'center', marginTop: 10, marginBottom: 6 },
})
