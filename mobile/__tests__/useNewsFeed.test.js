jest.mock('../src/hooks/apiClient', () => ({
  authFetch: jest.fn(),
}))

import { renderHook, act, waitFor } from '@testing-library/react-native'
import { authFetch } from '../src/hooks/apiClient'
import { useNewsFeed } from '../src/hooks/useNewsFeed'

beforeEach(() => jest.clearAllMocks())

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
