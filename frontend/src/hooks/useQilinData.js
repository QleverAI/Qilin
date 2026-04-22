import { useState, useEffect, useRef } from 'react'
import { apiFetch, getApiBase, authHeaders } from './apiClient'

const API_BASE    = getApiBase()
// En dev API_BASE es '' (proxy Vite), derivamos la base WS desde window.location
const API_WS_BASE = API_BASE
  ? API_BASE.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`

function getToken() {
  return sessionStorage.getItem('qilin_token')
}

function normalizeAircraft(raw) {
  return {
    id:           raw.icao24,
    callsign:     raw.callsign || null,
    type:         raw.category === 'military' ? 'military' : raw.category === 'vip' ? 'vip' : 'civil',
    lat:          raw.lat,
    lon:          raw.lon,
    altitude:     raw.altitude,
    speed:        raw.velocity,
    heading:      raw.heading ?? 0,
    zone:         raw.zone,
    registration:   raw.registration    || null,
    type_code:      raw.type_code       || null,
    origin_country: raw.origin_country  || null,
    vip_owner:      raw.vip_owner       || null,
    vip_category:   raw.vip_category    || null,
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

function normalizeVessel(raw) {
  return {
    id:          raw.mmsi,
    mmsi:        raw.mmsi,
    name:        raw.name || null,
    type:        raw.category || 'unknown',
    lat:         raw.lat,
    lon:         raw.lon,
    speed:       raw.speed,
    heading:     raw.heading ?? raw.course ?? 0,
    course:      raw.course,
    flag:        raw.flag || null,
    zone:        raw.zone || null,
    destination: raw.destination || null,
    company:     raw.company || null,
    ais_active:  raw.ais_active !== false,
  }
}

function getWsUrl() {
  const token = getToken()
  return token ? `${API_WS_BASE}/ws?token=${token}` : `${API_WS_BASE}/ws`
}

export function useQilinData() {
  const [aircraft, setAircraft] = useState([])
  const [alerts,   setAlerts]   = useState([])
  const [vessels,  setVessels]  = useState([])
  const [wsStatus, setWsStatus] = useState('disconnected')

  const wsRef = useRef(null)

  // ── Carga inicial + polling cada 15s ──────────────────────────
  useEffect(() => {
    let cancelled = false

    async function fetchSnapshot() {
      try {
        const [rawAircraft, rawAlerts, rawVessels] = await Promise.all([
          apiFetch('/api/aircraft'),
          apiFetch('/api/alerts?limit=50'),
          apiFetch('/api/vessels'),
        ])
        if (cancelled) return
        setAircraft((rawAircraft || []).filter(a => a.lat && a.lon).map(normalizeAircraft))
        setAlerts((rawAlerts || []).map(normalizeAlert))
        setVessels((rawVessels || []).filter(v => v.lat && v.lon && v.category !== 'unknown').map(normalizeVessel))
      } catch (err) {
        console.warn('[useQilinData] fetch failed:', err.message)
      }
    }

    async function pollAircraft() {
      try {
        const raw = await apiFetch('/api/aircraft')
        if (cancelled) return
        setAircraft((raw || []).filter(a => a.lat && a.lon).map(normalizeAircraft))
      } catch (err) {
        console.warn('[useQilinData] poll failed:', err.message)
      }
    }

    async function pollVessels() {
      try {
        const raw = await apiFetch('/api/vessels')
        if (cancelled) return
        setVessels((raw || []).filter(v => v.lat && v.lon && v.category !== 'unknown').map(normalizeVessel))
      } catch (err) {
        console.warn('[useQilinData] vessel poll failed:', err.message)
      }
    }

    fetchSnapshot()
    const aircraftInterval = setInterval(pollAircraft, 15_000)
    const vesselInterval   = setInterval(pollVessels,  30_000)
    return () => {
      cancelled = true
      clearInterval(aircraftInterval)
      clearInterval(vesselInterval)
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
    aircraftTotal:    aircraft.length,
    aircraftMil:      aircraft.filter(a => a.type === 'military').length,
    vesselTotal:      vessels.length,
    vesselMil:        vessels.filter(v => v.type === 'military').length,
    vesselMerchant:   vessels.filter(v => v.type !== 'military').length,
    alertsHigh:       alerts.filter(a => a.severity === 'high').length,
    alertsMedium:     alerts.filter(a => a.severity === 'medium').length,
    alertsTotal:      alerts.length,
  }

  return { aircraft, vessels, alerts, stats, wsStatus }
}
