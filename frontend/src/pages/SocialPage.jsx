import { useState, useMemo } from 'react'
import { useSocialFeed } from '../hooks/useSocialFeed'

const CAT_LABELS = {
  us_gov:         'US Gov',
  us_mil:         'US Mil',
  europe:         'Europa',
  nato_eu:        'OTAN/EU',
  russia:         'Rusia',
  ukraine:        'Ucrania',
  middle_east:    'Oriente Medio',
  middle_east_mil:'OM Mil',
  asia_pacific:   'Asia-Pac',
  china_state:    'China',
  latam:          'LATAM',
  intl_org:       'Org. Intl',
  think_tank:     'Think Tanks',
  media:          'Medios',
}

const CAT_COLOR = {
  us_gov:         '#00c8ff',
  us_mil:         '#4fc3f7',
  europe:         '#81d4fa',
  nato_eu:        '#29b6f6',
  russia:         '#ef5350',
  ukraine:        '#ffca28',
  middle_east:    '#ff7043',
  middle_east_mil:'#ff3b4a',
  asia_pacific:   '#66bb6a',
  china_state:    '#ef5350',
  latam:          '#ab47bc',
  intl_org:       '#26c6da',
  think_tank:     '#00e5a0',
  media:          '#bdbdbd',
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60)    return `${diff}s`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function MediaBlock({ url, type, tweetUrl }) {
  if (!url) return null
  if (type === 'photo') {
    return (
      <img
        src={url}
        alt=""
        style={{
          width: '100%', maxHeight: '200px', objectFit: 'cover',
          borderRadius: '2px', display: 'block', marginBottom: '8px', opacity: 0.9,
        }}
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    )
  }
  return (
    <a href={tweetUrl} target="_blank" rel="noopener noreferrer"
      style={{ display: 'block', position: 'relative', marginBottom: '8px' }}>
      <img
        src={url} alt=""
        style={{
          width: '100%', maxHeight: '160px', objectFit: 'cover',
          borderRadius: '2px', display: 'block', opacity: 0.75,
        }}
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: '28px', background: 'rgba(0,0,0,0.55)',
          borderRadius: '50%', width: '48px', height: '48px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>▶</span>
      </div>
    </a>
  )
}

function TweetCard({ post }) {
  const color = CAT_COLOR[post.category] || '#888'
  return (
    <div
      style={{
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: '8px', fontWeight: '700',
          color, background: `${color}18`, border: `1px solid ${color}44`,
          padding: '1px 6px', borderRadius: '2px', letterSpacing: '.08em', flexShrink: 0,
        }}>
          {CAT_LABELS[post.category] || post.category}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--cyan)', letterSpacing: '.04em' }}>
          @{post.handle}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', marginLeft: 'auto', flexShrink: 0 }}>
          {timeAgo(post.time)}
        </span>
      </div>

      <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>
        {post.display}
      </div>

      <MediaBlock url={post.media_url} type={post.media_type} tweetUrl={post.url} />

      <div style={{ fontSize: '11px', color: 'var(--txt-1)', lineHeight: 1.6, marginBottom: '8px', wordBreak: 'break-word' }}>
        {post.content}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
          ❤ {(post.likes || 0).toLocaleString()}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)' }}>
          🔁 {(post.retweets || 0).toLocaleString()}
        </span>
        <a
          href={post.url} target="_blank" rel="noopener noreferrer"
          style={{
            marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '9px',
            color: 'var(--cyan)', textDecoration: 'none', letterSpacing: '.06em',
          }}
        >
          Ver en X ↗
        </a>
      </div>
    </div>
  )
}

export default function SocialPage() {
  const { posts, categories, zones, loading, lastUpdate } = useSocialFeed()

  const [catFilter,  setCatFilter]  = useState('TODAS')
  const [zoneFilter, setZoneFilter] = useState('TODAS')
  const [query,      setQuery]      = useState('')

  const filtered = useMemo(() => posts.filter(p => {
    if (catFilter  !== 'TODAS' && p.category !== catFilter)                   return false
    if (zoneFilter !== 'TODAS' && p.zone     !== zoneFilter)                  return false
    if (query && !p.content?.toLowerCase().includes(query.toLowerCase()))     return false
    return true
  }), [posts, catFilter, zoneFilter, query])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' }}>

      <div style={{
        background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>
          SOCIAL INTELLIGENCE · X/TWITTER
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--txt-3)', marginLeft: 'auto' }}>
          {loading ? 'Cargando…' : `${posts.length} tweets · actualizado ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        <aside style={{
          width: '160px', flexShrink: 0,
          background: 'var(--bg-1)', borderRight: '1px solid var(--border-md)',
          padding: '12px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>

          <div>
            <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
              BUSCAR
            </div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="palabra clave…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: '2px', color: 'var(--txt-1)',
                fontFamily: 'var(--mono)', fontSize: '9px',
                padding: '5px 7px', outline: 'none',
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
              CATEGORÍA
            </div>
            {['TODAS', ...categories].map(c => (
              <button key={c} onClick={() => setCatFilter(c)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: catFilter === c ? 'rgba(0,200,255,0.08)' : 'none',
                border: 'none',
                borderLeft: `2px solid ${catFilter === c ? 'var(--cyan)' : 'transparent'}`,
                color: catFilter === c ? 'var(--cyan)' : 'var(--txt-3)',
                fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '.06em',
                padding: '4px 8px', cursor: 'pointer', transition: 'all .15s',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c === 'TODAS' ? 'TODAS' : (CAT_LABELS[c] || c)}
              </button>
            ))}
          </div>

          <div>
            <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
              ZONA
            </div>
            {['TODAS', ...zones].map(z => (
              <button key={z} onClick={() => setZoneFilter(z)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: zoneFilter === z ? 'rgba(0,200,255,0.08)' : 'none',
                border: 'none',
                borderLeft: `2px solid ${zoneFilter === z ? 'var(--cyan)' : 'transparent'}`,
                color: zoneFilter === z ? 'var(--cyan)' : 'var(--txt-3)',
                fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '.06em',
                padding: '4px 8px', cursor: 'pointer', transition: 'all .15s',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase',
              }}>
                {z.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </aside>

        <main style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)' }}>
              Cargando feed…
            </div>
          )}
          {!loading && (
            <>
              <div style={{ marginBottom: '10px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt-3)' }}>
                {filtered.length} publicaciones
                {filtered.length === 0 && posts.length === 0 && (
                  <span style={{ marginLeft: '12px', color: 'rgba(0,200,255,0.4)' }}>
                    · Ingestor social no activo o sin tweets aún
                  </span>
                )}
              </div>
              {filtered.map(post => <TweetCard key={post.tweet_id} post={post} />)}
              {filtered.length === 0 && posts.length > 0 && (
                <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt-3)' }}>
                  Sin resultados para los filtros actuales
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
