import { useState, useMemo, useEffect, useRef } from 'react'
import { useNewsFeed } from '../hooks/useNewsFeed'
import { useSourceFavorites } from '../hooks/useSourceFavorites'
import { SEV_COLOR, SEV_BG, SEV_BORDER } from '../lib/severity'
import FilterGroup from '../components/FilterGroup'
import { LoadingCards } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'

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

const SEV_ORDER  = { high: 3, medium: 2, low: 1 }
const PAGE_SIZE  = 100

function domainOf(url) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

function faviconUrl(url) {
  const domain = domainOf(url)
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null
}

function SectorTag({ sector, large }) {
  const color = SECTOR_COLOR[sector] || 'rgba(150,150,150,0.8)'
  const label = SECTOR_LABELS[sector] || sector
  return (
    <span style={{
      fontSize: large ? '12px' : '10px',
      fontFamily: 'var(--mono)',
      color: 'var(--bg-0)',
      background: color,
      padding: large ? '3px 8px' : '1px 5px',
      borderRadius: '2px',
    }}>
      {label}
    </span>
  )
}

function RelevanceBar({ value }) {
  const color = value >= 70 ? 'var(--red)' : value >= 50 ? 'var(--amber)' : 'var(--green)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width .3s' }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color, flexShrink: 0, minWidth: '24px' }}>{value}</span>
    </div>
  )
}

// ── Paginación ─────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '16px', padding: '16px 0 8px',
      fontFamily: 'var(--mono)',
    }}>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: '2px', color: page === 1 ? 'var(--txt-3)' : 'var(--txt-2)',
          fontFamily: 'var(--mono)', fontSize: '11px',
          padding: '5px 14px', cursor: page === 1 ? 'default' : 'pointer',
          opacity: page === 1 ? 0.4 : 1,
        }}
      >← Anterior</button>
      <span style={{ fontSize: '11px', color: 'var(--txt-2)', fontFamily: 'var(--mono)' }}>
        Página {page} de {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: '2px', color: page === totalPages ? 'var(--txt-3)' : 'var(--txt-2)',
          fontFamily: 'var(--mono)', fontSize: '11px',
          padding: '5px 14px', cursor: page === totalPages ? 'default' : 'pointer',
          opacity: page === totalPages ? 0.4 : 1,
        }}
      >Siguiente →</button>
    </div>
  )
}

// ── Filtro colapsable ───────────────────────────────────────────────────────────

function CollapsibleFilter({ label, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '5px',
          background: 'none', border: 'none', padding: '4px 0',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', lineHeight: 1, flexShrink: 0 }}>
          {open ? '▼' : '▶'}
        </span>
        <span style={{
          fontSize: 'var(--label-xs)', fontWeight: '700', letterSpacing: '.2em',
          color: 'var(--txt-2)', textTransform: 'uppercase', fontFamily: 'var(--mono)',
        }}>
          {label}
        </span>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function NewsModal({ article, onClose }) {
  const severity = article.severity || 'low'
  const sectors  = Array.isArray(article.sectors) ? article.sectors : (article.keywords || [])
  const favicon  = article.url ? faviconUrl(article.url) : null
  const domain   = article.url ? domainOf(article.url) : ''
  const pubDate  = article.time ? new Date(article.time).toLocaleString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : ''

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '640px',
          background: 'var(--bg-1)',
          border: `1px solid ${SEV_BORDER[severity]}`,
          borderTop: `4px solid ${SEV_COLOR[severity]}`,
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: '85vh',
        }}
      >
        {article.image_url && (
          <div style={{ width: '100%', height: '200px', overflow: 'hidden', flexShrink: 0 }}>
            <img
              src={article.image_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
            />
          </div>
        )}

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            {favicon && (
              <img src={favicon} alt="" width={20} height={20} style={{ borderRadius: '3px', flexShrink: 0 }}
                onError={e => { e.currentTarget.style.display = 'none' }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--txt-1)', fontFamily: 'var(--mono)' }}>
                {article.source}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
                {domain} · {pubDate}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--txt-3)',
                cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 6px',
                flexShrink: 0,
              }}
            >×</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <span style={{
              fontSize: '9px', fontWeight: '700', letterSpacing: '.12em',
              padding: '3px 8px', borderRadius: '2px',
              background: SEV_BG[severity], color: SEV_COLOR[severity],
              border: `1px solid ${SEV_BORDER[severity]}`,
              fontFamily: 'var(--mono)',
            }}>{severity.toUpperCase()}</span>

            {article.source_country && (
              <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--accent)', letterSpacing: '.06em' }}>
                [{article.source_country}]
              </span>
            )}

            {article.source_type && (
              <span style={{ fontSize: '9px', fontFamily: 'var(--mono)', color: 'var(--txt-3)', background: 'var(--bg-3)', padding: '2px 7px', borderRadius: '2px', border: '1px solid var(--border)' }}>
                {TYPE_LABELS[article.source_type] || article.source_type}
              </span>
            )}
          </div>

          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--txt-1)', lineHeight: 1.4, marginBottom: '14px' }}>
            {article.title}
          </div>

          {article.summary && (
            <div style={{ fontSize: '12px', color: 'var(--txt-2)', lineHeight: 1.7, marginBottom: '16px' }}>
              {article.summary}
            </div>
          )}

          {sectors.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {sectors.map(s => <SectorTag key={s} sector={s} large />)}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '8px', fontFamily: 'var(--mono)', color: 'var(--txt-3)', letterSpacing: '.15em', marginBottom: '6px' }}>
              RELEVANCIA GEOPOLÍTICA
            </div>
            <RelevanceBar value={article.relevance || 50} />
          </div>

          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '8px 20px',
                background: 'var(--accent-dim)',
                border: '1px solid rgba(79,156,249,0.3)',
                borderRadius: '2px',
                color: 'var(--accent)',
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '.1em',
                textDecoration: 'none',
                transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,156,249,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-dim)'}
            >
              LEER ARTÍCULO COMPLETO ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta ────────────────────────────────────────────────────────────────────

