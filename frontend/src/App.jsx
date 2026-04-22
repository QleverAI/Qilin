import { useState, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import ProtectedRoute    from './components/ProtectedRoute'
import TopBar            from './components/TopBar'
import TacticalPanel     from './components/TacticalPanel'
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
import MarketsPage       from './pages/MarketsPage'
import PolymarketPage    from './pages/PolymarketPage'
import ProfilePage       from './pages/ProfilePage'
import PlansPage         from './pages/PlansPage'
import LoadingState      from './components/LoadingSkeleton'
import { useQilinData }  from './hooks/useQilinData'
import { clearProfileCache } from './hooks/useProfile'
import { useAircraftTrail } from './hooks/useAircraftTrail'
import { useVesselTrail }   from './hooks/useVesselTrail'

const MapView = lazy(() => import('./components/MapView'))

// ── Dashboard shell — all /app/* views ───────────────────────────────────────
function AppShell() {
  const [view, setView] = useState('home')
  const [flyTarget,        setFlyTarget]        = useState(null)
  const [selectedAircraft, setSelectedAircraft] = useState(null)
  const [selectedVessel,   setSelectedVessel]   = useState(null)
  const navigate = useNavigate()

  function handleLogout() {
    clearProfileCache()
    sessionStorage.removeItem('qilin_token')
    sessionStorage.removeItem('qilin_user')
    navigate('/login')
  }

  function handleSelectVessel(raw) {
    if (!raw) { setSelectedVessel(null); return }
    const mmsi = raw.mmsi || raw.id
    const full = vessels.find(v => (v.mmsi || v.id) === mmsi) || raw
    setSelectedVessel(full)
  }

  const { aircraft, vessels, alerts, stats, wsStatus } = useQilinData()
  const { trails, addTrail, removeTrail, clearAll } = useAircraftTrail()
  const { vesselTrails, addVesselTrail, removeVesselTrail, clearAllVesselTrails } = useVesselTrail()

  // Tactical grid
  if (view === 'tactical') {
    return (
      <div style={{ display:'grid', gridTemplateRows:'52px 1fr 44px',
        gridTemplateColumns:'1fr 340px', height:'100vh', width:'100vw', overflow:'hidden' }}>
        <TopBar alertsTotal={stats.alertsTotal} wsStatus={wsStatus} currentView={view}
          onNavigate={setView} onLogout={handleLogout} />
        <Suspense fallback={
          <div style={{ gridColumn:1, gridRow:2, display:'flex', alignItems:'center',
            justifyContent:'center', background:'var(--bg-0)' }}>
            <LoadingState message="CARGANDO MAPA..." variant="map" />
          </div>
        }>
          <MapView aircraft={aircraft} vessels={vessels} alerts={[]} flyTarget={flyTarget}
            trails={trails} onAddTrail={addTrail} onRemoveTrail={removeTrail} onClearTrails={clearAll}
            vesselTrails={vesselTrails}
            onSelectAircraft={setSelectedAircraft} onSelectVessel={handleSelectVessel} />
        </Suspense>
        <aside style={{ gridColumn:2, gridRow:2, display:'flex', flexDirection:'column',
          background:'var(--bg-1)', borderLeft:'1px solid var(--border-md)', overflow:'hidden' }}>
          <TacticalPanel
            selectedAircraft={selectedAircraft}
            onClose={() => setSelectedAircraft(null)}
            trails={trails}
            onAddTrail={addTrail}
            onRemoveTrail={removeTrail}
            onFlyTo={(icao24) => {
              const a = aircraft.find(x => x.id === icao24)
              if (a) setFlyTarget({ lon: a.lon, lat: a.lat })
            }}
            selectedVessel={selectedVessel}
            onSelectVessel={handleSelectVessel}
            vesselTrails={vesselTrails}
            onAddVesselTrail={addVesselTrail}
            onRemoveVesselTrail={removeVesselTrail}
            onFlyToVessel={(mmsi) => {
              const v = vessels.find(x => (x.mmsi || x.id) === mmsi)
              if (v) setFlyTarget({ lon: v.lon, lat: v.lat })
            }}
          />
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
        onNavigate={setView} onLogout={handleLogout} />
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {view === 'home'       && <HomePage aircraft={aircraft} alerts={alerts} onNavigate={setView} />}
        {view === 'news'       && <NewsPage />}
        {view === 'documents'  && <DocumentsPage />}
        {view === 'social'     && <SocialPage />}
        {view === 'sentinel'   && <SentinelPage />}
        {view === 'markets'    && <MarketsPage />}
        {view === 'polymarket' && <PolymarketPage />}
        {view === 'profile'   && <ProfilePage onNavigate={setView} />}
        {view === 'plans'     && <PlansPage   onNavigate={setView} />}
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
