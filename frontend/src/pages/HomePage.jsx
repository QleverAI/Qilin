import { useMemo } from 'react'
import { useNewsFeed }  from '../hooks/useNewsFeed'
import { useDocsFeed }  from '../hooks/useDocsFeed'
import { useSocialFeed } from '../hooks/useSocialFeed'
import { SEV_COLOR } from '../lib/severity'

function ModuleCard({ title, icon, subtitle, status, statusColor, children, onClick }) {
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
      <div style={{ flex:1, overflow:'hidden', padding:'8px 0' }}>
        {children}
      </div>
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

function NewsPreview({ articles, loading }) {
  if (loading) return (
    <div style={{ padding:'14px', fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>CARGANDO…</div>
  )
  const items = articles.slice(0, 4)
  if (!items.length) return (
    <div style={{ padding:'14px', fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>SIN ARTÍCULOS</div>
  )
  return (
    <div>
      {items.map(n => (
        <div key={n.id || n.url} style={{
          padding:'7px 14px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'flex-start', gap:'8px',
        }}>
          <div style={{
            flexShrink:0, marginTop:'3px',
            width:'6px', height:'6px', borderRadius:'50%',
            background: SEV_COLOR[n.severity] || 'var(--txt-3)',
          }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontSize:'10px', color:'var(--txt-1)', lineHeight:1.3,
              overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
            }}>{n.title}</div>
            <div style={{ fontSize:'9px', color:'var(--txt-3)', fontFamily:'var(--mono)', marginTop:'2px' }}>
              {n.source}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DocsPreview({ docs, loading }) {
  if (loading) return (
    <div style={{ padding:'14px', fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>CARGANDO…</div>
  )
  const items = docs.slice(0, 4)
  if (!items.length) return (
    <div style={{ padding:'14px', fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>SIN DOCUMENTOS</div>
  )
  return (
    <div>
      {items.map(d => (
        <div key={d.id} style={{
          padding:'7px 14px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:'8px',
        }}>
          <span style={{ fontSize:'10px', flexShrink:0, fontFamily:'var(--mono)', color:'var(--txt-3)' }}>
            [DOC]
          </span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontSize:'10px', color:'var(--txt-1)',
              overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
            }}>{d.title}</div>
            <div style={{ fontSize:'8px', color:'var(--txt-3)', fontFamily:'var(--mono)', marginTop:'2px' }}>
              {d.source}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SocialPreview({ posts, loading }) {
  if (loading) return (
    <div style={{ padding:'14px', fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>CARGANDO…</div>
  )
  const items = posts.slice(0, 4)
  if (!items.length) return (
    <div style={{ padding:'14px', fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>SIN TWEETS</div>
  )
  return (
    <div>
      {items.map(p => (
        <div key={p.tweet_id} style={{
          padding:'7px 14px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:'10px', color:'var(--accent)', fontFamily:'var(--mono)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
              @{p.handle}
            </div>
            <div style={{ fontSize:'9px', color:'var(--txt-3)', marginTop:'1px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
              {p.content}
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0, marginLeft:'8px' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:'9px', color:'var(--green)' }}>
              ❤ {(p.likes || 0).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Panel de correlación cruzada ──────────────────────────────────────────────

function CorrelationPanel({ aircraft, alerts, articles, posts }) {
  const signals = useMemo(() => {
    const now = Date.now()
    const window1h = 60 * 60 * 1000

    // Group active signals per zone
    const zones = {}
    const add = (zone, source) => {
      if (!zone) return
      if (!zones[zone]) zones[zone] = new Set()
      zones[zone].add(source)
    }

    alerts.forEach(a => add(a.zone, 'ALERTAS'))

    aircraft.filter(a => a.type === 'military' && a.zone).forEach(a => add(a.zone, 'ADS-B MIL'))

    articles
      .filter(a => a.time && (now - new Date(a.time).getTime()) < window1h)
      .forEach(a => (Array.isArray(a.zones) ? a.zones : []).forEach(z => add(z, 'NOTICIAS')))

    posts
      .filter(p => p.time && (now - new Date(p.time).getTime()) < window1h && p.zone)
      .forEach(p => add(p.zone, 'SOCIAL'))

    return Object.entries(zones)
      .filter(([, srcs]) => srcs.size >= 2)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 4)
      .map(([zone, srcs]) => ({ zone, sources: [...srcs] }))
  }, [aircraft, alerts, articles, posts])

  if (!signals.length) return null

  return (
    <div style={{
      flexShrink: 0,
      background: 'var(--bg-1)',
      border: '1px solid rgba(244,63,94,0.25)',
      borderLeft: '3px solid var(--red)',
      borderRadius: '3px',
      padding: '10px 14px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
      }}>
        <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--red)', animation:'blink 1.2s ease-in-out infinite', flexShrink:0 }} />
        <span style={{ fontFamily:'var(--mono)', fontSize:'var(--label-xs)', fontWeight:'700', letterSpacing:'.2em', color:'var(--red)', textTransform:'uppercase' }}>
          SEÑALES CONVERGENTES
        </span>
        <span style={{ fontFamily:'var(--mono)', fontSize:'var(--label-xs)', color:'var(--txt-3)', marginLeft:'auto' }}>
          {signals.length} zona{signals.length > 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        {signals.map(({ zone, sources }) => (
          <div key={zone} style={{
            background: 'rgba(244,63,94,0.07)',
            border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: '3px',
            padding: '8px 12px',
            minWidth: '160px',
          }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:'var(--label-sm)', fontWeight:'700', color:'var(--txt-1)', letterSpacing:'.08em', marginBottom:'5px', textTransform:'uppercase' }}>
              {zone.replace(/_/g, ' ')}
            </div>
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {sources.map(s => (
                <span key={s} style={{
                  fontFamily:'var(--mono)', fontSize:'var(--label-xs)',
                  color:'var(--red)', background:'rgba(244,63,94,0.1)',
                  border:'1px solid rgba(244,63,94,0.25)',
                  padding:'1px 6px', borderRadius:'2px', letterSpacing:'.06em',
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function HomePage({ aircraft, alerts, onNavigate }) {
  const { articles, loading: newsLoading }  = useNewsFeed()
  const { docs,     loading: docsLoading }  = useDocsFeed()
  const { posts,    loading: socialLoading } = useSocialFeed()

  const highNews    = articles.filter(n => n.severity === 'high').length
  const pendingDocs = docs.filter(d => d.status === 'pending' || d.status === 'analyzing').length

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--bg-0)',
      padding: '16px 20px', gap: '12px',
    }}>

      {/* System status strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '9px 16px',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: '3px',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize:'var(--label-xs)', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginRight:'4px', flexShrink:0 }}>
          ESTADO DEL SISTEMA
        </div>
        {[
          { label:'ADS-B',    color:'var(--green)',  val:`${aircraft.length} entidades` },
          { label:'NOTICIAS', color: newsLoading   ? 'var(--txt-3)' : articles.length  ? 'var(--green)' : 'var(--amber)', val: newsLoading   ? '…' : `${articles.length} artículos`  },
          { label:'DOCS',     color: docsLoading   ? 'var(--txt-3)' : pendingDocs      ? 'var(--amber)' : 'var(--green)', val: docsLoading   ? '…' : `${pendingDocs} pendientes`     },
          { label:'SOCIAL',   color: socialLoading ? 'var(--txt-3)' : posts.length     ? 'var(--green)' : 'var(--amber)', val: socialLoading ? '…' : `${posts.length} posts`          },
          { label:'ALERTAS',  color: alerts.length > 0 ? 'var(--red)' : 'var(--green)', val: `${alerts.length} activas` },
        ].map(item => (
          <div key={item.label} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <div style={{ width:'5px', height:'5px', borderRadius:'50%', background: item.color, animation:'blink 2.4s ease-in-out infinite' }} />
            <span style={{ fontFamily:'var(--mono)', fontSize:'var(--label-sm)', color:'var(--txt-3)', letterSpacing:'.1em' }}>
              {item.label}
            </span>
            <span style={{ fontFamily:'var(--mono)', fontSize:'var(--label-sm)', color: item.color }}>
              {item.val}
            </span>
          </div>
        ))}
      </div>

      {/* Señales convergentes */}
      <CorrelationPanel aircraft={aircraft} alerts={alerts} articles={articles} posts={posts} />

      {/* 2×2 module grid */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '10px', minHeight: 0,
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
            {alerts.slice(0, 2).map(a => (
              <div key={a.id} style={{
                display:'flex', alignItems:'center', gap:'7px',
                padding:'5px 0', borderBottom:'1px solid var(--border)',
              }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background: SEV_COLOR[a.severity], flexShrink:0 }} />
                <span style={{ fontSize:'10px', color:'var(--txt-2)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{a.title}</span>
              </div>
            ))}
          </div>
        </ModuleCard>

        <ModuleCard
          title="Inteligencia de Noticias"
          icon="◈"
          subtitle="FUENTES ABIERTAS · OSINT · PRENSA INTERNACIONAL"
          status={highNews > 0 ? `${highNews} CRÍTICAS` : newsLoading ? 'CARGANDO' : `${articles.length} ARTS`}
          statusColor={highNews > 0 ? 'var(--red)' : newsLoading ? 'var(--txt-3)' : 'var(--green)'}
          onClick={() => onNavigate('news')}
        >
          <NewsPreview articles={articles} loading={newsLoading} />
        </ModuleCard>

        <ModuleCard
          title="Ingesta de Documentos"
          icon="▣"
          subtitle="PDF · DOCX · ANÁLISIS AUTOMÁTICO"
          status={docsLoading ? 'CARGANDO' : pendingDocs > 0 ? `${pendingDocs} PENDIENTES` : 'AL DÍA'}
          statusColor={docsLoading ? 'var(--txt-3)' : pendingDocs > 0 ? 'var(--amber)' : 'var(--green)'}
          onClick={() => onNavigate('documents')}
        >
          <DocsPreview docs={docs} loading={docsLoading} />
        </ModuleCard>

        <ModuleCard
          title="Redes Sociales"
          icon="◉"
          subtitle="X · TELEGRAM · MONITORIZACIÓN ZONAS"
          status={socialLoading ? 'CARGANDO' : `${posts.length} POSTS`}
          statusColor={socialLoading ? 'var(--txt-3)' : posts.length ? 'var(--accent)' : 'var(--amber)'}
          onClick={() => onNavigate('social')}
        >
          <SocialPreview posts={posts} loading={socialLoading} />
        </ModuleCard>
      </div>

      {/* Recent alerts strip */}
      {alerts.length > 0 && (
        <div style={{
          flexShrink: 0, background: 'var(--bg-1)',
          border: '1px solid var(--border)', borderRadius: '3px',
          padding: '8px 14px',
        }}>
          <div style={{ fontSize:'var(--label-xs)', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginBottom:'8px' }}>
            ALERTAS RECIENTES
          </div>
          <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'4px' }}>
            {alerts.map(a => (
              <div
                key={a.id}
                onClick={() => onNavigate('tactical')}
                style={{
                  flexShrink: 0, padding: '6px 10px',
                  background: 'var(--bg-2)',
                  border: `1px solid ${SEV_COLOR[a.severity]}33`,
                  borderLeft: `3px solid ${SEV_COLOR[a.severity]}`,
                  borderRadius: '2px', cursor: 'pointer',
                  minWidth: '200px', maxWidth: '280px',
                }}
              >
                <div style={{ fontFamily:'var(--mono)', fontSize:'var(--label-xs)', color: SEV_COLOR[a.severity], letterSpacing:'.1em', textTransform:'uppercase' }}>
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
