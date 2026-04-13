import { useState, useEffect, useRef } from 'react'

const API_BASE    = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const API_WS_BASE = API_BASE.replace(/^http/, 'ws')

function getToken() {
  return sessionStorage.getItem('qilin_token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function normalizeAircraft(raw) {
  return {
    id:           raw.icao24,
    callsign:     raw.callsign || null,
    type:         raw.category === 'military' ? 'military' : 'civil',
    lat:          raw.lat,
    lon:          raw.lon,
    altitude:     raw.altitude,
    speed:        raw.velocity,
    heading:      raw.heading ?? 0,
    zone:         raw.zone,
    registration: raw.registration || null,
    type_code:    raw.type_code   || null,
  }
}

function normalizeAlert(raw) {
  return {
    id:          raw.id,
    severity:    raw.severity,
    zone:        raw.zone,
    rule:        raw.rule,
    title:       raw.title,
    description: raw.description,
    time:        raw.time,
  }
}

function getWsUrl() {
  const token = getToken()
  return token ? `${API_WS_BASE}/ws?token=${token}` : `${API_WS_BASE}/ws`
}

export function useQilinData() {
  const [aircraft, setAircraft] = useState([])
  const [alerts,   setAlerts]   = useState([])
  const [wsStatus, setWsStatus] = useState('disconnected')

  const wsRef = useRef(null)

  // ── Carga inicial + polling cada 15s ──────────────────────────
  useEffect(() => {
    let cancelled = false

    async function fetchSnapshot() {
      try {
        const [rawAircraft, rawAlerts] = await Promise.all([
          apiFetch('/aircraft'),
          apiFetch('/alerts?limit=50'),
        ])
        if (cancelled) return
        setAircraft((rawAircraft || []).filter(a => a.lat && a.lon).map(normalizeAircraft))
        setAlerts((rawAlerts || []).map(normalizeAlert))
      } catch (err) {
        console.warn('[useQilinData] fetch failed:', err.message)
      }
    }

    async function pollAircraft() {
      try {
        const raw = await apiFetch('/aircraft')
        if (cancelled) return
        setAircraft((raw || []).filter(a => a.lat && a.lon).map(normalizeAircraft))
      } catch (err) {
        console.warn('[useQilinData] poll failed:', err.message)
      }
    }

    fetchSnapshot()
    const interval = setInterval(pollAircraft, 15_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // ── WebSocket para alertas en tiempo real ─────────────────────
  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(getWsUrl())
        wsRef.current = ws

        ws.onopen  = () => setWsStatus('connected')
        ws.onclose = () => {
          setWsStatus('disconnected')
          setTimeout(connect, 5000)
        }
        ws.onerror = () => setWsStatus('error')

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'alert') {
              setAlerts(prev => [msg.data, ...prev].slice(0, 50))
            }
          } catch (_) {}
        }
      } catch (_) {
        setWsStatus('error')
      }
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  const stats = {
    aircraftTotal: aircraft.length,
    aircraftMil:   aircraft.filter(a => a.type === 'military').length,
    alertsHigh:    alerts.filter(a => a.severity === 'high').length,
    alertsMedium:  alerts.filter(a => a.severity === 'medium').length,
    alertsTotal:   alerts.length,
  }

  return { aircraft, alerts, stats, wsStatus }
}
