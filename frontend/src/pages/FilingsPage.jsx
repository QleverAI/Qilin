import { useState, useMemo } from 'react'
import { useSecFeed } from '../hooks/useSecFeed'
import { SEV_COLOR, SEV_BG, SEV_BORDER } from '../lib/severity'
import FilterGroup from '../components/FilterGroup'
import { LoadingRows } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'

const SECTOR_LABELS = {
  defense:        'Defensa',
  energy:         'Energía',
  semiconductors: 'Semicon.',
  financials:     'Finanzas',
  cyber_infra:    'Ciber/Infra',
}

const SECTOR_COLOR = {
  defense:        'rgba(255,59,74,0.8)',
  energy:         'rgba(255,140,0,0.8)',
  semiconductors: 'rgba(0,200,255,0.8)',
  financials:     'rgba(0,229,160,0.8)',
  cyber_infra:    'rgba(130,80,255,0.8)',
}

function SectorBadge({ sector }) {
  return (
    <span style={{
      fontSize: '8px', fontFamily: 'var(--mono)',
      color: 'var(--bg-0)',
      background: SECTOR_COLOR[sector] || 'rgba(150,150,150,0.8)',
      padding: '1px 5px', borderRadius: '2px',
    }}>
      {SECTOR_LABELS[sector] || sector}
    </span>
  )
}

