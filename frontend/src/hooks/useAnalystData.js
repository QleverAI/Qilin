import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from './apiClient'

const POLL_EVENTS_MS   = 30_000
const POLL_TIMELINE_MS = 60_000

export function useAnalystData() {
  const [events,        setEvents]        = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [summary,       setSummary]       = useState(null)
  const [timeline,      setTimeline]      = useState([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)

  // Filters
  const [filterZone,        setFilterZone]        = useState('')
  const [filterSeverityMin, setFilterSeverityMin] = useState(1)
  const [filterType,        setFilterType]        = useState('')
  const [filterHours,       setFilterHours]       = useState(24)

  const eventsTimerRef   = useRef(null)
  const timelineTimerRef = useRef(null)

  // ── Build query string from current filters ───────────────────────────────
  function buildEventsUrl(zone, severityMin, type, hours) {
    const p = new URLSearchParams()
    if (zone)          p.set('zone',         zone)
    if (severityMin > 1) p.set('severity_min', severityMin)
    if (type)          p.set('event_type',   type)
    p.set('hours', hours)
    p.set('limit', 100)
    return `/api/analyzed-events?${p}`
  }

  function buildSummaryUrl(hours) {
    return `/api/analytics/summary?hours=${hours}`
  }

  function buildTimelineUrl(zone, hours) {
    const p = new URLSearchParams({ hours })
    if (zone) p.set('zone', zone)
    return `/api/analytics/timeline?${p}`
  }

  // ── Fetch events + summary (polled every 30s) ─────────────────────────────
  const fetchEventsAndSummary = useCallback(async (zone, severityMin, type, hours) => {
    try {
      const [rawEvents, rawSummary] = await Promise.all([
        apiFetch(buildEventsUrl(zone, severityMin, type, hours)),
        apiFetch(buildSummaryUrl(hours)),
      ])
      setEvents(rawEvents || [])
      setSummary(rawSummary || null)
      setError(null)
    } catch (err) {
      console.warn('[useAnalystData] fetch events/summary failed:', err.message)
      setError(err.message)
    }
  }, [])

  // ── Fetch timeline (polled every 60s) ─────────────────────────────────────
  const fetchTimeline = useCallback(async (zone, hours) => {
    try {
      const raw = await apiFetch(buildTimelineUrl(zone, hours))
      setTimeline(raw || [])
    } catch (err) {
      console.warn('[useAnalystData] fetch timeline failed:', err.message)
    }
  }, [])

  // ── Effect: re-fetch immediately when filters change; set up polling ───────
  useEffect(() => {
    let cancelled = false

    async function initial() {
      setLoading(true)
      await Promise.all([
        fetchEventsAndSummary(filterZone, filterSeverityMin, filterType, filterHours),
        fetchTimeline(filterZone, filterHours),
      ])
      if (!cancelled) setLoading(false)
    }

    initial()

    // Clear previous timers before setting new ones
    clearInterval(eventsTimerRef.current)
    clearInterval(timelineTimerRef.current)

    eventsTimerRef.current = setInterval(() => {
      if (!cancelled) fetchEventsAndSummary(filterZone, filterSeverityMin, filterType, filterHours)
    }, POLL_EVENTS_MS)

    timelineTimerRef.current = setInterval(() => {
      if (!cancelled) fetchTimeline(filterZone, filterHours)
    }, POLL_TIMELINE_MS)

    return () => {
      cancelled = true
      clearInterval(eventsTimerRef.current)
      clearInterval(timelineTimerRef.current)
    }
  }, [filterZone, filterSeverityMin, filterType, filterHours, fetchEventsAndSummary, fetchTimeline])

  // ── selectEvent: loads the full event detail ───────────────────────────────
  async function selectEvent(id) {
    try {
      const full = await apiFetch(`/api/analyzed-events/${id}`)
      setSelectedEvent(full)
    } catch (err) {
      console.warn('[useAnalystData] selectEvent failed:', err.message)
    }
  }

  function clearSelectedEvent() {
    setSelectedEvent(null)
  }

  // ── Manual refresh ────────────────────────────────────────────────────────
  async function refresh() {
    setLoading(true)
    await Promise.all([
      fetchEventsAndSummary(filterZone, filterSeverityMin, filterType, filterHours),
      fetchTimeline(filterZone, filterHours),
    ])
    setLoading(false)
  }

  return {
    // Data
    events,
    selectedEvent,
    summary,
    timeline,
    loading,
    error,
    // Filters
    filterZone,
    filterSeverityMin,
    filterType,
    filterHours,
    setFilterZone,
    setFilterSeverityMin,
    setFilterType,
    setFilterHours,
    // Actions
    selectEvent,
    clearSelectedEvent,
    refresh,
  }
}
