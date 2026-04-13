import { useState, useEffect, useRef, useCallback } from 'react'
import { AppState } from 'react-native'

const API_BASE    = process.env.EXPO_PUBLIC_API_URL  || 'http://localhost:8000'
const API_WS_BASE = process.env.EXPO_PUBLIC_WS_URL   || 'ws://localhost:8000'

const INITIAL = { aircraft: [], vessels: [], alerts: [], stats: { alertsTotal: 0 }, wsStatus: 'connecting' }

export function useQilinData() {
  const [state,     setState]     = useState(INITIAL)
  const wsRef                     = useRef(null)
  const retryTimer                = useRef(null)
  const appState                  = useRef(AppState.currentState)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const token = null // TODO: read from SecureStore after auth is wired
    const url   = token ? `${API_WS_BASE}/ws?token=${token}` : `${API_WS_BASE}/ws`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setState(s => ({ ...s, wsStatus: 'live' }))

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data)
        if (msg.type === 'snapshot' || msg.type === 'update') {
          setState(s => ({
            ...s,
            aircraft: msg.aircraft ?? s.aircraft,
            vessels:  msg.vessels  ?? s.vessels,
            alerts:   msg.alerts   ?? s.alerts,
            stats:    msg.stats    ?? s.stats,
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
