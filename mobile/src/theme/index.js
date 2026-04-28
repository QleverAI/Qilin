export const C = {
  bg0:  '#08090d',
  bg1:  '#111318',
  bg2:  '#1a1d24',
  bg3:  '#22262f',
  separator: 'rgba(255,255,255,0.05)',
  txt1: '#ffffff',
  txt2: 'rgba(235,235,245,0.6)',
  txt3: 'rgba(235,235,245,0.3)',

  // Brand
  gold:       '#c8a03c',
  goldFill:   'rgba(200,160,60,0.08)',
  goldBorder: 'rgba(200,160,60,0.20)',

  // Tactical
  teal:       '#64d2ff',
  tealFill:   'rgba(100,210,255,0.07)',
  tealBorder: 'rgba(100,210,255,0.18)',

  // Semantic (mantener compatibilidad)
  blue:      '#0a84ff',
  green:     '#30d158',
  red:       '#ff453a',
  amber:     '#ffd60a',
  cyan:      '#64d2ff',
  indigo:    '#5e5ce6',
  blueFill:  'rgba(10,132,255,0.15)',
  greenFill: 'rgba(48,209,88,0.15)',
  redFill:   'rgba(255,69,58,0.10)',
  amberFill: 'rgba(255,214,10,0.10)',
  border:    'rgba(255,255,255,0.06)',
  borderMd:  'rgba(255,255,255,0.12)',
}

export const SEV_COLOR  = { high: C.red,     medium: C.amber,    low: C.green }
export const SEV_FILL   = { high: 'rgba(255,69,58,0.08)',  medium: 'rgba(255,214,10,0.08)',  low: 'rgba(48,209,88,0.08)' }
export const SEV_BORDER = { high: 'rgba(255,69,58,0.30)',  medium: 'rgba(255,214,10,0.30)',  low: 'rgba(48,209,88,0.30)' }
export const SEV_LABEL  = { high: 'ALTO',    medium: 'MEDIO',    low: 'BAJO' }

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
