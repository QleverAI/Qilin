import { useState, useMemo } from 'react'
import { useNewsFeed } from '../hooks/useNewsFeed'

const SEV_COLOR  = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' }
const SEV_BG     = { high: 'rgba(255,59,74,0.10)', medium: 'rgba(255,176,32,0.09)', low: 'rgba(0,229,160,0.08)' }
const SEV_BORDER = { high: 'rgba(255,59,74,0.28)', medium: 'rgba(255,176,32,0.26)', low: 'rgba(0,229,160,0.2)' }

const TYPE_LABELS = {
  agency:       'Agencia',
  newspaper:    'Periódico',
  magazine:     'Revista',
  think_tank:   'Think Tank',
  government:   'Oficial',
  defense_media:'Defensa',
}

const SECTOR_LABELS = {
  militar:           'Militar',
  diplomacia:        'Diplomacia',
  economia:          'Economía',
  energia:           'Energía',
  ciberseguridad:    'Ciber',
  crisis_humanitaria:'Humanitario',
  nuclear:           'Nuclear',
}

const SECTOR_COLOR = {
  militar:           'rgba(255,59,74,0.8)',
  diplomacia:        'rgba(0,200,255,0.8)',
  economia:          'rgba(255,176,32,0.8)',
  energia:           'rgba(255,140,0,0.8)',
  ciberseguridad:    'rgba(130,80,255,0.8)',
  crisis_humanitaria:'rgba(0,229,160,0.8)',
  nuclear:           'rgba(255,59,74,1)',
}

function RelevanceBar({ value }) {
  const color = value >= 70 ? 'var(--red)' : value >= 50 ? 'var(--amber)' : 'var(--green)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '2px', background: 'var(--border)', borderRadius: '1px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '1px', transition: 'width .3s' }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color, flexShrink: 0 }}>{value}</span>
    </div>
  )
}

function SectorTag({ sector }) {
  const color = SECTOR_COLOR[sector] || 'rgba(150,150,150,0.8)'
  const label = SECTOR_LABELS[sector] || sector
  return (
    <span style={{
      fontSize: '8px', fontFamily: 'var(--mono)',
      color: 'var(--bg-0)', background: color,
      padding: '1px 5px', borderRadius: '2px',
    }}>
      {label}
    </span>
  )
}

function NewsCard({ article, selected, onClick }) {
  const severity = article.severity || 'low'
  const sectors = Array.isArray(article.sectors)
    ? article.sectors
    : (article.keywords || [])

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        background: selected ? 'var(--bg-3)' : 'var(--bg-2)',
        border: `1px solid ${selected ? 'rgba(0,200,255,0.35)' : 'var(--border)'}`,
        borderLeft: `3px solid ${SEV_COLOR[severity]}`,
        borderRadius: '2px',
        cursor: 'pointer',
        transition: 'all .15s',
        marginBottom: '6px',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(0,200,255,0.2)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '8px', fontWeight: '700', letterSpacing: '.12em',
          padding: '2px 6px', borderRadius: '2px',
          background: SEV_BG[severity],
          color: SEV_COLOR[severity],
          border: `1px solid ${SEV_BORDER[severity]}`,
          fontFamily: 'var(--mono)', flexShrink: 0,
        }}>{severity.toUpperCase()}</span>

        <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--cyan)', letterSpacing: '.06em', flexShrink: 0 }}>
          {article.source_country && `[${article.source_country}]`}
        </span>

        <span style={{ fontSize: '8px', fontFamily: 'var(--mono)', color: 'var(--txt-3)', flexShrink: 0 }}>
          {TYPE_LABELS[article.source_type] || article.source_type}
        </span>

        <span style={{ marginLeft: 'auto', fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--txt-3)', flexShrink: 0 }}>
          {article.source}
        </span>
      </div>

      {/* Título */}
      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--txt-1)', lineHeight: 1.35, marginBottom: '6px' }}>
        {article.title}
      </div>

      {/* Resumen (solo si está seleccionado) */}
      {selected && article.summary && (
        <div style={{ fontSize: '11px', color: 'var(--txt-2)', lineHeight: 1.6, marginBottom: '8px' }}>
          {article.summary}
        </div>
      )}

      {/* Footer: sectores + relevancia + enlace */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {sectors.slice(0, 3).map(s => <SectorTag key={s} sector={s} />)}
        <div style={{ marginLeft: 'auto', flex: '0 0 100px' }}>
          <RelevanceBar value={article.relevance || 50} />
        </div>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              fontFamily: 'var(--mono)', fontSize: '9px',
              color: 'var(--cyan)', textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            Leer ↗
          </a>
        )}
      </div>
    </div>
  )
}

