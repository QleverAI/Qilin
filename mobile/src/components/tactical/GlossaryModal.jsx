import { View, Text, ScrollView, Pressable, Modal, StyleSheet, SafeAreaView } from 'react-native'
import { useLang } from '../../hooks/useLanguage'
import { AIRCRAFT_COLORS, VESSEL_COLORS } from './MarkerShapes'
import { C } from '../../theme'

const AIRCRAFT_LEGEND = [
  { type: 'civil',        desc: 'Commercial and private fixed-wing aircraft tracked in monitored zones.' },
  { type: 'military',     desc: 'Military aircraft not matched to a specific sub-type.' },
  { type: 'vip',          desc: 'Executive jets and government / head-of-state transport.' },
  { type: 'fighter',      desc: 'High-performance jet fighters identified by ICAO type code.' },
  { type: 'helicopter',   desc: 'Rotary-wing military aircraft.' },
  { type: 'transport',    desc: 'Strategic airlift and aerial refueling tanker aircraft.' },
  { type: 'surveillance', desc: 'ISR and airborne early warning platforms.' },
]

const VESSEL_LEGEND = [
  { cat: 'military', desc: 'Military naval vessels transmitting an AIS signal.' },
  { cat: 'tanker',   desc: 'Vessels carrying oil, LNG, or chemicals.' },
  { cat: 'cargo',    desc: 'Container ships and bulk carriers.' },
]

const TYPE_LABEL = {
  civil: 'Civil', military: 'Military', vip: 'VIP',
  fighter: 'Fighter', helicopter: 'Helo', transport: 'Transport', surveillance: 'ISR',
}
const CAT_LABEL = { military: 'Naval', tanker: 'Tanker', cargo: 'Cargo' }

function LegendRow({ label, color, desc }) {
  return (
    <View style={gm.legendRow}>
      <View style={[gm.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={gm.legendLabel}>{label}</Text>
        <Text style={gm.legendDesc}>{desc}</Text>
      </View>
    </View>
  )
}

function GuideItem({ title, body }) {
  return (
    <View style={gm.guideItem}>
      <Text style={gm.guideTitle}>{title}</Text>
      <Text style={gm.guideBody}>{body}</Text>
    </View>
  )
}

export function GlossaryModal({ visible, onClose }) {
  const { t } = useLang()

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={gm.safe}>
        <View style={gm.header}>
          <Text style={gm.title}>{t('tactical.glossary_title')}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={gm.closeBtn}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={gm.scroll}>
          <Text style={gm.section}>{t('tactical.legend_aircraft')}</Text>
          {AIRCRAFT_LEGEND.map(item => (
            <LegendRow
              key={item.type}
              color={AIRCRAFT_COLORS[item.type]}
              label={TYPE_LABEL[item.type]}
              desc={item.desc}
            />
          ))}

          <Text style={[gm.section, { marginTop: 24 }]}>{t('tactical.legend_vessels')}</Text>
          {VESSEL_LEGEND.map(item => (
            <LegendRow
              key={item.cat}
              color={VESSEL_COLORS[item.cat]}
              label={CAT_LABEL[item.cat]}
              desc={item.desc}
            />
          ))}

          <Text style={[gm.section, { marginTop: 24 }]}>{t('tactical.guide_title')}</Text>
          <GuideItem title={t('tactical.guide_filters')}       body={t('tactical.guide_filters_body')} />
          <GuideItem title={t('tactical.guide_trails')}        body={t('tactical.guide_trails_body')} />
          <GuideItem title={t('tactical.guide_vessel_trail')}  body={t('tactical.guide_vessel_trail_body')} />
          <GuideItem title={t('tactical.guide_ais_dark')}      body={t('tactical.guide_ais_dark_body')} />
          <GuideItem title={t('tactical.guide_detail')}        body={t('tactical.guide_detail_body')} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const gm = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg0 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
                 paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
                 borderBottomColor: 'rgba(255,255,255,0.08)' },
  title:       { flex: 1, fontSize: 20, fontWeight: '700', color: '#ffffff' },
  closeBtn:    { fontSize: 16, color: 'rgba(235,235,245,0.4)', paddingLeft: 8 },
  scroll:      { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16, gap: 8 },
  section:     { fontSize: 13, fontWeight: '700', color: 'rgba(235,235,245,0.4)',
                 letterSpacing: 0.5, marginBottom: 4 },
  legendRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                 backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12 },
  dot:         { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  legendLabel: { fontSize: 14, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  legendDesc:  { fontSize: 12, color: 'rgba(235,235,245,0.5)', lineHeight: 17 },
  guideItem:   { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 14, gap: 4 },
  guideTitle:  { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  guideBody:   { fontSize: 13, color: 'rgba(235,235,245,0.55)', lineHeight: 19 },
})