function NewsCard({ article, onClick, isFav, onToggleFav }) {
  const severity = article.severity || 'low'
  const sectors  = Array.isArray(article.sectors) ? article.sectors : (article.keywords || [])
  const favicon  = article.url ? faviconUrl(article.url) : null

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderTop: `3px solid ${SEV_COLOR[severity]}`,
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'border-color .15s, background .15s',
        overflow: 'hidden',
        minHeight: '150px',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-md)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {article.image_url && (
        <div style={{ width: '100%', height: '160px', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={article.image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
          />
        </div>
      )}

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '7px' }}>
          {favicon && (
            <img src={favicon} alt="" width={14} height={14} style={{ borderRadius: '2px', flexShrink: 0 }}
              onError={e => { e.currentTarget.style.display = 'none' }} />
          )}
          <span style={{ fontSize: 'var(--label-md)', fontFamily: 'var(--mono)', color: 'var(--txt-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {article.source}
          </span>
          {article.source_country && (
            <span style={{ fontSize: 'var(--label-md)', fontFamily: 'var(--mono)', color: 'var(--accent)', flexShrink: 0 }}>
              {article.source_country}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onToggleFav && onToggleFav() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: isFav ? '#ffd60a' : 'var(--txt-3)',
              fontSize: 13, lineHeight: 1, padding: '2px 4px',
              flexShrink: 0, transition: 'color .15s',
            }}
            title={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          >★</button>
        </div>

        <div style={{
          fontSize: 'var(--body-sm)', fontWeight: '600', color: 'var(--txt-1)', lineHeight: 1.4,
          flex: 1, marginBottom: '8px',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>
          {article.title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {sectors.slice(0, 2).map(s => <SectorTag key={s} sector={s} />)}
          <span style={{
            marginLeft: 'auto', fontSize: 'var(--label-sm)', fontWeight: '700',
            padding: '2px 6px', borderRadius: '2px',
            background: SEV_BG[severity], color: SEV_COLOR[severity],
            border: `1px solid ${SEV_BORDER[severity]}`,
            fontFamily: 'var(--mono)', flexShrink: 0,
          }}>{severity.toUpperCase()}</span>
        </div>
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const { articles, countries, sourceTypes, zones, sectors, loading, lastUpdate } = useNewsFeed()
  const { isFavorite, toggleFavorite, canAddMore } = useSourceFavorites()

  const [sevFilter,    setSevFilter]    = useState('TODOS')
  const [sectorFilter, setSectorFilter] = useState('TODOS')
  const [zoneFilter,   setZoneFilter]   = useState('TODOS')
  const [countryFilter,setCountryFilter]= useState('TODOS')
  const [typeFilter,   setTypeFilter]   = useState('TODOS')
  const [modalArticle, setModalArticle] = useState(null)
  const [search,       setSearch]       = useState('')
  const [sortBy,       setSortBy]       = useState('newest')
  const [page,         setPage]         = useState(1)

  const scrollRef = useRef(null)

  // Reset to page 1 whenever filters or sort change
  useEffect(() => { setPage(1) }, [sevFilter, sectorFilter, zoneFilter, countryFilter, typeFilter, search, sortBy])

  // Scroll to top on page change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [page])

  const filtered = useMemo(() => {
    const list = articles.filter(a => {
      const articleSectors = Array.isArray(a.sectors) ? a.sectors : (a.keywords || [])
      const articleZones   = Array.isArray(a.zones) ? a.zones : []
      if (sevFilter    !== 'TODOS' && a.severity       !== sevFilter)           return false
      if (sectorFilter !== 'TODOS' && !articleSectors.includes(sectorFilter))   return false
      if (zoneFilter   !== 'TODOS' && !articleZones.includes(zoneFilter))       return false
      if (countryFilter!== 'TODOS' && a.source_country !== countryFilter)       return false
      if (typeFilter   !== 'TODOS' && a.source_type    !== typeFilter)          return false
      if (search && !a.title?.toLowerCase().includes(search.toLowerCase()))     return false
      return true
    })
    if (sortBy === 'oldest')   return [...list].sort((a, b) => new Date(a.time) - new Date(b.time))
    if (sortBy === 'sev_high') return [...list].sort((a, b) => (SEV_ORDER[b.severity] || 0) - (SEV_ORDER[a.severity] || 0))
    if (sortBy === 'sev_low')  return [...list].sort((a, b) => (SEV_ORDER[a.severity] || 0) - (SEV_ORDER[b.severity] || 0))
    return [...list].sort((a, b) => new Date(b.time) - new Date(a.time))
  }, [articles, sevFilter, sectorFilter, zoneFilter, countryFilter, typeFilter, search, sortBy])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd   = Math.min(page * PAGE_SIZE, filtered.length)

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {modalArticle && (
        <NewsModal article={modalArticle} onClose={() => setModalArticle(null)} />
      )}

      {/* Sidebar filtros */}
      <aside style={{
        width: '180px', flexShrink: 0,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border-md)',
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', gap: '14px',
        overflowY: 'auto',
      }}>
        <div>
          <div style={{ fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-2)', textTransform: 'uppercase', marginBottom: '6px' }}>
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
              fontFamily: 'var(--mono)', fontSize: 'var(--label-md)',
              padding: '5px 7px', outline: 'none',
            }}
          />
        </div>

        <CollapsibleFilter label="SEVERIDAD" defaultOpen={true}>
          <FilterGroup label="SEVERIDAD" options={['high', 'medium', 'low']} value={sevFilter} onChange={setSevFilter} hideLabel />
        </CollapsibleFilter>
        <CollapsibleFilter label="SECTOR">
          <FilterGroup label="SECTOR" options={sectors} value={sectorFilter} onChange={setSectorFilter} labelFn={s => SECTOR_LABELS[s] || s} hideLabel />
        </CollapsibleFilter>
        <CollapsibleFilter label="ZONA">
          <FilterGroup label="ZONA" options={zones} value={zoneFilter} onChange={setZoneFilter} hideLabel />
        </CollapsibleFilter>
        <CollapsibleFilter label="PAÍS">
          <FilterGroup label="PAÍS" options={countries} value={countryFilter} onChange={setCountryFilter} hideLabel />
        </CollapsibleFilter>
        <CollapsibleFilter label="TIPO">
          <FilterGroup label="TIPO" options={sourceTypes} value={typeFilter} onChange={setTypeFilter} labelFn={t => TYPE_LABELS[t] || t} hideLabel />
        </CollapsibleFilter>
      </aside>

      {/* Feed principal */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '10px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
          background: 'var(--bg-1)',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-2)', textTransform: 'uppercase' }}>
            NEWS INTELLIGENCE · RSS
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-md)', color: 'var(--txt-3)', marginLeft: 'auto' }}>
            {loading
              ? 'Cargando…'
              : filtered.length > 0
                ? `${rangeStart}–${rangeEnd} de ${filtered.length} · ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`
                : `0 artículos · ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`
            }
          </span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: '2px',
              color: 'var(--txt-2)',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--label-sm)',
              padding: '4px 8px',
              outline: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <option value="newest">Más reciente primero</option>
            <option value="oldest">Más antiguo primero</option>
            <option value="sev_high">Severidad: Alta → Baja</option>
            <option value="sev_low">Severidad: Baja → Alta</option>
          </select>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading && <LoadingCards count={12} />}
          {!loading && filtered.length === 0 && (
            <EmptyState
              title={articles.length === 0 ? 'SIN NOTICIAS' : 'SIN RESULTADOS'}
              subtitle={articles.length === 0 ? 'INGESTOR INACTIVO O SIN DATOS' : 'AJUSTA LOS FILTROS ACTIVOS'}
              icon="◈"
            />
          )}
          {!loading && filtered.length > 0 && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '10px',
              }}>
                {paginated.map(article => (
                  <NewsCard
                    key={article.id || article.url}
                    article={article}
                    onClick={() => setModalArticle(article)}
                    isFav={isFavorite('news', article.source)}
                    onToggleFav={() => {
                      if (!isFavorite('news', article.source) && !canAddMore('news')) return
                      toggleFavorite('news', article.source, article.source)
                    }}
                  />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
