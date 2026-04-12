import TopBar    from './components/TopBar'
import MapCanvas  from './components/MapCanvas'
import AlertPanel from './components/AlertPanel'
import BottomBar  from './components/BottomBar'
import { useQilinData } from './hooks/useQilinData'

export default function App() {
  const { aircraft, vessels, alerts, stats, wsStatus } = useQilinData()

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: '44px 1fr 36px',
      gridTemplateColumns: '1fr 340px',
      height: '100vh',
      width:  '100vw',
      overflow: 'hidden',
    }}>
      <TopBar       alertsTotal={stats.alertsTotal} wsStatus={wsStatus} />
      <MapCanvas    aircraft={aircraft} vessels={vessels} alerts={alerts} />
      <AlertPanel   alerts={alerts} stats={stats} />
      <BottomBar    stats={stats} />
    </div>
  )
}
