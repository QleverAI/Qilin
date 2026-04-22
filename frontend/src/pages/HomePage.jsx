import { useMemo } from 'react'
import { useNewsFeed }        from '../hooks/useNewsFeed'
import { useDocsFeed }        from '../hooks/useDocsFeed'
import { useSocialFeed }      from '../hooks/useSocialFeed'
import { useFavorites }       from '../hooks/useFavorites'
import { useSourceFavorites } from '../hooks/useSourceFavorites'
import { useReports }         from '../hooks/useReports'
import { apiFetchBlob }       from '../hooks/apiClient'
import { SEV_COLOR }          from '../lib/severity'

// ── Report card ───────────────────────────────────────────────────────────────
function ReportCard({ report, label }) {
  async function handleDownload() {
    if (!report) return
    try {
      const blob = await apiFetchBlob(`/api/reports/${report.id}/download`)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = report.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const date = report
    ? new Date(report.period_start).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    : null

  return (
    <div style={{
      flex: 1, background: 'var(--bg-1)',
      border: `1px solid ${report ? 'rgba(200,160,60,0.3)' : 'var(--border)'}`,
      borderRadius: '3px', padding: '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      opacity: report ? 1 : 0.5,
    }}>
      <div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
          fontWeight: '700', letterSpacing: '.12em',
          color: 'var(--accent)', textTransform: 'uppercase',
        }}>
          {label}
        </div>
        {report ? (
          <>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-md)', color: 'var(--txt-2)', marginTop: '3px' }}>
              {date} · {report.alert_count} alertas · sev {report.top_severity}/10
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', marginTop: '1px' }}>
              {report.file_size_kb ? `${(report.file_size_kb / 1024).toFixed(1)} MB` : ''}
            </div>
          </>
        ) : (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-md)', color: 'var(--txt-3)', marginTop: '3px' }}>
            Sin informe generado
          </div>
        )}
      </div>
      {report && (
        <button
          onClick={handleDownload}
          style={{
            background: 'rgba(200,160,60,0.1)', border: '1px solid rgba(200,160,60,0.3)',
            borderRadius: '3px', color: 'var(--accent)',
            fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
            padding: '5px 12px', cursor: 'pointer', letterSpacing: '.06em', flexShrink: 0,
          }}
        >↓ PDF</button>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      borderRadius: '3px', padding: '10px 14px', flexShrink: 0,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700',
        letterSpacing: '.18em', color: 'var(--accent)', textTransform: 'uppercase',
        marginBottom: '8px',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// ── HomePage ──────────────────────────────────────────────────────────────────
export default function HomePage({ aircraft, alerts, onNavigate }) {
  const { articles, loading: newsLoading }    = useNewsFeed()
  const { docs,     loading: docsLoading }    = useDocsFeed()
  const { posts,    loading: socialLoading }  = useSocialFeed()
  const { favorites: aircraftFavs }           = useFavorites()
  const { favorites: srcFavs }                = useSourceFavorites()
  const { daily, weekly, loading: reportsLoading } = useReports()

  // Señales convergentes
  const signals = useMemo(() => {
    const now      = Date.now()
    const window1h = 60 * 60 * 1000
    const zones    = {}
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

  // Noticias personalizadas o generalistas
  const newsItems = useMemo(() => {
    if (srcFavs.news.length > 0) {
      const favSources = new Set(srcFavs.news.map(f => f.source_id))
      return articles.filter(a => favSources.has(a.source)).slice(0, 4)
    }
    return [...articles]
      .sort((a, b) => {
        const sev = { high: 3, medium: 2, low: 1 }
        return (sev[b.severity] || 0) - (sev[a.severity] || 0)
      })
      .slice(0, 4)
  }, [articles, srcFavs.news])

  // Posts de cuentas favoritas
  const socialItems = useMemo(() => {
    if (srcFavs.social.length === 0) return []
    const favHandles = new Set(srcFavs.social.map(f => f.source_id))
    return posts.filter(p => favHandles.has(p.handle)).slice(0, 4)
  }, [posts, srcFavs.social])

  // Docs de orgs favoritas
  const docItems = useMemo(() => {
    if (srcFavs.docs.length === 0) return []
    const favOrgs = new Set(srcFavs.docs.map(f => f.source_id))
    return docs.filter(d => favOrgs.has(d.source)).slice(0, 4)
  }, [docs, srcFavs.docs])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflowY: 'auto', background: 'var(--bg-0)',
      padding: '16px 20px', gap: '10px',
    }}>

      {/* 1. Status strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '10px 16px', background: 'var(--bg-1)',
        border: '1px solid var(--border)', borderRadius: '3px',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.16em', color: 'var(--txt-2)', textTransform: 'uppercase', flexShrink: 0 }}>
          ESTADO DEL SISTEMA
        </div>
        {[
          { label: 'ADS-B',    color: 'var(--green)', val: `${aircraft.length} aeronaves` },
          { label: 'ALERTAS',  color: alerts.length > 0 ? 'var(--red)' : 'var(--green)', val: `${alerts.length} activas` },
          { label: 'NOTICIAS', color: newsLoading ? 'var(--txt-3)' : articles.length ? 'var(--green)' : 'var(--amber)', val: newsLoading ? '…' : `${articles.length} artículos` },
          { label: 'INFORMES', color: reportsLoading ? 'var(--txt-3)' : (daily || weekly) ? 'var(--green)' : 'var(--amber)', val: reportsLoading ? '…' : (daily ? 'diario disponible' : 'sin informes') },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: item.color, animation: 'blink 2.4s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', letterSpacing: '.1em' }}>{item.label}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: item.color }}>{item.val}</span>
          </div>
        ))}
      </div>

      {/* 2. Informes (siempre) */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.2em', color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: '6px' }}>
          INFORMES GENERADOS
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReportCard report={daily}  label="INFORME DIARIO"  />
          <ReportCard report={weekly} label="INFORME SEMANAL" />
        </div>
      </div>

      {/* 3. Señales convergentes (condicional) */}
      {signals.length > 0 && (
        <div style={{
          background: 'var(--bg-1)', border: '1px solid rgba(244,63,94,0.25)',
          borderLeft: '3px solid var(--red)', borderRadius: '3px',
          padding: '10px 14px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)', animation: 'blink 1.2s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-xs)', fontWeight: '700', letterSpacing: '.2em', color: 'var(--red)', textTransform: 'uppercase' }}>SEÑALES CONVERGENTES</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-xs)', color: 'var(--txt-3)', marginLeft: 'auto' }}>{signals.length} zona{signals.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {signals.map(({ zone, sources }) => (
              <div key={zone} style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '3px', padding: '8px 12px', minWidth: '160px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', color: 'var(--txt-1)', letterSpacing: '.08em', marginBottom: '5px', textTransform: 'uppercase' }}>
                  {zone.replace(/_/g, ' ')}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {sources.map(s => (
                    <span key={s} style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-xs)', color: 'var(--red)', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', padding: '1px 6px', borderRadius: '2px', letterSpacing: '.06em' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Aeronaves favoritas o stats genéricos */}
      {aircraftFavs.length > 0 ? (
        <Section label={`★ MIS AERONAVES · ${aircraftFavs.length}`}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {aircraftFavs.map(fav => {
              const live = aircraft.find(a => a.id === fav.icao24)
              return (
                <div
                  key={fav.icao24}
                  style={{
                    background: 'var(--bg-2)', borderRadius: '3px', padding: '6px 12px',
                    border: `1px solid ${live ? 'rgba(79,156,249,0.35)' : 'var(--border)'}`,
                    opacity: live ? 1 : 0.55,
                  }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-md)', fontWeight: '700', color: 'var(--accent)' }}>
                    {fav.callsign || fav.icao24}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', marginTop: '2px' }}>
                    {live ? (live.altitude != null ? `${live.altitude} ft` : 'En tierra') : 'Sin datos recientes'}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      ) : (
        <Section label="SITUACIÓN AÉREA">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              { label: 'AERONAVES', value: aircraft.length,                                color: 'var(--accent)' },
              { label: 'MILITARES', value: aircraft.filter(a => a.type === 'military').length, color: 'var(--red)'    },
              { label: 'CIVILES',   value: aircraft.filter(a => a.type === 'civil').length,    color: 'var(--txt-2)'  },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg-2)', padding: '10px 12px', borderRadius: '2px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '24px', fontWeight: '500', color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 'var(--label-sm)', letterSpacing: '.12em', color: 'var(--txt-3)', textTransform: 'uppercase', marginTop: '3px' }}>{label}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 5. Cuentas sociales favoritas (condicional) */}
      {srcFavs.social.length > 0 && (
        <Section label={`★ MIS CUENTAS SOCIALES · ${srcFavs.social.slice(0, 3).map(f => f.source_name || f.source_id).join(', ')}`}>
          {socialLoading ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>Cargando…</div>
          ) : socialItems.length === 0 ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>Sin publicaciones recientes de tus cuentas favoritas</div>
          ) : socialItems.map((p, i) => (
            <div key={p.tweet_id} style={{
              display: 'flex', gap: '10px', padding: '5px 0',
              borderBottom: i < socialItems.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--accent)', flexShrink: 0, minWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{p.handle}
              </span>
              <span style={{ fontSize: 'var(--label-sm)', color: 'var(--txt-2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {p.content}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* 6. Noticias (siempre: personalizado o generalista) */}
      <Section label={srcFavs.news.length > 0 ? `★ MIS PORTALES · ${srcFavs.news.slice(0, 2).map(f => f.source_name || f.source_id).join(', ')}` : 'ÚLTIMAS NOTICIAS'}>
        {newsLoading ? (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>Cargando…</div>
        ) : newsItems.length === 0 ? (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>Sin artículos disponibles</div>
        ) : newsItems.map((n, i) => (
          <div key={n.id || n.url} style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '5px 0',
            borderBottom: i < newsItems.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: SEV_COLOR[n.severity] || 'var(--txt-3)', flexShrink: 0, marginTop: '4px' }} />
            <span style={{ fontSize: 'var(--label-sm)', color: 'var(--txt-1)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {n.title}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', flexShrink: 0 }}>
              {n.source}
            </span>
          </div>
        ))}
      </Section>

      {/* 7. Organizaciones de docs favoritas (condicional) */}
      {srcFavs.docs.length > 0 && (
        <Section label={`★ MIS ORGANIZACIONES · ${srcFavs.docs.slice(0, 2).map(f => f.source_name || f.source_id).join(', ')}`}>
          {docsLoading ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>Cargando…</div>
          ) : docItems.length === 0 ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>Sin documentos recientes de tus organizaciones favoritas</div>
          ) : docItems.map((d, i) => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0',
              borderBottom: i < docItems.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', flexShrink: 0 }}>[DOC]</span>
              <span style={{ fontSize: 'var(--label-sm)', color: 'var(--txt-1)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{d.title}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', flexShrink: 0 }}>{d.source}</span>
            </div>
          ))}
        </Section>
      )}

      {/* 8. Alertas activas (condicional) */}
      {alerts.length > 0 && (
        <div style={{
          flexShrink: 0, background: 'var(--bg-1)',
          border: '1px solid var(--border)', borderRadius: '3px', padding: '10px 14px',
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.2em', color: 'var(--red)', textTransform: 'uppercase', marginBottom: '8px' }}>
            ALERTAS ACTIVAS · {alerts.length}
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
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
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-xs)', color: SEV_COLOR[a.severity], letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  {a.severity} · {a.zone}
                </div>
                <div style={{ fontSize: 'var(--label-sm)', color: 'var(--txt-1)', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
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