function TickerBadge({ ticker, sector }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '700',
      color: SECTOR_COLOR[sector] || 'var(--cyan)',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${SECTOR_COLOR[sector] || 'var(--cyan)'}`,
      borderRadius: '3px', padding: '1px 6px',
      flexShrink: 0,
    }}>
      {ticker}
    </span>
  )
}

function FilingRow({ filing, selected, onClick }) {
  const sev    = filing.severity || 'low'
  const active = selected
  return (
    <div onClick={onClick} style={{
      padding: '10px 14px', cursor: 'pointer',
      borderBottom: '1px solid var(--border-sm)',
      background: active ? 'rgba(0,200,255,0.06)' : 'transparent',
      borderLeft: `3px solid ${active ? 'var(--cyan)' : 'transparent'}`,
      transition: 'background .12s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <TickerBadge ticker={filing.ticker} sector={filing.sector} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', flexShrink: 0 }}>
          {filing.form_type}
        </span>
        <span style={{
          fontSize: '8px', fontFamily: 'var(--mono)',
          color: SEV_COLOR[sev],
          background: SEV_BG[sev],
          border: `1px solid ${SEV_BORDER[sev]}`,
          padding: '1px 5px', borderRadius: '2px', flexShrink: 0,
        }}>
          {sev.toUpperCase()}
        </span>
        <SectorBadge sector={filing.sector} />
      </div>
      <div style={{ fontSize: '11px', color: 'var(--txt-1)', lineHeight: '1.35', marginBottom: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {filing.company_name} — {filing.title || 'Sin título'}
      </div>
      <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
        {filing.time ? new Date(filing.time).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
      </div>
    </div>
  )
}

function RelevanceBar({ value }) {
  const pct = Math.max(0, Math.min(100, value || 0))
  const color = pct >= 70 ? 'var(--red)' : pct >= 40 ? 'var(--amber)' : 'var(--green)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width .3s' }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color, flexShrink: 0 }}>{pct}</span>
    </div>
  )
}

function FilingDetail({ filing }) {
  const sev = filing.severity || 'low'
  return (
    <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
        <TickerBadge ticker={filing.ticker} sector={filing.sector} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--txt-1)', lineHeight: '1.3' }}>
            {filing.company_name}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
            {SECTOR_LABELS[filing.sector] || filing.sector}
          </div>
        </div>
        <span style={{
          marginLeft: 'auto', flexShrink: 0,
          fontSize: '9px', fontFamily: 'var(--mono)', fontWeight: '700',
          color: SEV_COLOR[sev], background: SEV_BG[sev],
          border: `1px solid ${SEV_BORDER[sev]}`,
          padding: '3px 8px', borderRadius: '3px',
        }}>
          {sev.toUpperCase()}
        </span>
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        {[
          ['Formulario',  filing.form_type],
          ['Sector',      SECTOR_LABELS[filing.sector] || filing.sector],
          ['Fecha',       filing.time ? new Date(filing.time).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
          ['CIK',         filing.cik],
        ].map(([k, v]) => (
          <div key={k} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '8px 10px' }}>
            <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '3px' }}>{k}</div>
            <div style={{ fontSize: '11px', color: 'var(--txt-1)', fontFamily: 'var(--mono)' }}>{v || '—'}</div>
          </div>
        ))}
      </div>

      {/* Accession number */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '4px', padding: '8px 10px', marginBottom: '14px' }}>
        <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '3px' }}>Accession Number</div>
        <div style={{ fontSize: '10px', color: 'var(--txt-2)', fontFamily: 'var(--mono)' }}>{filing.accession_number}</div>
      </div>

      {/* Relevance */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>Relevancia</div>
        <RelevanceBar value={filing.relevance} />
      </div>

      {/* Title / Items */}
      {filing.title && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>Ítems Reportados</div>
          <div style={{ fontSize: '11px', color: 'var(--txt-2)', lineHeight: '1.5' }}>{filing.title}</div>
        </div>
      )}

      {/* Summary */}
      {filing.summary && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '8px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>Resumen</div>
          <div style={{
            fontSize: '11px', color: 'var(--txt-2)', lineHeight: '1.6',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-sm)',
            borderRadius: '4px', padding: '10px', maxHeight: '200px', overflowY: 'auto',
          }}>
            {filing.summary}
          </div>
        </div>
      )}

      {/* EDGAR link */}
      {filing.filing_url && (
        <a
          href={filing.filing_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', textAlign: 'center',
            background: 'rgba(0,200,255,0.08)',
            border: '1px solid rgba(0,200,255,0.3)',
            borderRadius: '4px', padding: '9px',
            fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: '600',
            color: 'var(--cyan)', textDecoration: 'none',
            letterSpacing: '.1em', transition: 'background .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,200,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,200,255,0.08)'}
        >
          VER EN EDGAR ↗
        </a>
      )}
    </div>
  )
}

export default function FilingsPage() {
  const { filings, sources, sectors, failingSources, loading, lastUpdate } = useSecFeed()

  const [selectedId,   setSelectedId]   = useState(null)
  const [filterSector, setFilterSector] = useState('TODOS')
  const [filterSev,    setFilterSev]    = useState('TODOS')
  const [search,       setSearch]       = useState('')

  const filtered = useMemo(() => filings.filter(f => {
    if (filterSector !== 'TODOS' && f.sector !== filterSector) return false
    if (filterSev    !== 'TODOS' && f.severity !== filterSev)  return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !f.ticker.toLowerCase().includes(q) &&
        !f.company_name.toLowerCase().includes(q) &&
        !(f.title || '').toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [filings, filterSector, filterSev, search])

  const selected = filings.find(f => f.id === selectedId) || null

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

      {/* Sidebar */}
      <aside style={{
        width: '180px', flexShrink: 0,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border-md)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', padding: '14px 0',
      }}>
        {/* Search */}
        <div style={{ padding: '0 12px 14px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ticker / empresa..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-md)', borderRadius: '4px',
              color: 'var(--txt-1)', fontFamily: 'var(--mono)', fontSize: '10px',
              padding: '6px 8px', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '0 12px' }}>
          <FilterGroup
            label="Sector"
            options={sectors}
            value={filterSector}
            onChange={setFilterSector}
            labelFn={s => SECTOR_LABELS[s] || s}
          />
          <FilterGroup
            label="Severidad"
            options={['high', 'medium', 'low']}
            value={filterSev}
            onChange={setFilterSev}
          />
        </div>

        {/* Stats footer */}
        <div style={{ marginTop: 'auto', padding: '14px 12px 0', borderTop: '1px solid var(--border-sm)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
            {filtered.length} / {filings.length} filings
          </div>
          {lastUpdate && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: 'var(--txt-3)', marginTop: '3px' }}>
              {lastUpdate.toLocaleTimeString('es-ES')}
            </div>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {/* Failing sources banner */}
        {failingSources.length > 0 && (
          <div style={{
            background: 'rgba(255,176,32,0.08)', borderBottom: '1px solid rgba(255,176,32,0.25)',
            padding: '7px 16px',
            fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--amber)',
            flexShrink: 0,
          }}>
            ⚠ Empresas con fallos de fetch: {failingSources.map(s => s.ticker).join(', ')}
          </div>
        )}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Filings list */}
          <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid var(--border-md)' }}>
            {loading && <LoadingRows count={8} />}
            {!loading && filtered.length === 0 && (
              <EmptyState
                title={filings.length === 0 ? 'SIN FILINGS' : 'SIN RESULTADOS'}
                subtitle={filings.length === 0 ? 'INGESTOR SEC INACTIVO' : 'AJUSTA LOS FILTROS ACTIVOS'}
                icon="◫"
              />
            )}
            {filtered.map(f => (
              <FilingRow
                key={f.id}
                filing={f}
                selected={f.id === selectedId}
                onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
              />
            ))}
          </div>

          {/* Detail panel */}
          {selected ? (
            <div style={{ width: '380px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <FilingDetail filing={selected} />
            </div>
          ) : (
            <div style={{ width: '380px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState title="SELECCIONA UN FILING" subtitle="PARA VER EL DETALLE" icon="◫" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
