// Canonical severity constants — import from here, never redefine locally
export const SEV_COLOR = {
  high:   'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low:    'var(--sev-low)',
}

export const SEV_BG = {
  high:   'var(--sev-high-bg)',
  medium: 'var(--sev-medium-bg)',
  low:    'var(--sev-low-bg)',
}

export const SEV_BORDER = {
  high:   'var(--sev-high-border)',
  medium: 'var(--sev-medium-border)',
  low:    'var(--sev-low-border)',
}

export function sevBadgeStyle(severity) {
  const s = severity || 'low'
  return {
    fontSize: '8px',
    fontWeight: '700',
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    padding: '2px 6px',
    borderRadius: '2px',
    fontFamily: 'var(--mono)',
    flexShrink: 0,
    color:       SEV_COLOR[s],
    background:  SEV_BG[s],
    border:      `1px solid ${SEV_BORDER[s]}`,
  }
}
