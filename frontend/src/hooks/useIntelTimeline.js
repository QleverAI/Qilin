import { useEffect, useRef, useState, useCallback } from 'react'

const AUTH_HEADER = () => {
  const tok = sessionStorage.getItem('qilin_token') || ''
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

export function useIntelTimeline({ hours = 48, minScore = 0, domain = 'all' } = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spend, setSpend] = useState({ spent_usd: 0, cap_usd: 5 })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/intel/timeline?hours=${hours}&min_score=${minScore}&domain=${domain}`
      const [tlResp, spResp] = await Promise.all([
        fetch(url, { headers: AUTH_HEADER() }),
        fetch('/api/intel/spend', { headers: AUTH_HEADER() }),
      ])
      if (!tlResp.ok) throw new Error(`HTTP ${tlResp.status}`)
      const tl = await tlResp.json()
      const sp = spResp.ok ? await spResp.json() : { spent_usd: 0, cap_usd: 5 }
      setItems(tl.items || [])
      setSpend(sp)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [hours, minScore, domain])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Optional WS prepend: caller passes ws messages via addLiveItem
  const addLiveItem = useCallback((msg) => {
    if (!msg || msg.kind !== 'intel') return
    try {
      const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload
      const item = msg.type === 'master'
        ? {
            type: 'master',
            time: new Date().toISOString(),
            cycle_id: msg.cycle_id,
            ...payload,
          }
        : {
            type: 'finding',
            time: new Date().toISOString(),
            cycle_id: msg.cycle_id,
            agent_name: msg.agent_name,
            anomaly_score: parseInt(msg.anomaly_score || '0', 10),
            summary: payload.summary || '',
            raw_output: payload,
          }
      setItems(prev => [item, ...prev].slice(0, 800))
    } catch (_) { /* noop */ }
  }, [])

  return { items, loading, error, spend, refresh: fetchAll, addLiveItem }
}
