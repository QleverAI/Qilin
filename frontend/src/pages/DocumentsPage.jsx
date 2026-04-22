import { useState, useMemo, useEffect, useRef } from 'react'
import { useDocsFeed } from '../hooks/useDocsFeed'
import { useSourceFavorites } from '../hooks/useSourceFavorites'
import { SEV_COLOR, SEV_BG, SEV_BORDER } from '../lib/severity'
import FilterGroup from '../components/FilterGroup'
import { LoadingRows } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'

const ORG_LABELS = {
  defense:       'Defensa',
  international: 'Internacional',
  think_tank:    'Think Tank',
  government:    'Gobierno',
  energy:        'Energía',
}

const ORG_ICON = {
  defense:       '[DEF]',
  international: '[INT]',
  think_tank:    '[TT]',
  government:    '[GOV]',
  energy:        '[NRG]',
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
  diplomacia:        'rgba(79,156,249,0.8)',
  economia:          'rgba(255,176,32,0.8)',
  energia:           'rgba(255,140,0,0.8)',
  ciberseguridad:    'rgba(130,80,255,0.8)',
  crisis_humanitaria:'rgba(0,229,160,0.8)',
  nuclear:           'rgba(255,59,74,1)',
}

const PAGE_SIZE = 50

// ── Paginación ─────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '16px', padding: '12px 0 6px',
      fontFamily: 'var(--mono)',
    }}>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: '2px', color: page === 1 ? 'var(--txt-3)' : 'var(--txt-2)',
          fontFamily: 'var(--mono)', fontSize: '10px',
          padding: '4px 10px', cursor: page === 1 ? 'default' : 'pointer',
          opacity: page === 1 ? 0.4 : 1,
        }}
      >← Anterior</button>
      <span style={{ fontSize: '10px', color: 'var(--txt-2)', fontFamily: 'var(--mono)' }}>
        Página {page} de {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: '2px', color: page === totalPages ? 'var(--txt-3)' : 'var(--txt-2)',
          fontFamily: 'var(--mono)', fontSize: '10px',
          padding: '4px 10px', cursor: page === totalPages ? 'default' : 'pointer',
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

function SectorTag({ sector }) {
  const color = SECTOR_COLOR[sector] || 'rgba(150,150,150,0.8)'
  return (
    <span style={{
      fontSize: '8px', fontFamily: 'var(--mono)',
      color: 'var(--bg-0)', background: color,
      padding: '1px 5px', borderRadius: '2px',
    }}>
      {SECTOR_LABELS[sector] || sector}
    </span>
  )
}

function DocRow({ doc, selected, onClick, isFav, onToggleFav }) {
  const severity = doc.severity || 'low'
  const sectors  = Array.isArray(doc.sectors) ? doc.sectors : []
  const pubDate  = doc.time
    ? new Date(doc.time).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '9px 12px',
        background: selected ? 'var(--bg-3)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(79,156,249,0.3)' : 'transparent'}`,
        borderLeft: `3px solid ${SEV_COLOR[severity]}`,
        borderRadius: '2px',
        cursor: 'pointer',
        transition: 'all .12s',
        marginBottom: '2px',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-2)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: '9px', flexShrink: 0, marginTop: '1px', fontFamily: 'var(--mono)', color: 'var(--txt-3)' }}>
        {ORG_ICON[doc.org_type] || '[DOC]'}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'var(--txt-1)', lineHeight: 1.35, marginBottom: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {doc.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: 'var(--txt-3)' }}>
            {doc.source}
          </span>
          {doc.source_country && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: 'var(--accent)' }}>
              [{doc.source_country}]
            </span>
          )}
          {sectors.slice(0, 2).map(s => <SectorTag key={s} sector={s} />)}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: 'var(--txt-3)' }}>{pubDate}</div>
        {doc.page_count && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: 'var(--txt-3)', marginTop: '2px' }}>
            {doc.page_count}p
          </div>
        )}
      </div>
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
  )
}

function DocDetail({ doc }) {
  if (!doc) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <EmptyState title="SELECCIONA UN DOCUMENTO" subtitle="PARA VER EL ANÁLISIS" icon="◧" />
    </div>
  )

  const severity = doc.severity || 'low'
  const sectors  = Array.isArray(doc.sectors) ? doc.sectors : []
  const pubDate  = doc.time ? new Date(doc.time).toLocaleString('es-ES') : '—'
  const discDate = doc.discovered_at ? new Date(doc.discovered_at).toLocaleString('es-ES') : '—'

  return (
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '9px', marginBottom: '6px', fontFamily: 'var(--mono)', color: 'var(--txt-3)' }}>{ORG_ICON[doc.org_type] || '[DOC]'}</div>
        <div style={{ fontSize: '13px', color: 'var(--txt-1)', fontWeight: '600', lineHeight: 1.4, marginBottom: '10px' }}>
          {doc.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '.12em',
            padding: '2px 8px', borderRadius: '2px',
            background: SEV_BG[severity], color: SEV_COLOR[severity],
            border: `1px solid ${SEV_BORDER[severity]}`,
          }}>{severity.toUpperCase()}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', background: 'var(--bg-3)', padding: '2px 7px', borderRadius: '2px', border: '1px solid var(--border)' }}>
            {ORG_LABELS[doc.org_type] || doc.org_type}
          </span>
          {doc.source_country && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--accent)' }}>
              [{doc.source_country}]
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
        {[
          ['Fuente',     doc.source],
          ['Publicado',  pubDate],
          ['Detectado',  discDate],
          ['Tamaño',     doc.file_size_kb ? `${doc.file_size_kb} KB` : '—'],
          ['Páginas',    doc.page_count || '—'],
          ['Estado',     doc.status],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.1em', flexShrink: 0, width: '70px' }}>{k}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-2)' }}>{String(v)}</span>
          </div>
        ))}
      </div>

      {/* Sectores */}
      {sectors.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '8px' }}>
            SECTORES
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {sectors.map(s => <SectorTag key={s} sector={s} />)}
          </div>
        </div>
      )}

      {/* Relevancia */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '8px' }}>
          RELEVANCIA GEOPOLÍTICA
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${doc.relevance || 0}%`, height: '100%', borderRadius: '2px',
              background: (doc.relevance || 0) >= 70 ? 'var(--red)' : (doc.relevance || 0) >= 50 ? 'var(--amber)' : 'var(--green)',
              transition: 'width .3s',
            }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--txt-1)', fontWeight: '600', minWidth: '28px' }}>
            {doc.relevance || 0}
          </span>
        </div>
      </div>

      {/* Resumen */}
      {doc.summary && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '8px' }}>
            EXTRACTO DEL DOCUMENTO
          </div>
          <div style={{ fontSize: '11px', color: 'var(--txt-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {doc.summary}
          </div>
        </div>
      )}

      {/* Enlace */}
      {doc.url && (
        <a
          href={doc.url}
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
          ABRIR PDF ↗
        </a>
      )}
    </div>
  )
}

