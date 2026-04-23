jest.mock('../src/hooks/apiClient', () => ({
  authFetch: jest.fn(),
}))

// AsyncStorage no está disponible en jest por defecto; feedCache lo requiere
// perezosamente y degrada a null → memory-only cache. Nada que mockear aquí,
// pero sí limpiamos memCache/inflight entre tests para independencia.

import { renderHook, waitFor } from '@testing-library/react-native'
import { authFetch } from '../src/hooks/apiClient'
import { useNewsFeed } from '../src/hooks/useNewsFeed'
import { clearFeedCache } from '../src/hooks/feedCache'

beforeEach(async () => {
  jest.clearAllMocks()
  await clearFeedCache()
})

test('returns empty array while loading', () => {
  authFetch.mockReturnValue(new Promise(() => {})) // never resolves
  const { result } = renderHook(() => useNewsFeed())
  expect(result.current.articles).toEqual([])
  expect(result.current.loading).toBe(true)
})

test('populates articles on successful fetch', async () => {
  const fakeArticles = [
    { id: 1, title: 'Test', severity: 'high', zones: ['Europa'], time: new Date().toISOString(),
      source: 'BBC', summary: 'Summary', keywords: ['war'], relevance: 80 }
  ]
  authFetch.mockResolvedValue(fakeArticles)
  const { result } = renderHook(() => useNewsFeed())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.articles).toHaveLength(1)
  expect(result.current.articles[0].title).toBe('Test')
})

test('derives zones from articles', async () => {
  authFetch.mockResolvedValue([
    { id: 1, zones: ['Europa', 'Asia'], title: 'A', severity: 'low', time: new Date().toISOString(), source: 'X', summary: '', keywords: [], relevance: 50 },
    { id: 2, zones: ['Asia'],           title: 'B', severity: 'low', time: new Date().toISOString(), source: 'X', summary: '', keywords: [], relevance: 50 },
  ])
  const { result } = renderHook(() => useNewsFeed())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.zones.sort()).toEqual(['Asia', 'Europa'])
})

test('returns empty array on fetch error', async () => {
  authFetch.mockRejectedValue(new Error('HTTP 401'))
  const { result } = renderHook(() => useNewsFeed())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.articles).toEqual([])
})

test('second mount uses memCache for instant paint', async () => {
  const fake = [{ id: 1, title: 'Cached', severity: 'low', zones: [], time: new Date().toISOString(), source: 'X', summary: '', keywords: [], relevance: 10 }]
  authFetch.mockResolvedValue(fake)

  // Primer mount: loading:true → luego populates
  const { result: first, unmount } = renderHook(() => useNewsFeed())
  await waitFor(() => expect(first.current.loading).toBe(false))
  expect(first.current.articles[0].title).toBe('Cached')
  unmount()

  // Segundo mount: la memCache está caliente, loading empieza false
  const { result: second } = renderHook(() => useNewsFeed())
  expect(second.current.loading).toBe(false)
  expect(second.current.articles[0].title).toBe('Cached')
})
