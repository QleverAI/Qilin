import { useState, useEffect, lazy, Suspense, useMemo } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import ProtectedRoute    from './components/ProtectedRoute'
import TopBar            from './components/TopBar'
import TacticalPanel     from './components/TacticalPanel'
import BottomBar         from './components/BottomBar'
import ChatBot           from './components/ChatBot'
import LoadingState      from './components/LoadingSkeleton'
import { useQilinData }  from './hooks/useQilinData'
import { useProfile, clearProfileCache } from './hooks/useProfile'
import { useAircraftTrail } from './hooks/useAircraftTrail'
import { useVesselTrail }   from './hooks/useVesselTrail'
import { useAircraftHistory } from './hooks/useAircraftHistory'
import { usePlayback }        from './hooks/usePlayback'
import { clearFeedCache }   from './hooks/feedCache'
import { prefetchNewsFeed }      from './hooks/useNewsFeed'
import { prefetchSocialFeed }    from './hooks/useSocialFeed'
import { prefetchDocsFeed }      from './hooks/useDocsFeed'
import { prefetchMarkets }       from './hooks/useMarkets'
import { prefetchPolymarket }    from './hooks/usePolymarketFeed'
import { prefetchIntelTimeline } from './hooks/useIntelTimeline'

// ── Lazy-loaded pages/chunks ─────────────────────────────────────────────────
// Cada page se carga bajo demanda para evitar que todo el bundle inicial incluya
// MapLibre, dependencias de markets y demás. El first paint (landing/login) solo
// debería cargar su chunk + el runtime común de React/router.
const LandingPage   = lazy(() => import('./pages/LandingPage'))
const LoginPage     = lazy(() => import('./pages/LoginPage'))
const RegisterPage  = lazy(() => import('./pages/RegisterPage'))
const HomePage      = lazy(() => import('./pages/HomePage'))
const IntelPage     = lazy(() => import('./pages/IntelPage'))
const NewsPage      = lazy(() => import('./pages/NewsPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const SocialPage    = lazy(() => import('./pages/SocialPage'))
const SentinelPage  = lazy(() => import('./pages/SentinelPage'))
const MarketsPage   = lazy(() => import('./pages/MarketsPage'))
const PolymarketPage= lazy(() => import('./pages/PolymarketPage'))
const ProfilePage   = lazy(() => import('./pages/ProfilePage'))
const PlansPage     = lazy(() => import('./pages/PlansPage'))

const MapView = lazy(() => import('./components/MapView'))

// Fallback genérico — los chunks cargan en <100 KB tras gzip, así que esto
// solo se ve fugazmente la primera vez que entras a una vista.
function PageFallback({ message = 'CARGANDO…' }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingState message={message} />
    </div>
  )
}

// ── Dashboard shell — all /app/* views ───────────────────────────────────────
function AppShell() {
  const [view, setView] = useState('home')
  const [flyTarget,        setFlyTarget]        = useState(null)
  const [selectedAircraft, setSelectedAircraft] = useState(null)
  const [selectedVessel,   setSelectedVessel]   = useState(null)
  const [topicsOnly, setTopicsOnly] = useState(false)
  const navigate = useNavigate()

  function handleLogout() {
    clearProfileCache()
    clearFeedCache()
    sessionStorage.removeItem('qilin_token')
    sessionStorage.removeItem('qilin_user')
    navigate('/login')
  }

  // Prefetch de feeds al montar AppShell (tras login). En paralelo, sin await.
  useEffect(() => {
    prefetchNewsFeed()
    prefetchSocialFeed()
    prefetchDocsFeed()
    prefetchMarkets()
    prefetchPolymarket()
    prefetchIntelTimeline()
  }, [])

  function handleSelectVessel(raw) {
    if (!raw) { setSelectedVessel(null); return }
    const mmsi = raw.mmsi || raw.id
    const full = vessels.find(v => (v.mmsi || v.id) === mmsi) || raw
    setSelectedVessel(full)
  }

  const { aircraft, vessels, alerts, stats, wsStatus } = useQilinData()
  const { trails, addTrail, removeTrail, clearAll } = useAircraftTrail()
  const { vesselTrails, addVesselTrail, removeVesselTrail } = useVesselTrail()
  const { history, loading: historyLoading } = useAircraftHistory({ enabled: view === 'tactical' })
  const playback = usePlayback(trails)

  const { profile } = useProfile()
  const hasTopics = (profile?.topics?.length || 0) > 0

  useEffect(() => {
    if (hasTopics && !topicsOnly) setTopicsOnly(true)
  }, [hasTopics])   // eslint-disable-line react-hooks/exhaustive-deps

  // Only rebuild when aircraft type metadata changes — not on every position update
  const aircraftTypeDigest = aircraft.map(a => `${a.id || a.icao24}:${a.type || ''}:${a.type_code || ''}`).join(',')
  const enrichedHistory = useMemo(() => {
    const liveMap = Object.fromEntries(aircraft.map(a => [(a.id || a.icao24), a]))
    return history.map(h => ({
      ...h,
      type:      liveMap[h.icao24]?.type      ?? null,
      type_code: liveMap[h.icao24]?.type_code ?? null,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, aircraftTypeDigest])

  // Tactical grid
  if (view === 'tactical') {
    return (
      <div style={{ display:'grid', gridTemplateRows:'52px 1fr 44px',
        gridTemplateColumns:'1fr 340px', height:'100vh', width:'100vw', overflow:'hidden' }}>
        <TopBar alertsTotal={stats.alertsTotal} wsStatus={wsStatus} currentView={view}
          onNavigate={setView} onLogout={handleLogout}
          topicsOnly={topicsOnly}
          onToggleTopics={() => setTopicsOnly(v => !v)}
          hasTopics={hasTopics}
        />
        <Suspense fallback={
          <div style={{ gridColumn:1, gridRow:2, display:'flex', alignItems:'center',
            justifyContent:'center', background:'var(--bg-0)' }}>
            <LoadingState message="CARGANDO MAPA..." variant="map" />
          </div>
        }>
          <MapView aircraft={aircraft} vessels={vessels} alerts={[]} flyTarget={flyTarget}
            trails={trails} onAddTrail={addTrail} onRemoveTrail={removeTrail} onClearTrails={clearAll}
            vesselTrails={vesselTrails}
            onSelectAircraft={setSelectedAircraft} onSelectVessel={handleSelectVessel}
            playback={playback} />
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
            history={enrichedHistory}
            historyLoading={historyLoading}
            playback={playback}
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
        onNavigate={setView} onLogout={handleLogout}
        topicsOnly={topicsOnly}
        onToggleTopics={() => setTopicsOnly(v => !v)}
        hasTopics={hasTopics}
      />
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <Suspense fallback={<PageFallback />}>
          {view === 'home'       && <HomePage aircraft={aircraft} alerts={alerts} onNavigate={setView} />}
          {view === 'intel'      && <IntelPage topicsOnly={topicsOnly} />}
          {view === 'news'       && <NewsPage  topicsOnly={topicsOnly} />}
          {view === 'documents'  && <DocumentsPage />}
          {view === 'social'     && <SocialPage topicsOnly={topicsOnly} />}
          {view === 'sentinel'   && <SentinelPage />}
          {view === 'markets'    && <MarketsPage />}
          {view === 'polymarket' && <PolymarketPage />}
          {view === 'profile'    && <ProfilePage onNavigate={setView} />}
          {view === 'plans'      && <PlansPage   onNavigate={setView} />}
        </Suspense>
      </div>
      <ChatBot />
    </div>
  )
}

// ── Root router ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/"         element={<LandingPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/app"      element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
        <Route path="/app/*"    element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
      </Routes>
    </Suspense>
  )
}
