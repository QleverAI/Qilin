import { useState, useRef, useCallback, useEffect } from 'react'

function binarySearchIdx(points, targetMs) {
  let lo = 0, hi = points.length - 1, result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (new Date(points[mid].time).getTime() <= targetMs) { result = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  return result
}

function interpolatePosition(points, targetMs) {
  if (!points || points.length === 0) return null
  const firstMs = new Date(points[0].time).getTime()
  const lastMs  = new Date(points[points.length - 1].time).getTime()
  if (targetMs < firstMs) return null
  if (targetMs >= lastMs) {
    const p = points[points.length - 1]
    return { lat: p.lat, lon: p.lon, heading: p.heading ?? 0 }
  }
  const idx = binarySearchIdx(points, targetMs)
  if (idx < 0 || idx >= points.length - 1) return null
  const p0 = points[idx], p1 = points[idx + 1]
  const t0 = new Date(p0.time).getTime(), t1 = new Date(p1.time).getTime()
  const f = t1 === t0 ? 0 : (targetMs - t0) / (t1 - t0)
  return {
    lat:     p0.lat + (p1.lat - p0.lat) * f,
    lon:     p0.lon + (p1.lon - p0.lon) * f,
    heading: p0.heading ?? 0,
  }
}

export function usePlayback(trails) {
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [speed,       setSpeedState]  = useState(20)
  const [currentTime, setCurrentTime] = useState(0)

  const rafRef    = useRef(null)
  const lastTsRef = useRef(null)
  const tickRef   = useRef(null)
  const stateRef  = useRef({ isPlaying: false, speed: 20, currentTime: 0, globalEnd: 0 })

  // Compute global timeline bounds from all active trails
  let globalStart = Infinity, globalEnd = -Infinity
  for (const trail of Object.values(trails)) {
    const pts = trail.points || []
    if (!pts.length) continue
    const first = new Date(pts[0].time).getTime()
    const last  = new Date(pts[pts.length - 1].time).getTime()
    if (first < globalStart) globalStart = first
    if (last  > globalEnd)   globalEnd   = last
  }
  if (globalStart === Infinity) { globalStart = 0; globalEnd = 0 }
  stateRef.current.globalEnd = globalEnd

  // Seed currentTime when first trail loads
  useEffect(() => {
    if (globalStart > 0 && stateRef.current.currentTime === 0) {
      stateRef.current.currentTime = globalStart
      setCurrentTime(globalStart)
    }
  }, [globalStart])

  // Reset when all trails are cleared
  const trailCount = Object.keys(trails).length
  useEffect(() => {
    if (trailCount === 0) {
      stateRef.current.isPlaying = false
      stateRef.current.currentTime = 0
      setIsPlaying(false)
      setCurrentTime(0)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [trailCount])

  // rAF tick — always uses stateRef to avoid stale closures
  tickRef.current = function tick(ts) {
    if (!stateRef.current.isPlaying) return
    if (lastTsRef.current != null) {
      const simDelta = (ts - lastTsRef.current) * stateRef.current.speed
      const next     = Math.min(stateRef.current.currentTime + simDelta, stateRef.current.globalEnd)
      stateRef.current.currentTime = next
      setCurrentTime(next)
      if (next >= stateRef.current.globalEnd) {
        stateRef.current.isPlaying = false
        setIsPlaying(false)
        lastTsRef.current = null
        return
      }
    }
    lastTsRef.current = ts
    rafRef.current = requestAnimationFrame(tickRef.current)
  }

  const play = useCallback(() => {
    if (stateRef.current.globalEnd === 0) return
    stateRef.current.isPlaying = true
    setIsPlaying(true)
    lastTsRef.current = null
    rafRef.current = requestAnimationFrame(tickRef.current)
  }, [])

  const pause = useCallback(() => {
    stateRef.current.isPlaying = false
    setIsPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    lastTsRef.current = null
  }, [])

  const seek = useCallback((ms) => {
    stateRef.current.currentTime = ms
    setCurrentTime(ms)
  }, [])

  const setSpeed = useCallback((n) => {
    stateRef.current.speed = n
    setSpeedState(n)
  }, [])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  // Interpolated position per trail (computed each render — O(log N) per trail)
  const positions = {}
  for (const [icao24, trail] of Object.entries(trails)) {
    const pos = interpolatePosition(trail.points || [], currentTime)
    positions[icao24] = pos ? { ...pos, color: trail.color } : null
  }

  return { isPlaying, speed, currentTime, globalStart, globalEnd, positions, play, pause, seek, setSpeed }
}
