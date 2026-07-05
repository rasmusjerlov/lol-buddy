import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConnectionStore } from './connection'

// Mock the window.lcu API
const mockLcu = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  onConnected: vi.fn(() => vi.fn()),
  onDisconnected: vi.fn(() => vi.fn()),
  onEvent: vi.fn(() => vi.fn())
}

Object.defineProperty(globalThis, 'window', {
  value: { lcu: mockLcu },
  writable: true
})

describe('useConnectionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts disconnected', () => {
    const store = useConnectionStore()
    expect(store.status).toBe('disconnected')
    expect(store.summoner).toBeNull()
  })

  it('sets connected status and fetches summoner on onConnected', async () => {
    const store = useConnectionStore()
    mockLcu.get.mockResolvedValueOnce({
      displayName: 'TestSummoner',
      summonerLevel: 150,
      profileIconId: 1
    })

    await store.onConnected({ port: 54321 })

    expect(store.status).toBe('connected')
    expect(store.port).toBe(54321)
    expect(store.summoner?.displayName).toBe('TestSummoner')
    expect(store.summoner?.summonerLevel).toBe(150)
  })

  it('sets error if summoner fetch fails', async () => {
    const store = useConnectionStore()
    mockLcu.get.mockRejectedValueOnce(new Error('Network error'))

    await store.onConnected({ port: 54321 })

    expect(store.status).toBe('connected')
    expect(store.summoner).toBeNull()
    expect(store.error).toBe('Network error')
  })

  it('resets state on onDisconnected', async () => {
    const store = useConnectionStore()
    mockLcu.get.mockResolvedValueOnce({ displayName: 'X', summonerLevel: 1, profileIconId: 1 })
    await store.onConnected({ port: 54321 })

    store.onDisconnected()

    expect(store.status).toBe('disconnected')
    expect(store.summoner).toBeNull()
    expect(store.port).toBeNull()
  })
})
