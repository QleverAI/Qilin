import { useState, useMemo, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import ProtectedRoute    from './components/ProtectedRoute'
import TopBar            from './components/TopBar'
import AnalystView       from './components/AnalystView'
import AlertPanel        from './components/AlertPanel'
import FilterPanel       from './components/FilterPanel'
import BottomBar         from './components/BottomBar'
import ChatBot           from './components/ChatBot'
import LandingPage       from './pages/LandingPage'
import LoginPage         from './pages/LoginPage'
import RegisterPage      from './pages/RegisterPage'
import HomePage          from './pages/HomePage'
import NewsPage          from './pages/NewsPage'
import DocumentsPage     from './pages/DocumentsPage'
import SocialPage        from './pages/SocialPage'
import SentinelPage      from './pages/SentinelPage'
import FilingsPage       from './pages/FilingsPage'
import PolymarketPage    from './pages/PolymarketPage'
import LoadingState      from './components/LoadingSkeleton'
import { useQilinData }  from './hooks/useQilinData'
import { useAircraftTrail } from './hooks/useAircraftTrail'

const MapView = lazy(() => import('./components/MapView'))

const DEFAULT_FILTERS = {
  civil:             true,
  military_aircraft: true,
  vip:               true,
  alerts:            true,
}

function initUser() {
  const token    = sessionStorage.getItem('qilin_token')
  const username = sessionStorage.getItem('qilin_user')
  return token ? { username, token } : null
}

// ── Dashboard shell — all /app/* views ───────────────────────────────────────
function AppShell() {
  const [user,       setUser]       = useState(initUser)
  const [activeView, setActiveView] = useState('map')
  const [view,       setView]       = useState('home')
  const [filters,    setFilters]    = useState(DEFAULT_FILTERS)
  const [flyTarget,  setFlyTarget]  = useState(null)
  const navigate = useNavigate()

  const { aircraft, alerts, stats, wsStatus } = useQilinData()
  const { trails, addTrail, removeTrail, clearAll } = useAircraftTrail()

  function toggleFilter(key) {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const visibleAircraft = useMemo(() => aircraft.filter(a => {
    if (a.type === 'military') return filters.military_aircraft
    if (a.type === 'vip')      return filters.vip
    return filters.civil
  }), [aircraft, filters])

  const visibleAlerts = useMemo(() =>
    filters.alerts ? alerts : []
  , [alerts, filters])

  const counts = useMemo(() => ({
    civil:             aircraft.filter(a => a.type === 'civil').length,
    military_aircraft: aircraft.filter(a => a.type === 'military').length,
    vip:               aircraft.filter(a => a.type === 'vip').length,
    alerts:            alerts.length,
  }), [aircraft, alerts])

  // Analyst view
  if (activeView === 'analyst') {
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
        <TopBar alertsTotal={stats.alertsTotal} wsStatus={wsStatus} currentView={view}
          onNavigate={v => { setView(v); setActiveView('map') }}
          activeMode={activeView} onModeChange={setActiveView} />
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <AnalystView />
        </div>
        <ChatBot />
      </div>
    )
  }

  // Tactical grid
  if (view === 'tactical') {
    return (
      <div style={{ display:'grid', gridTemplateRows:'52px 1fr 44px',
        gridTemplateColumns:'1fr 340px', height:'100vh', width:'100vw', overflow:'hidden' }}>
        <TopBar alertsTotal={stats.alertsTotal} wsStatus={wsStatus} currentView={view}
          onNavigate={setView} activeMode={activeView} onModeChange={setActiveView} />
        <Suspense fallback={
          <div style={{ gridColumn:1, gridRow:2, display:'flex', alignItems:'center',
            justifyContent:'center', background:'var(--bg-0)' }}>
            <LoadingState message="CARGANDO MAPA..." variant="map" />
          </div>
        }>
          <MapView aircraft={visibleAircraft} alerts={visibleAlerts} flyTarget={flyTarget}
            trails={trails} onAddTrail={addTrail} onRemoveTrail={removeTrail} onClearTrails={clearAll} />
        </Suspense>
        <aside style={{ gridColumn:2, gridRow:2, display:'flex', flexDirection:'column',
          background:'var(--bg-1)', borderLeft:'1px solid var(--border-md)', overflow:'hidden' }}>
          <FilterPanel filters={filters} onToggle={toggleFilter} counts={counts} />
          <AlertPanel alerts={visibleAlerts} stats={stats}
            onAlertClick={a => setFlyTarget({ lon: a.lon, lat: a.lat })} />
        </aside>
        <BottomBar stats={stats} />
        <ChatBot />
      </div>
    )
  }

  // All other views
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <TopBar alertsTotal={stats.alertsTotal} wsStatus={wsStatus} currentView={view}
        onNavigate={setView} activeMode={activeView} onModeChange={setActiveView} />
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {view === 'home'       && <HomePage aircraft={aircraft} alerts={alerts} onNavigate={setView} />}
        {view === 'news'       && <NewsPage />}
        {view === 'documents'  && <DocumentsPage />}
        {view === 'social'     && <SocialPage />}
        {view === 'sentinel'   && <SentinelPage />}
        {view === 'markets'    && <FilingsPage />}
        {view === 'polymarket' && <PolymarketPage />}
      </div>
      <ChatBot />
    </div>
  )
}

// ── Root router ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route path="/"         element={<LandingPage />} />
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/app"      element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
      <Route path="/app/*"    element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
    </Routes>
  )
}
