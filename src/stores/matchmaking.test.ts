import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMatchmakingStore } from './matchmaking'

const mockLcu = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  getStatus: vi.fn(),
  onConnected: vi.fn(() => vi.fn()),
  onDisconnected: vi.fn(() => vi.fn()),
  onEvent: vi.fn(() => vi.fn())
}

const mockSettings = {
  get: vi.fn().mockResolvedValue(false),
  set: vi.fn()
}

Object.defineProperty(globalThis, 'window', {
  value: { lcu: mockLcu, settings: mockSettings },
  writable: true
})

function makeReadyCheckEvent(state: string, timer = 10, playerResponse = 'None') {
  return {
    data: { state, timer, playerResponse, decliningMe: false, dodgeWarning: 'None' },
    eventType: 'Update',
    uri: '/lol-matchmaking/v1/ready-check'
  }
}

describe('useMatchmakingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockSettings.get.mockResolvedValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts idle', () => {
    const store = useMatchmakingStore()
    expect(store.state).toBe('None')
    expect(store.isActive).toBe(false)
  })

  it('becomes active on InProgress event', () => {
    const store = useMatchmakingStore()
    store.handleLcuEvent(makeReadyCheckEvent('InProgress', 12))
    expect(store.isActive).toBe(true)
    expect(store.countdown).toBe(12)
  })

  it('ticks countdown down every second', () => {
    const store = useMatchmakingStore()
    store.handleLcuEvent(makeReadyCheckEvent('InProgress', 10))
    vi.advanceTimersByTime(3000)
    expect(store.countdown).toBe(7)
  })

  it('clears active state on Done event', () => {
    const store = useMatchmakingStore()
    store.handleLcuEvent(makeReadyCheckEvent('InProgress', 10))
    store.handleLcuEvent(makeReadyCheckEvent('Done', 0))
    expect(store.isActive).toBe(false)
  })

  it('calls accept endpoint', async () => {
    mockLcu.post.mockResolvedValue(undefined)
    const store = useMatchmakingStore()
    store.handleLcuEvent(makeReadyCheckEvent('InProgress', 10))
    await store.accept()
    expect(mockLcu.post).toHaveBeenCalledWith('/lol-matchmaking/v1/ready-check/accept')
  })

  it('calls decline endpoint', async () => {
    mockLcu.post.mockResolvedValue(undefined)
    const store = useMatchmakingStore()
    store.handleLcuEvent(makeReadyCheckEvent('InProgress', 10))
    await store.decline()
    expect(mockLcu.post).toHaveBeenCalledWith('/lol-matchmaking/v1/ready-check/decline')
  })

  it('auto-accepts immediately when setting is enabled', async () => {
    mockSettings.get.mockResolvedValue(true)
    mockLcu.post.mockResolvedValue(undefined)
    const store = useMatchmakingStore()
    await store.handleLcuEvent(makeReadyCheckEvent('InProgress', 10))
    expect(mockLcu.post).toHaveBeenCalledWith('/lol-matchmaking/v1/ready-check/accept')
  })

  it('does not auto-accept when setting is disabled', async () => {
    mockSettings.get.mockResolvedValue(false)
    const store = useMatchmakingStore()
    await store.handleLcuEvent(makeReadyCheckEvent('InProgress', 10))
    expect(mockLcu.post).not.toHaveBeenCalled()
  })

  it('resets on disconnect', () => {
    const store = useMatchmakingStore()
    store.handleLcuEvent(makeReadyCheckEvent('InProgress', 10))
    store.reset()
    expect(store.isActive).toBe(false)
    expect(store.countdown).toBe(0)
  })
})
