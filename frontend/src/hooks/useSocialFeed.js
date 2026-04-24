import { useState, useEffect, useMemo } from 'react'
import { fetchWithCache, getCached, prefetch } from './feedCache'

const ACCOUNTS_URL = '/api/social/accounts'

function buildFeedUrl(topicsOnly) {
  return topicsOnly
    ? '/api/social/feed?limit=1000&topics_only=true'
    : '/api/social/feed?limit=1000'
}

export function useSocialFeed({ topicsOnly = false } = {}) {
  const feedUrl     = buildFeedUrl(topicsOnly)
  const cachedPosts    = getCached(feedUrl)
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
          fetchWithCache(feedUrl),
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
  }, [feedUrl])

  const categories = useMemo(() => [...new Set(accounts.map(a => a.category))].sort(), [accounts])
  const zones      = useMemo(() => [...new Set(accounts.map(a => a.zone))].sort(),      [accounts])

  return { posts, accounts, categories, zones, loading, lastUpdate }
}

export function prefetchSocialFeed() {
  prefetch(buildFeedUrl(false))
  prefetch(ACCOUNTS_URL)
}
