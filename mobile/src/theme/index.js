// Qilin design tokens — mirrors CSS variables in the web app
export const C = {
  bg0:      '#070b0f',
  bg1:      '#0c1117',
  bg2:      '#111820',
  bg3:      '#162030',
  cyan:     '#00c8ff',
  green:    '#00e5a0',
  amber:    '#ffb020',
  red:      '#ff3b4a',
  txt1:     '#e2e8f0',
  txt2:     '#8899aa',
  txt3:     '#4a5568',
  border:   'rgba(255,255,255,0.07)',
  borderMd: 'rgba(255,255,255,0.12)',
}

export const FONT = {
  mono:  'SpaceMono',   // loaded via expo-font
  sans:  'System',
}

export const SEV_COLOR = {
  high:   C.red,
  medium: C.amber,
  low:    C.green,
}

export const SEV_LABEL = {
  high:   'ALTO',
  medium: 'MEDIO',
  low:    'BAJO',
}
