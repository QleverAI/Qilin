import { useState, useEffect } from 'react'
import { apiFetch } from './apiClient'

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
          apiFetch('/api/social/feed?limit=100'),
          apiFetch('/api/social/accounts'),
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
