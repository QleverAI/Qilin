import AsyncStorage from '@react-native-async-storage/async-storage'
import { renderHook, act } from '@testing-library/react-native'
import { useTacticalFavorites } from '../src/hooks/useTacticalFavorites'
import { useAircraftTrails }    from '../src/hooks/useAircraftTrails'
import { useVesselTrail }       from '../src/hooks/useVesselTrail'
import { useAircraftHistory }   from '../src/hooks/useAircraftHistory'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// ── useTacticalFavorites ──────────────────────────────────────────────────────

describe('useTacticalFavorites', () => {
  beforeEach(() => AsyncStorage.clear())

  it('starts with empty favorites', async () => {
    const { result } = renderHook(() => useTacticalFavorites())
    await act(async () => {})
    expect(result.current.isFavAircraft('ABC123')).toBe(false)
    expect(result.current.isFavVessel('123456789')).toBe(false)
  })

  it('toggles aircraft favorite on and off', async () => {
    const { result } = renderHook(() => useTacticalFavorites())
    await act(async () => {})
    await act(async () => { result.current.toggleAircraft('ABC123') })
    expect(result.current.isFavAircraft('ABC123')).toBe(true)
    await act(async () => { result.current.toggleAircraft('ABC123') })
    expect(result.current.isFavAircraft('ABC123')).toBe(false)
  })

  it('toggles vessel favorite on and off', async () => {
    const { result } = renderHook(() => useTacticalFavorites())
    await act(async () => {})
    await act(async () => { result.current.toggleVessel('123456789') })
    expect(result.current.isFavVessel('123456789')).toBe(true)
    await act(async () => { result.current.toggleVessel('123456789') })
    expect(result.current.isFavVessel('123456789')).toBe(false)
  })
})

// ── useAircraftTrails ─────────────────────────────────────────────────────────

describe('useAircraftTrails', () => {
  beforeEach(() => { jest.useFakeTimers(); global.fetch = jest.fn() })
  afterEach(() => { jest.useRealTimers() })

  it('starts with empty trails map', () => {
    const { result } = renderHook(() => useAircraftTrails())
    expect(result.current.trails.size).toBe(0)
    expect(result.current.hasTrail('ABC123')).toBe(false)
  })

  it('adds a trail and populates positions', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: 40.0, lon: 20.0, time: '2026-04-28T10:00:00Z' }],
    })
    const { result } = renderHook(() => useAircraftTrails())
    await act(async () => { await result.current.addTrail('ABC123') })
    expect(result.current.hasTrail('ABC123')).toBe(true)
    expect(result.current.trails.get('ABC123')).toHaveLength(1)
  })

  it('removes a trail', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => [] })
    const { result } = renderHook(() => useAircraftTrails())
    await act(async () => { await result.current.addTrail('ABC123') })
    act(() => { result.current.removeTrail('ABC123') })
    expect(result.current.hasTrail('ABC123')).toBe(false)
  })
})

// ── useVesselTrail ────────────────────────────────────────────────────────────

describe('useVesselTrail', () => {
  beforeEach(() => { global.fetch = jest.fn() })

  it('starts with null trail', () => {
    const { result } = renderHook(() => useVesselTrail())
    expect(result.current.vesselTrail).toBeNull()
  })

  it('shows trail after showTrail()', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: 35.0, lon: 25.0, time: '2026-04-28T10:00:00Z' }],
    })
    const { result } = renderHook(() => useVesselTrail())
    await act(async () => { await result.current.showTrail('123456789') })
    expect(result.current.vesselTrail).not.toBeNull()
    expect(result.current.vesselTrail.mmsi).toBe('123456789')
    expect(result.current.vesselTrail.positions).toHaveLength(1)
  })

  it('clears trail after hideTrail()', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => [] })
    const { result } = renderHook(() => useVesselTrail())
    await act(async () => { await result.current.showTrail('123456789') })
    act(() => { result.current.hideTrail() })
    expect(result.current.vesselTrail).toBeNull()
  })
})

// ── useAircraftHistory ────────────────────────────────────────────────────────

describe('useAircraftHistory', () => {
  beforeEach(() => { global.fetch = jest.fn() })

  it('starts with empty history and not loading', () => {
    const { result } = renderHook(() => useAircraftHistory())
    expect(result.current.history).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('fetchHistory populates history', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ icao24: 'ABC123', callsign: 'RCH001', type: 'military', last_seen: '2026-04-28T10:00:00Z' }],
    })
    const { result } = renderHook(() => useAircraftHistory())
    await act(async () => { await result.current.fetchHistory() })
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].icao24).toBe('ABC123')
  })
})
