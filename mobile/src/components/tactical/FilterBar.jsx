import { useRef, useCallback } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useLang } from '../../hooks/useLanguage'
import { AIRCRAFT_COLORS, VESSEL_COLORS } from './MarkerShapes'

const AIRCRAFT_FILTERS = [
  { key: 'civil',        labelKey: 'filter_civil',        color: AIRCRAFT_COLORS.civil,        icon: '✈' },
  { key: 'military',     labelKey: 'filter_military',     color: AIRCRAFT_COLORS.military,     icon: '✈' },
  { key: 'vip',          labelKey: 'filter_vip',          color: AIRCRAFT_COLORS.vip,          icon: '✈' },
  { key: 'fighter',      labelKey: 'filter_fighter',      color: AIRCRAFT_COLORS.fighter,      icon: '△' },
  { key: 'helicopter',   labelKey: 'filter_helicopter',   color: AIRCRAFT_COLORS.helicopter,   icon: '⊙' },
  { key: 'transport',    labelKey: 'filter_transport',    color: AIRCRAFT_COLORS.transport,    icon: '▬' },
  { key: 'surveillance', labelKey: 'filter_surveillance', color: AIRCRAFT_COLORS.surveillance, icon: '◎' },
]

const VESSEL_FILTERS = [
  { key: 'vessel-military', labelKey: 'filter_vessel_mil', color: VESSEL_COLORS.military, icon: '◆' },
  { key: 'tanker',          labelKey: 'filter_tanker',     color: VESSEL_COLORS.tanker,   icon: '▮' },
  { key: 'cargo',           labelKey: 'filter_cargo',      color: VESSEL_COLORS.cargo,    icon: '▰' },
]

function FilterPill({ filter, hidden, onToggle, t }) {
  const anim   = useRef(new Animated.Value(1)).current
  const active = !hidden.has(filter.key)

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    Animated.sequence([
      Animated.spring(anim, { toValue: 0.88, useNativeDriver: true, tension: 200, friction: 10 }),
      Animated.spring(anim, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 10 }),
    ]).start()
    onToggle(filter.key)
  }, [anim, filter.key, onToggle])

  return (
    <Animated.View style={{ transform: [{ scale: anim }] }}>
      <Pressable
        onPress={handlePress}
        style={[
          fp.pill,
          active
            ? { backgroundColor: filter.color + '28', borderColor: filter.color + '88' }
            : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' },
        ]}
      >
        <Text style={[fp.icon, { color: active ? filter.color : 'rgba(255,255,255,0.25)' }]}>
          {filter.icon}
        </Text>
        <Text style={[fp.label, { color: active ? filter.color : 'rgba(255,255,255,0.25)' }]}>
          {t(`tactical.${filter.labelKey}`)}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

export function FilterBar({ hidden, onToggle }) {
  const { t }  = useLang()
  const insets = useSafeAreaInsets()

  return (
    <View style={[fb.wrapper, { top: insets.top + 8 }]}>
      <BlurView intensity={70} tint="dark" style={fb.blur}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={fb.row}
        >
          {AIRCRAFT_FILTERS.map(f => (
            <FilterPill key={f.key} filter={f} hidden={hidden} onToggle={onToggle} t={t} />
          ))}
          <View style={fb.divider} />
          {VESSEL_FILTERS.map(f => (
            <FilterPill key={f.key} filter={f} hidden={hidden} onToggle={onToggle} t={t} />
          ))}
        </ScrollView>
      </BlurView>
    </View>
  )
}

const fp = StyleSheet.create({
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10,
           paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  icon:  { fontSize: 11 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
})

const fb = StyleSheet.create({
  wrapper: { position: 'absolute', left: 12, right: 12, zIndex: 10 },
  blur:    { borderRadius: 12, overflow: 'hidden' },
  row:     { flexDirection: 'row', alignItems: 'center',
             paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  divider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
})
