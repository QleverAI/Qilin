import { useState, useMemo } from 'react'
import TopBar        from './components/TopBar'
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

  // ── Tactical view: dedicated full-grid layout ─────────────────────────────
  if (view === 'tactical') {
    return (
      <div style={{
        display: 'grid',
        gridTemplateRows: '44px 1fr 36px',
        gridTemplateColumns: '1fr 340px',
        height: '100vh', width: '100vw', overflow: 'hidden',
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
    )
  }

  // ── All other views: topbar + content ─────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh', width: '100vw', overflow: 'hidden',
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
  )
}
