import { MOCK_NEWS } from '../data/mockNews'
import { MOCK_DOCUMENTS, DOC_STATUS_COLORS } from '../data/mockDocuments'
import { MOCK_POSTS, TRENDING_TOPICS } from '../data/mockSocial'

const SEV_COLOR = { high:'var(--red)', medium:'var(--amber)', low:'var(--green)' }

function ModuleCard({ id, title, icon, subtitle, status, statusColor, children, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: '3px',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'border-color .15s',
        position: 'relative',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-md)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Card header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'18px', lineHeight:1 }}>{icon}</span>
          <div>
            <div style={{ fontSize:'11px', fontWeight:'700', letterSpacing:'.18em', color:'var(--accent)', textTransform:'uppercase' }}>
              {title}
            </div>
            <div style={{ fontSize:'9px', color:'var(--txt-3)', letterSpacing:'.1em', marginTop:'1px' }}>
              {subtitle}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <div style={{
            width:'5px', height:'5px', borderRadius:'50%',
            background: statusColor,
            animation: 'blink 2.4s ease-in-out infinite',
          }} />
          <span style={{ fontFamily:'var(--mono)', fontSize:'9px', color: statusColor, letterSpacing:'.1em' }}>
            {status}
          </span>
        </div>
      </div>

      {/* Card content */}
      <div style={{ flex:1, overflow:'hidden', padding:'8px 0' }}>
        {children}
      </div>

      {/* Enter hint */}
      <div style={{
        position:'absolute', bottom:10, right:12,
        fontFamily:'var(--mono)', fontSize:'9px', color:'rgba(79,156,249,0.25)',
        letterSpacing:'.1em', pointerEvents:'none',
      }}>
        ABRIR →
      </div>
    </div>
  )
}

function TacticalPreview({ aircraft, alerts }) {
  const rows = [
    { label:'AERONAVES',   value: aircraft.length,                                sub:`${aircraft.filter(a=>a.type==='military').length} mil`, color:'var(--cyan)'  },
    { label:'MIL. AÉREO',  value: aircraft.filter(a=>a.type==='military').length, sub:'detectados',                                           color:'var(--red)'   },
    { label:'ALT. HIGH',   value: alerts.filter(a=>a.severity==='high').length,   sub:'activas',                                              color:'var(--red)'   },
    { label:'ALT. MEDIUM', value: alerts.filter(a=>a.severity==='medium').length, sub:'activas',                                              color:'var(--amber)' },
  ]
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1px', background:'var(--border)', margin:'0 0 8px' }}>
      {rows.map(r => (
        <div key={r.label} style={{ background:'var(--bg-2)', padding:'10px 14px' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:'24px', fontWeight:'500', color:r.color, lineHeight:1 }}>{r.value}</div>
          <div style={{ fontSize:'8px', letterSpacing:'.14em', color:'var(--txt-3)', textTransform:'uppercase', marginTop:'2px' }}>{r.label}</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)', marginTop:'1px' }}>{r.sub}</div>
        </div>
      ))}
    </div>
  )
}

