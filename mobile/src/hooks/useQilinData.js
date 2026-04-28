import { useState, useEffect, useRef, useCallback } from 'react'
import { AppState } from 'react-native'
import { getToken, authFetch } from './apiClient'

const API_WS_BASE = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8000'

function normalizeAircraft(raw) {
  return {
    id:             raw.icao24,
    icao24:         raw.icao24,
    callsign:       raw.callsign    || null,
    type:           raw.category === 'military' ? 'military'
                  : raw.category === 'vip'      ? 'vip'
                  : raw.category === 'fighter'  ? 'fighter'
                  : raw.category === 'helicopter' ? 'helicopter'
                  : raw.category === 'transport'  ? 'transport'
                  : raw.category === 'surveillance' ? 'surveillance'
                  : 'civil',
    category:       raw.category   || 'civil',
    lat:            raw.lat,
    lon:            raw.lon,
    altitude:       raw.altitude,
    speed:          raw.velocity   ?? raw.speed ?? null,
    heading:        raw.heading    ?? 0,
    zone:           raw.zone       || null,
    registration:   raw.registration    || null,
    type_code:      raw.type_code       || null,
    origin_country: raw.origin_country  || null,
    vip_owner:      raw.vip_owner       || null,
    vip_category:   raw.vip_category    || null,
  }
}

function normalizeVessel(raw) {
  return {
    id:          raw.mmsi,
    mmsi:        raw.mmsi,
    name:        raw.name        || null,
    type:        raw.category    || 'unknown',
    category:    raw.category    || 'unknown',
    lat:         raw.lat,
    lon:         raw.lon,
    speed:       raw.speed       ?? null,
    heading:     raw.heading     ?? raw.course ?? 0,
    course:      raw.course      ?? null,
    flag:        raw.flag        || null,
    zone:        raw.zone        || null,
    destination: raw.destination || null,
    company:     raw.company     || null,
    ais_active:  raw.ais_active  !== false,
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

const INITIAL = {
  aircraft: [], vessels: [], alerts: [],
  stats: { alertsTotal: 0 },
  wsStatus: 'connecting',
}

export function useQilinData() {
  const [state,    setState]    = useState(INITIAL)
  const wsRef                  = useRef(null)
  const retryTimer             = useRef(null)
  const appState               = useRef(AppState.currentState)
  const cancelledRef           = useRef(false)

  // ── HTTP polling: aircraft every 15s, vessels every 30s ──────────────────
  useEffect(() => {
    cancelledRef.current = false

    async function fetchAircraft() {
      try {
        const raw = await authFetch('/aircraft')
        if (cancelledRef.current) return
        const normalized = (raw || [])
          .filter(a => a.lat != null && a.lon != null)
          .map(normalizeAircraft)
        setState(s => ({ ...s, aircraft: normalized }))
      } catch (err) {
        if (!err.message.includes('401'))
          console.warn('[useQilinData] aircraft poll:', err.message)
      }
    }

    async function fetchVessels() {
      try {
        const raw = await authFetch('/vessels')
        if (cancelledRef.current) return
        const normalized = (raw || [])
          .filter(v => v.lat != null && v.lon != null && v.category !== 'unknown')
          .map(normalizeVessel)
        setState(s => ({ ...s, vessels: normalized }))
      } catch (err) {
        if (!err.message.includes('401'))
          console.warn('[useQilinData] vessels poll:', err.message)
      }
    }

    async function fetchAlerts() {
      try {
        const raw = await authFetch('/alerts?limit=50')
        if (cancelledRef.current) return
        const normalized = (raw || []).map(normalizeAlert)
        setState(s => ({ ...s, alerts: normalized }))
      } catch (err) {
        if (!err.message.includes('401'))
          console.warn('[useQilinData] alerts poll:', err.message)
      }
    }

    // Initial load — all three in parallel
    Promise.all([fetchAircraft(), fetchVessels(), fetchAlerts()])

    const aircraftTimer = setInterval(fetchAircraft, 15_000)
    const vesselTimer   = setInterval(fetchVessels,  30_000)
    const alertsTimer   = setInterval(fetchAlerts,   30_000)

    return () => {
      cancelledRef.current = true
      clearInterval(aircraftTimer)
      clearInterval(vesselTimer)
      clearInterval(alertsTimer)
    }
  }, [])

  // ── WebSocket: real-time alert pushes only ────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const token = getToken()
    const url   = token ? `${API_WS_BASE}/ws?token=${token}` : `${API_WS_BASE}/ws`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setState(s => ({ ...s, wsStatus: 'live' }))

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data)
        if (msg.type === 'alert' && msg.data) {
          setState(s => ({
            ...s,
            alerts: [normalizeAlert(msg.data), ...s.alerts].slice(0, 50),
          }))
        }
      } catch {}
    }

    ws.onerror = () => setState(s => ({ ...s, wsStatus: 'error' }))

    ws.onclose = () => {
      setState(s => ({ ...s, wsStatus: 'reconnecting' }))
      retryTimer.current = setTimeout(connect, 4000)
    }
  }, [])

  useEffect(() => {
    connect()

    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        connect()
      }
      appState.current = next
    })

    return () => {
      clearTimeout(retryTimer.current)
      wsRef.current?.close()
      sub.remove()
    }
  }, [connect])

  return state
}
