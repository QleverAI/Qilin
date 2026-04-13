import { useState } from 'react'
import { MOCK_NEWS } from '../data/mockNews'

const SEV_COLOR  = { high:'var(--red)', medium:'var(--amber)', low:'var(--green)' }
const SEV_BG     = { high:'rgba(255,59,74,0.10)', medium:'rgba(255,176,32,0.09)', low:'rgba(0,229,160,0.08)' }
const SEV_BORDER = { high:'rgba(255,59,74,0.28)', medium:'rgba(255,176,32,0.26)', low:'rgba(0,229,160,0.2)' }

const ALL_ZONES = ['TODAS', ...Array.from(new Set(MOCK_NEWS.map(n => n.zone)))]
const ALL_SEV   = ['TODOS', 'high', 'medium', 'low']

function RelevanceBar({ value }) {
  const color = value >= 90 ? 'var(--red)' : value >= 75 ? 'var(--amber)' : 'var(--green)'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
      <div style={{ flex:1, height:'2px', background:'var(--border)', borderRadius:'1px', overflow:'hidden' }}>
        <div style={{ width:`${value}%`, height:'100%', background:color, borderRadius:'1px', transition:'width .3s' }} />
      </div>
      <span style={{ fontFamily:'var(--mono)', fontSize:'9px', color, flexShrink:0 }}>{value}</span>
    </div>
  )
}

function NewsCard({ article, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        background: selected ? 'var(--bg-3)' : 'var(--bg-2)',
        border: `1px solid ${selected ? 'rgba(0,200,255,0.35)' : 'var(--border)'}`,
        borderLeft: `3px solid ${SEV_COLOR[article.severity]}`,
        borderRadius: '2px',
        cursor: 'pointer',
        transition: 'all .15s',
        marginBottom: '6px',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'rgba(0,200,255,0.2)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {/* Meta row */}
      <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'6px' }}>
        <span style={{
          fontSize:'8px', fontWeight:'700', letterSpacing:'.12em',
          padding:'2px 6px', borderRadius:'2px',
          background: SEV_BG[article.severity],
          color: SEV_COLOR[article.severity],
          border: `1px solid ${SEV_BORDER[article.severity]}`,
          fontFamily:'var(--mono)',
        }}>{article.severity.toUpperCase()}</span>
        <span style={{ fontSize:'9px', fontFamily:'var(--mono)', letterSpacing:'.1em', color:'var(--txt-3)', textTransform:'uppercase' }}>
          {article.zone}
        </span>
        <span style={{ marginLeft:'auto', fontSize:'9px', fontFamily:'var(--mono)', color:'var(--txt-3)' }}>
          {article.time} UTC · {article.source}
        </span>
      </div>

      <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--txt-1)', lineHeight:1.35, marginBottom:'6px' }}>
        {article.title}
      </div>

      {selected && (
        <div style={{ fontSize:'11px', color:'var(--txt-2)', lineHeight:1.6, marginBottom:'8px' }}>
          {article.excerpt}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        {article.tags.map(t => (
          <span key={t} style={{
            fontSize:'8px', fontFamily:'var(--mono)', color:'var(--txt-3)',
            background:'var(--bg-3)', padding:'1px 5px', borderRadius:'2px',
            border:'1px solid var(--border)',
          }}>#{t}</span>
        ))}
        <div style={{ marginLeft:'auto', flex:'0 0 120px' }}>
          <RelevanceBar value={article.relevance} />
        </div>
      </div>
    </div>
  )
}

