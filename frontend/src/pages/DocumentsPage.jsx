import { useState, useRef } from 'react'
import { MOCK_DOCUMENTS, DOC_STATUS_COLORS, DOC_TYPE_ICONS } from '../data/mockDocuments'

const STATUS_LABELS = {
  analyzed:  'ANALIZADO',
  analyzing: 'ANALIZANDO',
  pending:   'PENDIENTE',
  archived:  'ARCHIVADO',
}

function DropZone({ onDrop }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  function handleDrag(e, over) {
    e.preventDefault(); setDragging(over)
  }
  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) onDrop(files)
  }
  function handleChange(e) {
    const files = Array.from(e.target.files)
    if (files.length) onDrop(files)
  }

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => handleDrag(e, true)}
      onDragLeave={e => handleDrag(e, false)}
      onDrop={handleDrop}
      style={{
        border: `1px dashed ${dragging ? 'var(--cyan)' : 'rgba(0,200,255,0.2)'}`,
        borderRadius: '3px',
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? 'rgba(0,200,255,0.04)' : 'transparent',
        transition: 'all .2s',
        marginBottom: '16px',
        flexShrink: 0,
      }}
    >
      <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.txt" style={{ display:'none' }} onChange={handleChange} />
      <div style={{ fontSize:'24px', marginBottom:'6px' }}>📂</div>
      <div style={{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--cyan)', letterSpacing:'.1em' }}>
        ARRASTRA DOCUMENTOS AQUÍ
      </div>
      <div style={{ fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)', marginTop:'4px' }}>
        PDF · DOCX · XLSX · TXT
      </div>
    </div>
  )
}

