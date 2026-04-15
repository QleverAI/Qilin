import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function authHeaders() {
  const token = sessionStorage.getItem('qilin_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function useSocialFeed() {
  const [posts,      setPosts]      = useState([])
  const [accounts,   setAccounts]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawPosts, rawAccounts] = await Promise.all([
          apiFetch('/social/feed?limit=100'),
          apiFetch('/social/accounts'),
        ])
        if (cancelled) return
        setPosts(rawPosts   || [])
        setAccounts(rawAccounts || [])
        setLastUpdate(new Date())
      } catch (err) {
        console.warn('[useSocialFeed] fetch failed:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const categories = [...new Set(accounts.map(a => a.category))].sort()
  const zones      = [...new Set(accounts.map(a => a.zone))].sort()

  return { posts, accounts, categories, zones, loading, lastUpdate }
}
