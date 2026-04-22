export const C = {
  bg0:  '#000000',
  bg1:  '#1c1c1e',
  bg2:  '#2c2c2e',
  bg3:  '#3a3a3c',
  separator: '#38383a',
  txt1: '#ffffff',
  txt2: 'rgba(235,235,245,0.6)',
  txt3: 'rgba(235,235,245,0.3)',
  blue:   '#0a84ff',
  green:  '#30d158',
  red:    '#ff453a',
  amber:  '#ffd60a',
  cyan:   '#64d2ff',
  indigo: '#5e5ce6',
  blueFill:  'rgba(10,132,255,0.15)',
  greenFill: 'rgba(48,209,88,0.15)',
  redFill:   'rgba(255,69,58,0.15)',
  amberFill: 'rgba(255,214,10,0.15)',
  border:   'rgba(255,255,255,0.08)',
  borderMd: 'rgba(255,255,255,0.15)',
}

export const SEV_COLOR = { high: C.red,     medium: C.amber,     low: C.green }
export const SEV_FILL  = { high: C.redFill, medium: C.amberFill, low: C.greenFill }
export const SEV_LABEL = { high: 'Alto',    medium: 'Medio',     low: 'Bajo'  }

export const T = {
  largeTitle: { fontSize: 34, fontWeight: '700', color: '#ffffff', letterSpacing: 0.37 },
  title2:     { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  title3:     { fontSize: 20, fontWeight: '600', color: '#ffffff' },
  headline:   { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  body:       { fontSize: 17, fontWeight: '400', color: '#ffffff' },
  callout:    { fontSize: 16, fontWeight: '400', color: '#ffffff' },
  subhead:    { fontSize: 15, fontWeight: '400', color: '#ffffff' },
  footnote:   { fontSize: 13, fontWeight: '400', color: 'rgba(235,235,245,0.6)' },
  caption1:   { fontSize: 12, fontWeight: '400', color: 'rgba(235,235,245,0.3)' },
  mono:       { fontSize: 13, fontFamily: 'SpaceMono', color: 'rgba(235,235,245,0.6)' },
}