function FilterGroup({ label, options, value, onChange, labelFn }) {
  return (
    <div>
      <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
        {label}
      </div>
      {['TODOS', ...options].map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: value === opt ? 'rgba(0,200,255,0.08)' : 'none',
          border: 'none',
          borderLeft: `2px solid ${value === opt ? 'var(--cyan)' : 'transparent'}`,
          color: value === opt ? 'var(--cyan)' : 'var(--txt-3)',
          fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '.06em',
          padding: '4px 8px', cursor: 'pointer', transition: 'all .15s',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}>
          {opt === 'TODOS' ? 'TODOS' : (labelFn ? labelFn(opt) : opt.replace(/_/g, ' '))}
        </button>
      ))}
    </div>
  )
}

export default function NewsPage() {
  const { articles, countries, sourceTypes, zones, sectors, loading, lastUpdate } = useNewsFeed()

  const [sevFilter,    setSevFilter]    = useState('TODOS')
  const [sectorFilter, setSectorFilter] = useState('TODOS')
  const [zoneFilter,   setZoneFilter]   = useState('TODOS')
  const [countryFilter,setCountryFilter]= useState('TODOS')
  const [typeFilter,   setTypeFilter]   = useState('TODOS')
  const [selected,     setSelected]     = useState(null)
  const [search,       setSearch]       = useState('')

  const filtered = useMemo(() => articles.filter(a => {
    const articleSectors = Array.isArray(a.sectors) ? a.sectors : (a.keywords || [])
    const articleZones   = Array.isArray(a.zones) ? a.zones : []

    if (sevFilter    !== 'TODOS' && a.severity        !== sevFilter)           return false
    if (sectorFilter !== 'TODOS' && !articleSectors.includes(sectorFilter))    return false
    if (zoneFilter   !== 'TODOS' && !articleZones.includes(zoneFilter))        return false
    if (countryFilter!== 'TODOS' && a.source_country  !== countryFilter)       return false
    if (typeFilter   !== 'TODOS' && a.source_type      !== typeFilter)         return false
    if (search && !a.title?.toLowerCase().includes(search.toLowerCase()))      return false
    return true
  }), [articles, sevFilter, sectorFilter, zoneFilter, countryFilter, typeFilter, search])

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {/* Sidebar filtros */}
      <aside style={{
        width: '160px', flexShrink: 0,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border-md)',
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', gap: '14px',
        overflowY: 'auto',
      }}>
        {/* Búsqueda */}
        <div>
          <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
            BUSCAR
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="titular…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: '2px', color: 'var(--txt-1)',
              fontFamily: 'var(--mono)', fontSize: '9px',
              padding: '5px 7px', outline: 'none',
            }}
          />
        </div>

        <FilterGroup
          label="SEVERIDAD"
          options={['high', 'medium', 'low']}
          value={sevFilter}
          onChange={setSevFilter}
        />

        <FilterGroup
          label="SECTOR"
          options={sectors}
          value={sectorFilter}
          onChange={setSectorFilter}
          labelFn={s => SECTOR_LABELS[s] || s}
        />

        <FilterGroup
          label="ZONA"
          options={zones}
          value={zoneFilter}
          onChange={setZoneFilter}
        />

        <FilterGroup
          label="PAÍS"
          options={countries}
          value={countryFilter}
          onChange={setCountryFilter}
        />

        <FilterGroup
          label="TIPO"
          options={sourceTypes}
          value={typeFilter}
          onChange={setTypeFilter}
          labelFn={t => TYPE_LABELS[t] || t}
        />
      </aside>

      {/* Feed principal */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Barra de estado */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
          background: 'var(--bg-1)',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>
            NEWS INTELLIGENCE · RSS
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', marginLeft: 'auto' }}>
            {loading
              ? 'Cargando…'
              : `${filtered.length} artículos · ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`
            }
          </span>
        </div>

        {/* Artículos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)' }}>
              Cargando noticias…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)' }}>
              {articles.length === 0
                ? 'Ingestor de noticias no activo o sin artículos aún'
                : 'Sin resultados para los filtros actuales'}
            </div>
          )}
          {!loading && filtered.map(article => (
            <NewsCard
              key={article.id || article.url}
              article={article}
              selected={selected === (article.id || article.url)}
              onClick={() => setSelected(
                selected === (article.id || article.url) ? null : (article.id || article.url)
              )}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