export default function DocumentsPage() {
  const { docs, orgTypes, countries, sectors, failingSources, loading, lastUpdate } = useDocsFeed()
  const { isFavorite, toggleFavorite, canAddMore } = useSourceFavorites()

  const [sevFilter,  setSevFilter]  = useState('TODOS')
  const [orgFilter,  setOrgFilter]  = useState('TODOS')
  const [secFilter,  setSecFilter]  = useState('TODOS')
  const [cntFilter,  setCntFilter]  = useState('TODOS')
  const [selected,   setSelected]   = useState(null)
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)

  const listRef = useRef(null)

  useEffect(() => { setPage(1) }, [sevFilter, orgFilter, secFilter, cntFilter, search])
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0 }, [page])

  const filtered = useMemo(() => docs.filter(d => {
    const docSectors = Array.isArray(d.sectors) ? d.sectors : []
    if (sevFilter !== 'TODOS' && d.severity       !== sevFilter)       return false
    if (orgFilter !== 'TODOS' && d.org_type        !== orgFilter)      return false
    if (secFilter !== 'TODOS' && !docSectors.includes(secFilter))      return false
    if (cntFilter !== 'TODOS' && d.source_country  !== cntFilter)      return false
    if (search && !d.title?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [docs, sevFilter, orgFilter, secFilter, cntFilter, search])

  const selectedDoc = docs.find(d => d.id === selected)

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd   = Math.min(page * PAGE_SIZE, filtered.length)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {/* Banner de fuentes fallidas */}
      {failingSources.length > 0 && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(255,59,74,0.12)',
          border: '1px solid rgba(255,59,74,0.3)',
          borderRadius: '0',
          display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
        }}>
          <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: '9px', fontWeight: '700', letterSpacing: '.15em' }}>
            ⚠ SCRAPING FALLIDO:
          </span>
          <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: '9px' }}>
            {failingSources.map(s => s.name).join(' · ')}
          </span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
            <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
              BUSCAR
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="título…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: '2px', color: 'var(--txt-1)',
                fontFamily: 'var(--mono)', fontSize: '9px',
                padding: '5px 7px', outline: 'none',
              }}
            />
          </div>

          <CollapsibleFilter label="SEVERIDAD" defaultOpen={true}>
            <FilterGroup label="SEVERIDAD" options={['high', 'medium', 'low']} value={sevFilter} onChange={setSevFilter} hideLabel />
          </CollapsibleFilter>
          <CollapsibleFilter label="ORGANISMO">
            <FilterGroup label="ORGANISMO" options={orgTypes} value={orgFilter} onChange={setOrgFilter} labelFn={t => ORG_LABELS[t] || t} hideLabel />
          </CollapsibleFilter>
          <CollapsibleFilter label="SECTOR">
            <FilterGroup label="SECTOR" options={sectors} value={secFilter} onChange={setSecFilter} labelFn={s => SECTOR_LABELS[s] || s} hideLabel />
          </CollapsibleFilter>
          <CollapsibleFilter label="PAÍS">
            <FilterGroup label="PAÍS" options={countries} value={cntFilter} onChange={setCntFilter} hideLabel />
          </CollapsibleFilter>
        </aside>

        {/* Lista de documentos */}
        <div style={{ width: '420px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-md)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>
              DOCUMENTOS OFICIALES
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', marginLeft: 'auto' }}>
              {loading
                ? 'Cargando…'
                : filtered.length > 0
                  ? `${rangeStart}–${rangeEnd} de ${filtered.length} · ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`
                  : `0 · ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`
              }
            </span>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {loading && <LoadingRows count={8} />}
            {!loading && filtered.length === 0 && (
              <EmptyState
                title={docs.length === 0 ? 'SIN DOCUMENTOS' : 'SIN RESULTADOS'}
                subtitle={docs.length === 0 ? 'INGESTOR INACTIVO O SIN DATOS' : 'AJUSTA LOS FILTROS ACTIVOS'}
                icon="◧"
              />
            )}
            {!loading && paginated.map(doc => (
              <DocRow
                key={doc.id}
                doc={doc}
                selected={selected === doc.id}
                onClick={() => setSelected(selected === doc.id ? null : doc.id)}
                isFav={isFavorite('docs', doc.source)}
                onToggleFav={() => {
                  if (!isFavorite('docs', doc.source) && !canAddMore('docs')) return
                  toggleFavorite('docs', doc.source, doc.source)
                }}
              />
            ))}
            {!loading && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
          </div>
        </div>

        {/* Panel detalle */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-1)' }}>
          <DocDetail doc={selectedDoc} />
        </div>
      </div>
    </div>
  )
}
