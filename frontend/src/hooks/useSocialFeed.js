import { useState, useEffect } from 'react'
import { fetchWithCache, getCached, prefetch } from './feedCache'

const FEED_URL     = '/api/social/feed?limit=1000'
const ACCOUNTS_URL = '/api/social/accounts'

export function useSocialFeed() {
  const cachedPosts    = getCached(FEED_URL)
  const cachedAccounts = getCached(ACCOUNTS_URL)

  const [posts,      setPosts]      = useState(cachedPosts    || [])
  const [accounts,   setAccounts]   = useState(cachedAccounts || [])
  const [loading,    setLoading]    = useState(!(cachedPosts && cachedAccounts))
  const [lastUpdate, setLastUpdate] = useState(cachedPosts ? new Date() : null)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [rawPosts, rawAccounts] = await Promise.all([
          fetchWithCache(FEED_URL),
          fetchWithCache(ACCOUNTS_URL),
        ])
        if (cancelled) return
        setPosts(rawPosts || [])
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

export function prefetchSocialFeed() {
  prefetch(FEED_URL)
  prefetch(ACCOUNTS_URL)
}