export default function NewsPage() {
  const [zoneFilter, setZoneFilter]  = useState('TODAS')
  const [sevFilter,  setSevFilter]   = useState('TODOS')
  const [selected,   setSelected]    = useState(null)
  const [search,     setSearch]      = useState('')

  const filtered = MOCK_NEWS.filter(n => {
    if (zoneFilter !== 'TODAS' && n.zone !== zoneFilter) return false
    if (sevFilter !== 'TODOS' && n.severity !== sevFilter) return false
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ flex:1, display:'flex', overflow:'hidden', background:'var(--bg-0)' }}>

      {/* Left sidebar: filters */}
      <aside style={{
        width: '200px', flexShrink:0,
        background:'var(--bg-1)',
        borderRight:'1px solid var(--border-md)',
        padding:'16px 12px',
        display:'flex', flexDirection:'column', gap:'20px',
        overflowY:'auto',
      }}>
        <div>
          <div style={{ fontSize:'8px', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginBottom:'8px' }}>
            SEVERIDAD
          </div>
          {ALL_SEV.map(s => (
            <button key={s} onClick={() => setSevFilter(s)} style={{
              display:'block', width:'100%', textAlign:'left',
              background: sevFilter===s ? 'rgba(0,200,255,0.08)' : 'none',
              border:'none',
              borderLeft: `2px solid ${sevFilter===s ? 'var(--cyan)' : 'transparent'}`,
              color: sevFilter===s ? 'var(--cyan)' : 'var(--txt-3)',
              fontFamily:'var(--mono)', fontSize:'10px', letterSpacing:'.1em',
              padding:'5px 8px', cursor:'pointer', transition:'all .15s',
              textTransform:'uppercase',
            }}>
              {s === 'TODOS' ? 'TODOS' : (
                <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:SEV_COLOR[s], display:'inline-block' }} />
                  {s}
                </span>
              )}
            </button>
          ))}
        </div>

        <div>
          <div style={{ fontSize:'8px', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginBottom:'8px' }}>
            ZONA
          </div>
          {ALL_ZONES.map(z => (
            <button key={z} onClick={() => setZoneFilter(z)} style={{
              display:'block', width:'100%', textAlign:'left',
              background: zoneFilter===z ? 'rgba(0,200,255,0.08)' : 'none',
              border:'none',
              borderLeft: `2px solid ${zoneFilter===z ? 'var(--cyan)' : 'transparent'}`,
              color: zoneFilter===z ? 'var(--cyan)' : 'var(--txt-3)',
              fontFamily:'var(--mono)', fontSize:'10px', letterSpacing:'.08em',
              padding:'5px 8px', cursor:'pointer', transition:'all .15s',
              textTransform:'uppercase', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>{z}</button>
          ))}
        </div>

        <div style={{ marginTop:'auto', padding:'10px 8px', background:'rgba(0,200,255,0.04)', border:'1px solid var(--border)', borderRadius:'3px' }}>
          <div style={{ fontSize:'8px', letterSpacing:'.12em', color:'var(--cyan)', fontFamily:'var(--mono)', marginBottom:'4px' }}>
            FUSIÓN IA
          </div>
          <div style={{ fontSize:'9px', color:'var(--txt-3)', lineHeight:1.5 }}>
            Próximamente: correlación automática noticias ↔ alertas ADS-B/AIS
          </div>
        </div>
      </aside>

      {/* Main: news feed */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Search bar + count */}
        <div style={{
          padding:'10px 16px',
          borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:'12px',
          flexShrink:0,
        }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en titulares..."
            style={{
              flex:1, background:'var(--bg-2)', border:'1px solid var(--border)',
              color:'var(--txt-1)', fontFamily:'var(--mono)', fontSize:'11px',
              padding:'7px 12px', outline:'none', borderRadius:'2px',
              letterSpacing:'.04em',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--cyan)'}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />
          <span style={{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--txt-3)', flexShrink:0 }}>
            {filtered.length} resultados
          </span>
        </div>

        {/* Articles */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', fontFamily:'var(--mono)', fontSize:'11px', color:'var(--txt-3)' }}>
              No hay resultados para los filtros seleccionados
            </div>
          ) : (
            filtered.map(article => (
              <NewsCard
                key={article.id}
                article={article}
                selected={selected === article.id}
                onClick={() => setSelected(selected === article.id ? null : article.id)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}
