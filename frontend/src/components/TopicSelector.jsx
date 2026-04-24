import { useMemo } from 'react'
import { useLang } from '../hooks/useLanguage'

const TYPE_ORDER = ['sector', 'commodity', 'company', 'zone']
const TYPE_LABELS = {
  sector:    { es: 'Sectores',         en: 'Sectors'    },
  commodity: { es: 'Materias primas',  en: 'Commodities' },
  company:   { es: 'Empresas',         en: 'Companies'  },
  zone:      { es: 'Zonas',            en: 'Zones'      },
}

export default function TopicSelector({ selected = [], limit, onChange, catalog = [] }) {
  const { lang } = useLang()

  const grouped = useMemo(() => {
    const groups = {}
    for (const t of catalog) {
      const type = t.type || 'sector'
      if (!groups[type]) groups[type] = []
      groups[type].push(t)
    }
    return groups
  }, [catalog])

  function toggle(id) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      if (limit != null && selected.length >= limit) return
      onChange([...selected, id])
    }
  }

  const atLimit = limit != null && selected.length >= limit

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {TYPE_ORDER.filter(type => grouped[type]?.length).map(type => (
        <div key={type}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
            fontWeight: '700', letterSpacing: '.14em',
            color: 'var(--txt-3)', textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            {TYPE_LABELS[type][lang] || type}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {grouped[type].map(topic => {
              const isSelected = selected.includes(topic.id)
              const isDisabled = atLimit && !isSelected
              const label = lang === 'en' ? topic.label_en : topic.label_es
              return (
                <button
                  key={topic.id}
                  onClick={() => toggle(topic.id)}
                  disabled={isDisabled}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '3px',
                    border: isSelected
                      ? '1px solid var(--cyan)'
                      : '1px solid var(--border-md)',
                    background: isSelected
                      ? 'rgba(0,200,255,0.15)'
                      : 'transparent',
                    color: isSelected ? 'var(--cyan)'
                          : isDisabled ? 'var(--txt-3)'
                          : 'var(--txt-2)',
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--label-sm)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.45 : 1,
                    transition: 'all .12s',
                    letterSpacing: '.06em',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected && !isDisabled)
                      e.currentTarget.style.color = 'var(--txt-1)'
                  }}
                  onMouseLeave={e => {
                    if (!isSelected && !isDisabled)
                      e.currentTarget.style.color = 'var(--txt-2)'
                  }}
                >
                  {isSelected && <span style={{ marginRight: '4px' }}>✓</span>}
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {limit != null && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
          color: atLimit ? 'var(--amber)' : 'var(--txt-3)',
          letterSpacing: '.06em',
        }}>
          {selected.length} / {limit === null ? '∞' : limit} topics selected
        </div>
      )}
    </div>
  )
}
