import { useState, useMemo } from 'react'
import TopBar        from './components/TopBar'
import AnalystView   from './components/AnalystView'
import MapView       from './components/MapView'
import AlertPanel    from './components/AlertPanel'
import FilterPanel   from './components/FilterPanel'
import BottomBar     from './components/BottomBar'
import LoginPage     from './pages/LoginPage'
import HomePage      from './pages/HomePage'
import NewsPage      from './pages/NewsPage'
import DocumentsPage from './pages/DocumentsPage'
import SocialPage    from './pages/SocialPage'
import FilingsPage   from './pages/FilingsPage'
import { useQilinData } from './hooks/useQilinData'

const DEFAULT_FILTERS = {
  civil:             true,
  military_aircraft: true,
  alerts:            true,
}

export default function App() {
  const [user,       setUser]       = useState(null)
  const [activeView, setActiveView] = useState('map')    // map | analyst
  const [view,       setView]       = useState('home')   // home | tactical | news | documents | social
  const [filters,    setFilters]    = useState(DEFAULT_FILTERS)
  const [flyTarget,  setFlyTarget]  = useState(null)

  const { aircraft, alerts, stats, wsStatus } = useQilinData()

  function toggleFilter(key) {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Filtered data for tactical view
  const visibleAircraft = useMemo(() => aircraft.filter(a =>
    a.type === 'military' ? filters.military_aircraft : filters.civil
  ), [aircraft, filters])

  const visibleAlerts = useMemo(() =>
    filters.alerts ? alerts : []
  , [alerts, filters])

  const counts = useMemo(() => ({
    civil:             aircraft.filter(a => a.type !== 'military').length,
    military_aircraft: aircraft.filter(a => a.type === 'military').length,
    alerts:            alerts.length,
  }), [aircraft, alerts])

  // ── Login ────────────────────────────────────────────────────────────────────
  if (!user) return <LoginPage onLogin={setUser} />

  // ── Top-level nav bar (fixed, always visible after login) ─────────────────
  const navBar = (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '40px',
      background: '#0f172a', zIndex: 100,
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      {['map', 'analyst'].map(v => (
        <button
          key={v}
          onClick={() => setActiveView(v)}
          style={{
            background:   activeView === v ? '#1e40af' : 'transparent',
            color:        activeView === v ? '#fff'    : '#94a3b8',
            border:       'none',
            borderRadius: '4px',
            padding:      '4px 12px',
            fontSize:     '12px',
            cursor:       'pointer',
            fontFamily:   'var(--ui)',
          }}
        >
          {v === 'map' ? '🗺️ Live Map' : '🔍 Analyst View'}
        </button>
      ))}
    </div>
  )

  // ── Analyst view ──────────────────────────────────────────────────────────
  if (activeView === 'analyst') {
    return (
      <>
        {navBar}
        <div style={{ marginTop: '40px', height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <AnalystView />
        </div>
      </>
    )
  }

  // ── Tactical view: dedicated full-grid layout ─────────────────────────────
  if (view === 'tactical') {
    return (
      <>
        {navBar}
        <div style={{
          display: 'grid',
          gridTemplateRows: '44px 1fr 36px',
          gridTemplateColumns: '1fr 340px',
          height: 'calc(100vh - 40px)', width: '100vw', overflow: 'hidden',
          marginTop: '40px',
        }}>
          <TopBar alertsTotal={stats.alertsTotal} wsStatus={wsStatus} currentView={view} onNavigate={setView} />

          <MapView
            aircraft={visibleAircraft}
            alerts={visibleAlerts}
            flyTarget={flyTarget}
          />

          <aside style={{
            gridColumn:2, gridRow:2,
            display:'flex', flexDirection:'column',
            background:'var(--bg-1)',
            borderLeft:'1px solid var(--border-md)',
            overflow:'hidden',
          }}>
            <FilterPanel filters={filters} onToggle={toggleFilter} counts={counts} />
            <AlertPanel
              alerts={visibleAlerts}
              stats={stats}
              onAlertClick={a => setFlyTarget({ lon: a.lon, lat: a.lat })}
            />
          </aside>

          <BottomBar stats={stats} />
        </div>
      </>
    )
  }

  // ── All other views: topbar + content ─────────────────────────────────────
  return (
    <>
      {navBar}
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 40px)', width: '100vw', overflow: 'hidden',
        marginTop: '40px',
      }}>
        <TopBar alertsTotal={stats.alertsTotal} wsStatus={wsStatus} currentView={view} onNavigate={setView} />

        {view === 'home' && (
          <HomePage
            aircraft={aircraft}
            alerts={alerts}
            onNavigate={setView}
          />
        )}
        {view === 'news'      && <NewsPage />}
        {view === 'documents' && <DocumentsPage />}
        {view === 'social'    && <SocialPage />}
        {view === 'markets'   && <FilingsPage />}
      </div>
    </>
  )
}