function DocRow({ doc, selected, onClick }) {
  const color = DOC_STATUS_COLORS[doc.status]
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 14px',
        background: selected ? 'var(--bg-3)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(0,200,255,0.3)' : 'transparent'}`,
        borderRadius: '2px',
        cursor: 'pointer',
        transition: 'all .12s',
        marginBottom: '2px',
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.background='var(--bg-2)' } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.background='transparent' } }}
    >
      <span style={{ fontSize:'16px', flexShrink:0 }}>{DOC_TYPE_ICONS[doc.type] || '📄'}</span>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'11px', color:'var(--txt-1)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
          {doc.name}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'2px' }}>
          <span style={{ fontFamily:'var(--mono)', fontSize:'8px', color, letterSpacing:'.1em' }}>
            {STATUS_LABELS[doc.status]}
          </span>
          {doc.status === 'analyzing' && (
            <div style={{ flex:'0 0 50px', height:'2px', background:'var(--border)', borderRadius:'1px', overflow:'hidden' }}>
              <div style={{
                height:'100%', width:'40%', background:'var(--amber)', borderRadius:'1px',
                animation:'analyzing 1.2s ease-in-out infinite',
              }} />
            </div>
          )}
          {doc.zones.map(z => (
            <span key={z} style={{ fontSize:'8px', fontFamily:'var(--mono)', color:'var(--txt-3)' }}>{z}</span>
          ))}
        </div>
      </div>

      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>{doc.size}</div>
        <div style={{ fontFamily:'var(--mono)', fontSize:'8px', color:'var(--txt-3)', marginTop:'1px' }}>
          {doc.pages}p
        </div>
      </div>
    </div>
  )
}

function DocDetail({ doc }) {
  if (!doc) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', fontFamily:'var(--mono)', fontSize:'10px', color:'var(--txt-3)', lineHeight:2 }}>
        SELECCIONA UN DOCUMENTO<br />PARA VER EL ANÁLISIS
      </div>
    </div>
  )

  const color = DOC_STATUS_COLORS[doc.status]

  return (
    <div style={{ flex:1, padding:'20px', overflowY:'auto' }}>
      {/* Header */}
      <div style={{ marginBottom:'16px' }}>
        <div style={{ fontSize:'20px', marginBottom:'6px' }}>{DOC_TYPE_ICONS[doc.type]}</div>
        <div style={{ fontSize:'12px', color:'var(--txt-1)', fontWeight:'600', lineHeight:1.4, marginBottom:'8px' }}>
          {doc.name}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <span style={{
            fontFamily:'var(--mono)', fontSize:'9px', letterSpacing:'.12em',
            color, background:`${color}18`, border:`1px solid ${color}44`,
            padding:'2px 8px', borderRadius:'2px',
          }}>{STATUS_LABELS[doc.status]}</span>
          <span style={{ fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>{doc.size}</span>
          <span style={{ fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>{doc.pages} páginas</span>
        </div>
      </div>

      {/* Meta */}
      <div style={{ marginBottom:'16px', paddingBottom:'14px', borderBottom:'1px solid var(--border)' }}>
        {[
          ['Subido',  doc.uploaded],
          ['Zonas',   doc.zones.join(', ')],
          ['Tags',    doc.tags.join(' · ')],
        ].map(([k,v]) => (
          <div key={k} style={{ display:'flex', gap:'10px', marginBottom:'5px' }}>
            <span style={{ fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)', textTransform:'uppercase', letterSpacing:'.1em', flexShrink:0, width:'52px' }}>{k}</span>
            <span style={{ fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-2)' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div>
        <div style={{ fontSize:'8px', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginBottom:'10px' }}>
          RESUMEN DE ANÁLISIS
        </div>
        {doc.status === 'analyzed' && doc.summary ? (
          <>
            <div style={{ fontSize:'11px', color:'var(--txt-1)', lineHeight:1.7, marginBottom:'14px' }}>
              {doc.summary}
            </div>
            {doc.relevance && (
              <div>
                <div style={{ fontSize:'8px', letterSpacing:'.1em', color:'var(--txt-3)', marginBottom:'5px' }}>RELEVANCIA GEOPOLÍTICA</div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ flex:1, height:'4px', background:'var(--border)', borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{
                      width:`${doc.relevance}%`, height:'100%', borderRadius:'2px',
                      background: doc.relevance >= 90 ? 'var(--red)' : doc.relevance >= 75 ? 'var(--amber)' : 'var(--green)',
                    }} />
                  </div>
                  <span style={{ fontFamily:'var(--mono)', fontSize:'12px', color:'var(--txt-1)', fontWeight:'600' }}>
                    {doc.relevance}
                  </span>
                </div>
              </div>
            )}
          </>
        ) : doc.status === 'analyzing' ? (
          <div style={{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--amber)', animation:'blink 1.2s ease-in-out infinite' }}>
            ANÁLISIS EN CURSO...
          </div>
        ) : (
          <div style={{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--txt-3)' }}>
            EN COLA PARA ANÁLISIS
          </div>
        )}
      </div>

      {/* Future AI action */}
      <div style={{
        marginTop:'20px', padding:'10px 12px',
        background:'rgba(0,200,255,0.03)', border:'1px solid var(--border)',
        borderRadius:'3px',
      }}>
        <div style={{ fontSize:'8px', letterSpacing:'.14em', color:'var(--cyan)', fontFamily:'var(--mono)', marginBottom:'4px' }}>
          FUSIÓN IA · PRÓXIMAMENTE
        </div>
        <div style={{ fontSize:'9px', color:'var(--txt-3)', lineHeight:1.5 }}>
          Correlación automática con alertas activas, noticias y posts de redes sociales para generar señales de trading.
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState(MOCK_DOCUMENTS)
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('TODOS')

  function handleDrop(files) {
    const newDocs = files.map((f, i) => ({
      id: Date.now() + i,
      name: f.name,
      type: f.name.split('.').pop().toLowerCase(),
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      uploaded: new Date().toLocaleString('es-ES').replace(',', ''),
      status: 'pending',
      zones: [],
      summary: null,
      tags: [],
      relevance: null,
      pages: '?',
    }))
    setDocs(prev => [...newDocs, ...prev])
  }

  const filtered = statusFilter === 'TODOS'
    ? docs
    : docs.filter(d => d.status === statusFilter.toLowerCase())

  const selectedDoc = docs.find(d => d.id === selected)

  const counts = {
    TODOS:     docs.length,
    ANALIZADO: docs.filter(d=>d.status==='analyzed').length,
    ANALIZANDO:docs.filter(d=>d.status==='analyzing').length,
    PENDIENTE: docs.filter(d=>d.status==='pending').length,
  }

  return (
    <div style={{ flex:1, display:'flex', overflow:'hidden', background:'var(--bg-0)' }}>

      {/* Left: list */}
      <div style={{
        width:'460px', flexShrink:0,
        display:'flex', flexDirection:'column',
        borderRight:'1px solid var(--border-md)',
        overflow:'hidden',
      }}>
        <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <DropZone onDrop={handleDrop} />

          {/* Status filter tabs */}
          <div style={{ display:'flex', gap:'4px' }}>
            {Object.entries(counts).map(([status, count]) => (
              <button key={status} onClick={() => setStatusFilter(status)} style={{
                flex:1, padding:'5px 4px', background:'none', cursor:'pointer',
                border: `1px solid ${statusFilter===status ? 'rgba(0,200,255,0.4)' : 'var(--border)'}`,
                borderRadius:'2px',
                color: statusFilter===status ? 'var(--cyan)' : 'var(--txt-3)',
                fontFamily:'var(--mono)', fontSize:'8px', letterSpacing:'.08em', textTransform:'uppercase',
                transition:'all .15s',
              }}>
                {status}<br />
                <span style={{ fontSize:'12px', color: statusFilter===status ? 'var(--cyan)' : 'var(--txt-2)' }}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'8px 6px' }}>
          {filtered.map(doc => (
            <DocRow
              key={doc.id}
              doc={doc}
              selected={selected === doc.id}
              onClick={() => setSelected(selected === doc.id ? null : doc.id)}
            />
          ))}
        </div>
      </div>

      {/* Right: detail */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-1)' }}>
        <DocDetail doc={selectedDoc} />
      </div>

      <style>{`
        @keyframes analyzing {
          0%   { transform: translateX(-100%) }
          100% { transform: translateX(250%) }
        }
      `}</style>
    </div>
  )
}
