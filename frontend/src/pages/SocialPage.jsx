import { useState, useMemo, useEffect } from 'react'
import { useSocialFeed } from '../hooks/useSocialFeed'
import { useSourceFavorites } from '../hooks/useSourceFavorites'
import FilterGroup from '../components/FilterGroup'
import { LoadingCards } from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'

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

// ── Modal ──────────────────────────────────────────────────────────────────────

function TweetModal({ post, onClose }) {
  const color   = CAT_COLOR[post.category] || '#888'
  const initial = (post.handle || '?')[0].toUpperCase()
  const pubDate = post.time
    ? new Date(post.time).toLocaleString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : ''

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
          width: '100%', maxWidth: '580px',
          background: 'var(--bg-1)',
          border: `1px solid ${color}33`,
          borderTop: `4px solid ${color}`,
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: '85vh',
        }}
      >
        {post.media_url && post.media_type === 'photo' && (
          <div style={{ width: '100%', maxHeight: '260px', overflow: 'hidden', flexShrink: 0 }}>
            <img
              src={post.media_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
            />
          </div>
        )}
        {post.media_url && post.media_type !== 'photo' && (
          <a
            href={post.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', position: 'relative', flexShrink: 0 }}
          >
            <img
              src={post.media_url} alt=""
              style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block', opacity: 0.75 }}
              onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: '32px', background: 'rgba(0,0,0,0.6)',
                borderRadius: '50%', width: '56px', height: '56px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>▶</span>
            </div>
          </a>
        )}

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: `${color}22`, border: `1px solid ${color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: '700', color,
            }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--txt-1)', fontFamily: 'var(--mono)' }}>
                {post.display || post.handle}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--txt-3)', fontFamily: 'var(--mono)' }}>
                @{post.handle} · {pubDate}
              </div>
            </div>
            <span style={{
              fontSize: '8px', fontWeight: '700', letterSpacing: '.08em',
              padding: '2px 7px', borderRadius: '2px',
              background: `${color}18`, color, border: `1px solid ${color}44`,
              fontFamily: 'var(--mono)', flexShrink: 0,
            }}>
              {CAT_LABELS[post.category] || post.category}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'var(--txt-3)',
                cursor: 'pointer', fontSize: '18px', lineHeight: 1,
                padding: '2px 6px', flexShrink: 0,
              }}
            >×</button>
          </div>

          <div style={{
            fontSize: '14px', color: 'var(--txt-1)', lineHeight: 1.65,
            marginBottom: '20px', wordBreak: 'break-word',
          }}>
            {post.content}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            marginBottom: '20px',
            fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--txt-3)',
          }}>
            <span>❤ {(post.likes || 0).toLocaleString()}</span>
            <span>🔁 {(post.retweets || 0).toLocaleString()}</span>
          </div>

          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '8px 20px',
                background: 'rgba(0,200,255,0.1)',
                border: '1px solid rgba(0,200,255,0.35)',
                borderRadius: '2px',
                color: 'var(--cyan)',
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '.1em',
                textDecoration: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,200,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,200,255,0.1)'}
            >
              VER EN X ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Grid Card ──────────────────────────────────────────────────────────────────

function SocialCard({ post, onClick, isFav, onToggleFav }) {
  const color = CAT_COLOR[post.category] || '#888'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderTop: `3px solid ${color}`,
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'border-color .15s',
        overflow: 'hidden',
        minHeight: '150px',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-md)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {post.media_url && (
        <div style={{ width: '100%', height: '160px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
          <img
            src={post.media_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
          />
          {post.media_type !== 'photo' && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: '22px', background: 'rgba(0,0,0,0.55)',
                borderRadius: '50%', width: '40px', height: '40px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>▶</span>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
          <span style={{
            fontSize: 'var(--label-md)', fontFamily: 'var(--mono)', color,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, fontWeight: '700',
          }}>
            @{post.handle}
          </span>
          <span style={{ fontSize: 'var(--label-sm)', fontFamily: 'var(--mono)', color: 'var(--txt-3)', flexShrink: 0 }}>
            {timeAgo(post.time)}
          </span>
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

        {post.display && (
          <div style={{ fontSize: 'var(--label-sm)', color: 'var(--txt-3)', fontFamily: 'var(--mono)', marginBottom: '6px' }}>
            {post.display}
          </div>
        )}

        <div style={{
          fontSize: 'var(--body-sm)', color: 'var(--txt-1)', lineHeight: 1.5,
          flex: 1, marginBottom: '8px',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>
          {post.content}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.08em',
            padding: '1px 5px', borderRadius: '2px',
            background: `${color}18`, color, border: `1px solid ${color}44`,
            fontFamily: 'var(--mono)', flexShrink: 0,
          }}>
            {CAT_LABELS[post.category] || post.category}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
            ❤ {(post.likes || 0).toLocaleString()}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
            🔁 {(post.retweets || 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const { posts, categories, zones, loading, lastUpdate } = useSocialFeed()
  const { isFavorite, toggleFavorite, canAddMore } = useSourceFavorites()

  const [catFilter,  setCatFilter]  = useState('TODAS')
  const [zoneFilter, setZoneFilter] = useState('TODAS')
  const [query,      setQuery]      = useState('')
  const [modalPost,  setModalPost]  = useState(null)

  const filtered = useMemo(() => posts.filter(p => {
    if (catFilter  !== 'TODAS' && p.category !== catFilter)               return false
    if (zoneFilter !== 'TODAS' && p.zone     !== zoneFilter)              return false
    if (query && !p.content?.toLowerCase().includes(query.toLowerCase())) return false
    return true
  }), [posts, catFilter, zoneFilter, query])

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {modalPost && (
        <TweetModal post={modalPost} onClose={() => setModalPost(null)} />
      )}

      <aside style={{
        width: '180px', flexShrink: 0,
        background: 'var(--bg-1)', borderRight: '1px solid var(--border-md)',
        padding: '12px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <div>
          <div style={{ fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-2)', textTransform: 'uppercase', marginBottom: '6px' }}>
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
              fontFamily: 'var(--mono)', fontSize: 'var(--label-md)',
              padding: '5px 7px', outline: 'none',
            }}
          />
        </div>

        <FilterGroup
          label="CATEGORÍA"
          options={categories}
          value={catFilter}
          onChange={setCatFilter}
          labelFn={c => CAT_LABELS[c] || c}
          allLabel="TODAS"
        />
        <FilterGroup
          label="ZONA"
          options={zones}
          value={zoneFilter}
          onChange={setZoneFilter}
          allLabel="TODAS"
        />
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
          padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-2)', textTransform: 'uppercase' }}>
            SOCIAL INTELLIGENCE · X/TWITTER
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-md)', color: 'var(--txt-3)', marginLeft: 'auto' }}>
            {loading ? 'Cargando…' : `${posts.length} tweets · actualizado ${lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}`}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading && <LoadingCards count={12} />}
          {!loading && filtered.length === 0 && (
            <EmptyState
              title={posts.length === 0 ? 'SIN TWEETS' : 'SIN RESULTADOS'}
              subtitle={posts.length === 0 ? 'INGESTOR SOCIAL INACTIVO' : 'AJUSTA LOS FILTROS ACTIVOS'}
              icon="◈"
            />
          )}
          {!loading && filtered.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '10px',
            }}>
              {filtered.map(post => (
                <SocialCard
                  key={post.tweet_id}
                  post={post}
                  onClick={() => setModalPost(post)}
                  isFav={isFavorite('social', post.handle)}
                  onToggleFav={() => {
                    if (!isFavorite('social', post.handle) && !canAddMore('social')) return
                    toggleFavorite('social', post.handle, post.display || post.handle)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
