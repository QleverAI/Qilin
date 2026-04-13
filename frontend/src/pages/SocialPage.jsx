import { useState } from 'react'
import { MOCK_POSTS, TRENDING_TOPICS, PLATFORM_COLORS } from '../data/mockSocial'

const SEV_COLOR = { negative:'var(--red)', neutral:'var(--amber)', positive:'var(--green)' }
const SEV_LABEL = { negative:'NEG', neutral:'NEU', positive:'POS' }

const ALL_ZONES     = ['TODAS', ...Array.from(new Set(MOCK_POSTS.map(p => p.zone)))]
const ALL_PLATFORMS = ['TODOS', 'X', 'Telegram']

function PlatformBadge({ platform }) {
  const color = PLATFORM_COLORS[platform] || '#888'
  return (
    <span style={{
      fontFamily:'var(--mono)', fontSize:'8px', fontWeight:'700',
      color, background:`${color}18`, border:`1px solid ${color}44`,
      padding:'1px 6px', borderRadius:'2px', letterSpacing:'.08em',
    }}>{platform}</span>
  )
}

function PostCard({ post }) {
  const sentColor = SEV_COLOR[post.sentiment]
  return (
    <div style={{
      padding: '11px 14px',
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: '3px',
      marginBottom: '6px',
      transition: 'border-color .15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,200,255,0.2)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'7px' }}>
        <PlatformBadge platform={post.platform} />
        <span style={{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--cyan)', letterSpacing:'.04em' }}>
          {post.user}
        </span>
        {post.verified && (
          <span style={{ fontSize:'10px', color:'#1d9bf0' }} title="Verificado">✓</span>
        )}
        <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>
          {post.time} UTC
        </span>
        <span style={{
          fontFamily:'var(--mono)', fontSize:'8px', letterSpacing:'.1em',
          color: sentColor, background:`${sentColor}18`,
          border:`1px solid ${sentColor}33`, padding:'1px 5px', borderRadius:'2px',
        }}>{SEV_LABEL[post.sentiment]}</span>
      </div>

      {/* Post text */}
      <div style={{ fontSize:'11px', color:'var(--txt-1)', lineHeight:1.6, marginBottom:'8px' }}>
        {post.text}
      </div>

      {/* Footer */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        {post.tags.map(t => (
          <span key={t} style={{
            fontSize:'8px', fontFamily:'var(--mono)', color:'var(--txt-3)',
            background:'var(--bg-3)', padding:'1px 5px', borderRadius:'2px',
            border:'1px solid var(--border)',
          }}>#{t}</span>
        ))}
        <span style={{ marginLeft:'auto', fontFamily:'var(--mono)', fontSize:'9px', color:'var(--txt-3)' }}>
          ↑ {post.engagements.toLocaleString()}
        </span>
        <span style={{
          fontFamily:'var(--mono)', fontSize:'9px', letterSpacing:'.08em', textTransform:'uppercase',
          padding:'1px 6px', background:'var(--bg-3)', border:'1px solid var(--border)',
          borderRadius:'2px', color:'var(--txt-3)',
        }}>{post.zone}</span>
      </div>
    </div>
  )
}

function TrendingPanel({ activeZone, onZoneClick }) {
  return (
    <div style={{
      background:'var(--bg-1)',
      borderBottom:'1px solid var(--border)',
      padding:'12px 16px',
      flexShrink:0,
    }}>
      <div style={{ fontSize:'8px', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginBottom:'10px' }}>
        TENDENCIAS POR ZONA
      </div>
      <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'4px' }}>
        {TRENDING_TOPICS.map(t => (
          <div
            key={t.topic}
            onClick={() => onZoneClick(t.zone === activeZone ? 'TODAS' : t.zone)}
            style={{
              flexShrink:0,
              padding:'7px 12px',
              background: t.zone === activeZone ? 'rgba(0,200,255,0.1)' : 'var(--bg-2)',
              border: `1px solid ${t.zone === activeZone ? 'rgba(0,200,255,0.4)' : 'var(--border)'}`,
              borderRadius:'3px',
              cursor:'pointer',
              transition:'all .15s',
            }}
          >
            <div style={{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--cyan)', marginBottom:'2px' }}>
              {t.topic}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:'11px', color:'var(--txt-1)', fontWeight:'600' }}>
                {(t.count/1000).toFixed(1)}K
              </span>
              <span style={{ fontFamily:'var(--mono)', fontSize:'9px', color:'var(--green)' }}>
                {t.delta}
              </span>
            </div>
            <div style={{ fontSize:'8px', color:'var(--txt-3)', marginTop:'2px', fontFamily:'var(--mono)' }}>
              {t.zone}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SocialPage() {
  const [zoneFilter,     setZoneFilter]     = useState('TODAS')
  const [platformFilter, setPlatformFilter] = useState('TODOS')
  const [sentFilter,     setSentFilter]     = useState('TODOS')

  const filtered = MOCK_POSTS.filter(p => {
    if (zoneFilter !== 'TODAS'     && p.zone !== zoneFilter)         return false
    if (platformFilter !== 'TODOS' && p.platform !== platformFilter) return false
    if (sentFilter !== 'TODOS'     && p.sentiment !== sentFilter)    return false
    return true
  })

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-0)' }}>

      {/* Trending strip */}
      <TrendingPanel activeZone={zoneFilter} onZoneClick={setZoneFilter} />

      {/* Content */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Sidebar filters */}
        <aside style={{
          width:'180px', flexShrink:0,
          background:'var(--bg-1)',
          borderRight:'1px solid var(--border-md)',
          padding:'14px 10px',
          overflowY:'auto',
          display:'flex', flexDirection:'column', gap:'18px',
        }}>
          <div>
            <div style={{ fontSize:'8px', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginBottom:'8px' }}>
              PLATAFORMA
            </div>
            {ALL_PLATFORMS.map(p => (
              <button key={p} onClick={() => setPlatformFilter(p)} style={{
                display:'block', width:'100%', textAlign:'left',
                background: platformFilter===p ? 'rgba(0,200,255,0.08)' : 'none',
                border:'none',
                borderLeft:`2px solid ${platformFilter===p ? 'var(--cyan)' : 'transparent'}`,
                color: platformFilter===p ? 'var(--cyan)' : 'var(--txt-3)',
                fontFamily:'var(--mono)', fontSize:'10px', letterSpacing:'.1em',
                padding:'5px 8px', cursor:'pointer', transition:'all .15s',
              }}>
                {p === 'TODOS' ? 'TODOS' : (
                  <span style={{ color: PLATFORM_COLORS[p] || 'inherit' }}>{p}</span>
                )}
              </button>
            ))}
          </div>

          <div>
            <div style={{ fontSize:'8px', fontWeight:'700', letterSpacing:'.2em', color:'var(--txt-3)', textTransform:'uppercase', marginBottom:'8px' }}>
              SENTIMIENTO
            </div>
            {['TODOS','negative','neutral','positive'].map(s => (
              <button key={s} onClick={() => setSentFilter(s)} style={{
                display:'block', width:'100%', textAlign:'left',
                background: sentFilter===s ? 'rgba(0,200,255,0.08)' : 'none',
                border:'none',
                borderLeft:`2px solid ${sentFilter===s ? 'var(--cyan)' : 'transparent'}`,
                color: sentFilter===s ? 'var(--cyan)' : 'var(--txt-3)',
                fontFamily:'var(--mono)', fontSize:'10px', letterSpacing:'.1em',
                padding:'5px 8px', cursor:'pointer', transition:'all .15s',
                textTransform:'uppercase',
              }}>
                {s === 'TODOS' ? 'TODOS' : (
                  <span style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:SEV_COLOR[s], display:'inline-block' }} />
                    {SEV_LABEL[s]}
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
                borderLeft:`2px solid ${zoneFilter===z ? 'var(--cyan)' : 'transparent'}`,
                color: zoneFilter===z ? 'var(--cyan)' : 'var(--txt-3)',
                fontFamily:'var(--mono)', fontSize:'10px', letterSpacing:'.08em',
                padding:'5px 8px', cursor:'pointer', transition:'all .15s',
                textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}>{z}</button>
            ))}
          </div>

          <div style={{ marginTop:'auto', padding:'10px 8px', background:'rgba(0,200,255,0.04)', border:'1px solid var(--border)', borderRadius:'3px' }}>
            <div style={{ fontSize:'8px', letterSpacing:'.12em', color:'var(--cyan)', fontFamily:'var(--mono)', marginBottom:'4px' }}>FUSIÓN IA</div>
            <div style={{ fontSize:'9px', color:'var(--txt-3)', lineHeight:1.5 }}>
              Próximamente: análisis de sentimiento automático y correlación con movimientos de entidades.
            </div>
          </div>
        </aside>

        {/* Feed */}
        <main style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
          <div style={{ marginBottom:'10px', fontFamily:'var(--mono)', fontSize:'10px', color:'var(--txt-3)' }}>
            {filtered.length} publicaciones
          </div>
          {filtered.map(post => <PostCard key={post.id} post={post} />)}
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px', fontFamily:'var(--mono)', fontSize:'11px', color:'var(--txt-3)' }}>
              No hay publicaciones para los filtros seleccionados
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