function NewsPreview() {
  return (
    <div>
      {MOCK_NEWS.slice(0,4).map(n => (
        <div key={n.id} style={{
          padding:'7px 14px',
          borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'flex-start', gap:'8px',
        }}>
          <div style={{
            flexShrink:0, marginTop:'2px',
            width:'6px', height:'6px', borderRadius:'50%',
            background: SEV_COLOR[n.severity],
          }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontSize:'10px', color:'var(--txt-1)', lineHeight:1.3,
              overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
            }}>{n.title}</div>
            <div style={{ fontSize:'9px', color:'var(--txt-3)', fontFamily:'var(--mono)', marginTop:'2px' }}>
              {n.source} · {n.time} UTC
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DocsPreview() {
  return (
    <div>
      {MOCK_DOCUMENTS.slice(0,4).map(d => (
        <div key={d.id} style={{
          padding:'7px 14px',
          borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:'8px',
        }}>
          <span style={{ fontSize:'10px', flexShrink:0, fontFamily:'var(--mono)', color:'var(--txt-3)' }}>
            {d.type === 'pdf' ? '[PDF]' : d.type === 'docx' ? '[DOC]' : '[XLS]'}
          </span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontSize:'10px', color:'var(--txt-1)',
              overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
            }}>{d.name}</div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'2px' }}>
              <span style={{
                fontSize:'8px', fontFamily:'var(--mono)', letterSpacing:'.1em',
                color: DOC_STATUS_COLORS[d.status], textTransform:'uppercase',
              }}>{d.status}</span>
              {d.zones.map(z => (
                <span key={z} style={{ fontSize:'8px', color:'var(--txt-3)', fontFamily:'var(--mono)' }}>{z}</span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SocialPreview() {
  return (
    <div>
      {TRENDING_TOPICS.slice(0,4).map(t => (
        <div key={t.topic} style={{
          padding:'7px 14px',
          borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div>
            <div style={{ fontSize:'10px', color:'var(--accent)', fontFamily:'var(--mono)' }}>{t.topic}</div>
            <div style={{ fontSize:'9px', color:'var(--txt-3)', marginTop:'1px' }}>{t.zone}</div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0, marginLeft:'8px' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:'11px', color:'var(--txt-1)' }}>
              {(t.count / 1000).toFixed(1)}K
            </div>
            <div style={{ fontSize:'9px', color:'var(--green)', fontFamily:'var(--mono)' }}>{t.delta}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HomePage({ aircraft, alerts, onNavigate }) {
  const pendingDocs = MOCK_DOCUMENTS.filter(d => d.status === 'pending' || d.status === 'analyzing').length

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg-0)',
      padding: '20px 24px',
      gap: '16px',
    }}>

      {/* System status strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '10px 16px',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: '3px',
        flexShrink: 0,
      }}>
        <div style={{ fontSize:'9px', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginRight:'4px' }}>
          ESTADO DEL SISTEMA
        </div>
        {[
          { label:'ADS-B',    color:'var(--green)',  val:`${aircraft.length} entidades` },
          { label:'NOTICIAS', color:'var(--amber)',  val:`${MOCK_NEWS.length} artículos` },
          { label:'DOCS',     color: pendingDocs ? 'var(--amber)' : 'var(--green)',
                              val: `${pendingDocs} pendientes` },
          { label:'SOCIAL',   color:'var(--green)',  val:`${MOCK_POSTS.length} posts`   },
          { label:'ALERTAS',  color: alerts.length > 0 ? 'var(--red)' : 'var(--green)',
                              val: `${alerts.length} activas` },
        ].map(item => (
          <div key={item.label} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <div style={{
              width:'5px', height:'5px', borderRadius:'50%',
              background: item.color,
              animation:'blink 2.4s ease-in-out infinite',
            }} />
            <span style={{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--txt-3)', letterSpacing:'.1em' }}>
              {item.label}
            </span>
            <span style={{ fontFamily:'var(--mono)', fontSize:'10px', color: item.color }}>
              {item.val}
            </span>
          </div>
        ))}

      </div>

      {/* 2×2 module grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '12px',
        minHeight: 0,
      }}>
        <ModuleCard
          title="Mapa Táctico"
          icon="◎"
          subtitle="ADS-B · AIS · ALERTAS EN TIEMPO REAL"
          status="LIVE"
          statusColor="var(--green)"
          onClick={() => onNavigate('tactical')}
        >
          <TacticalPreview aircraft={aircraft} alerts={alerts} />
          <div style={{ padding:'6px 14px 0' }}>
            {alerts.slice(0,2).map(a => (
              <div key={a.id} style={{
                display:'flex', alignItems:'center', gap:'7px',
                padding:'5px 0', borderBottom:'1px solid var(--border)',
              }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:SEV_COLOR[a.severity], flexShrink:0 }} />
                <span style={{ fontSize:'10px', color:'var(--txt-2)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{a.title}</span>
              </div>
            ))}
          </div>
        </ModuleCard>

        <ModuleCard
          title="Inteligencia de Noticias"
          icon="◈"
          subtitle="FUENTES ABIERTAS · OSINT · PRENSA INTERNACIONAL"
          status={`${MOCK_NEWS.filter(n=>n.severity==='high').length} CRÍTICAS`}
          statusColor="var(--red)"
          onClick={() => onNavigate('news')}
        >
          <NewsPreview />
        </ModuleCard>

        <ModuleCard
          title="Ingesta de Documentos"
          icon="▣"
          subtitle="PDF · DOCX · ANÁLISIS AUTOMÁTICO"
          status={pendingDocs > 0 ? `${pendingDocs} PENDIENTES` : 'AL DÍA'}
          statusColor={pendingDocs > 0 ? 'var(--amber)' : 'var(--green)'}
          onClick={() => onNavigate('documents')}
        >
          <DocsPreview />
        </ModuleCard>

        <ModuleCard
          title="Redes Sociales"
          icon="◉"
          subtitle="X · TELEGRAM · MONITORIZACIÓN ZONAS"
          status={`${TRENDING_TOPICS.length} TRENDING`}
          statusColor="var(--accent)"
          onClick={() => onNavigate('social')}
        >
          <SocialPreview />
        </ModuleCard>
      </div>

      {/* Recent alerts strip */}
      {alerts.length > 0 && (
        <div style={{
          flexShrink: 0,
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: '3px',
          padding: '8px 14px',
        }}>
          <div style={{ fontSize:'8px', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginBottom:'8px' }}>
            ALERTAS RECIENTES
          </div>
          <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'4px' }}>
            {alerts.map(a => (
              <div
                key={a.id}
                onClick={() => onNavigate('tactical')}
                style={{
                  flexShrink: 0,
                  padding: '6px 10px',
                  background: 'var(--bg-2)',
                  border: `1px solid ${SEV_COLOR[a.severity]}33`,
                  borderLeft: `3px solid ${SEV_COLOR[a.severity]}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                  minWidth: '200px', maxWidth: '280px',
                }}
              >
                <div style={{ fontFamily:'var(--mono)', fontSize:'8px', color:SEV_COLOR[a.severity], letterSpacing:'.1em', textTransform:'uppercase' }}>
                  {a.severity} · {a.zone}
                </div>
                <div style={{ fontSize:'10px', color:'var(--txt-1)', marginTop:'2px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                  {a.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
