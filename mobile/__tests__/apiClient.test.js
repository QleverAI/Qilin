jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}))

global.fetch = jest.fn()

// Reset module state between tests
beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
})

test('loadToken reads qilin_token from SecureStore', async () => {
  const SecureStore = require('expo-secure-store')
  SecureStore.getItemAsync.mockResolvedValue('tok-abc')
  const { loadToken, getToken } = require('../src/hooks/apiClient')
  await loadToken()
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith('qilin_token')
  expect(getToken()).toBe('tok-abc')
})

test('setToken updates in-memory token and persists to SecureStore', () => {
  const SecureStore = require('expo-secure-store')
  const { setToken, getToken } = require('../src/hooks/apiClient')
  setToken('tok-xyz')
  expect(getToken()).toBe('tok-xyz')
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('qilin_token', 'tok-xyz')
})

test('authFetch sends Authorization header when token is set', async () => {
  const { setToken, authFetch } = require('../src/hooks/apiClient')
  setToken('tok-123')
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: 1 }) })
  await authFetch('/test/path')
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/test/path'),
    expect.objectContaining({ headers: { Authorization: 'Bearer tok-123' } })
  )
})

test('authFetch sends no Authorization header when token is null', async () => {
  const { loadToken, authFetch } = require('../src/hooks/apiClient')
  const SecureStore = require('expo-secure-store')
  SecureStore.getItemAsync.mockResolvedValue(null)
  await loadToken()
  global.fetch.mockResolvedValue({ ok: true, json: async () => [] })
  await authFetch('/test/path')
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/test/path'),
    expect.objectContaining({ headers: {} })
  )
})

test('authFetch throws on non-ok response', async () => {
  const { setToken, authFetch } = require('../src/hooks/apiClient')
  setToken('tok-123')
  global.fetch.mockResolvedValue({ ok: false, status: 401 })
  await expect(authFetch('/protected')).rejects.toThrow('HTTP 401')
})
