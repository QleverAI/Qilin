import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useLang } from '../hooks/useLanguage'
import { C } from '../theme'

const TYPE_ORDER = ['sector', 'commodity', 'company', 'zone']
const TYPE_LABELS = {
  sector:    { es: 'Sectores',        en: 'Sectors'     },
  commodity: { es: 'Materias primas', en: 'Commodities' },
  company:   { es: 'Empresas',        en: 'Companies'   },
  zone:      { es: 'Zonas',           en: 'Zones'       },
}

export default function TopicSelector({ selected = [], limit, onChange, catalog = [] }) {
  const { lang, t } = useLang()

  const grouped = useMemo(() => {
    const groups = {}
    for (const topic of catalog) {
      const type = topic.type || 'sector'
      if (!groups[type]) groups[type] = []
      groups[type].push(topic)
    }
    return groups
  }, [catalog])

  function toggle(id) {
    if (selected.includes(id)) {
      Haptics.selectionAsync()
      onChange(selected.filter(s => s !== id))
    } else {
      if (limit != null && selected.length >= limit) return
      Haptics.selectionAsync()
      onChange([...selected, id])
    }
  }

  const atLimit = limit != null && selected.length >= limit

  return (
    <View style={s.root}>
      {TYPE_ORDER.filter(type => grouped[type]?.length).map(type => (
        <View key={type} style={s.group}>
          <Text style={s.groupLabel}>
            {TYPE_LABELS[type][lang] || type}
          </Text>
          <View style={s.chips}>
            {grouped[type].map(topic => {
              const isSelected = selected.includes(topic.id)
              const isDisabled = atLimit && !isSelected
              const label = lang === 'en' ? topic.label_en : topic.label_es
              return (
                <Pressable
                  key={topic.id}
                  onPress={() => toggle(topic.id)}
                  disabled={isDisabled}
                  style={[s.chip, isSelected && s.chipSelected, isDisabled && s.chipDisabled]}
                >
                  {isSelected ? (
                    <Text style={s.chipCheck}>✓ </Text>
                  ) : null}
                  <Text style={[s.chipText, isSelected && s.chipTextSelected, isDisabled && s.chipTextDisabled]}>
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
      {limit != null && (
        <Text style={[s.counter, atLimit && s.counterLimit]}>
          {t('topics.counter', { n: selected.length, max: limit })}
        </Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:             { gap: 16 },
  group:            { gap: 8 },
  groupLabel:       { fontSize: 11, fontWeight: '700', color: C.txt3, letterSpacing: 0.5,
                      textTransform: 'uppercase', fontFamily: 'SpaceMono' },
  chips:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:             { flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                      borderWidth: 1, borderColor: C.borderMd, backgroundColor: C.bg2 },
  chipSelected:     { borderColor: C.cyan, backgroundColor: 'rgba(100,210,255,0.15)' },
  chipDisabled:     { opacity: 0.35 },
  chipCheck:        { fontSize: 12, color: C.cyan },
  chipText:         { fontSize: 13, color: C.txt2 },
  chipTextSelected: { color: C.cyan },
  chipTextDisabled: { color: C.txt3 },
  counter:          { fontSize: 12, color: C.txt3, fontFamily: 'SpaceMono' },
  counterLimit:     { color: C.amber },
})
