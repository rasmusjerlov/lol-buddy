import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChampSelectStore } from './champSelect'
import type { ChampSelectEventPayload } from './champSelect'

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

Object.defineProperty(globalThis, 'window', {
  value: { lcu: mockLcu },
  writable: true
})

function makeSession(overrides: Partial<{
  localPlayerCellId: number
  inProgressCellId: number
  phase: string
  selectedChampId: number
}> = {}): ChampSelectEventPayload {
  const localCell = overrides.localPlayerCellId ?? 0
  const inProgressCell = overrides.inProgressCellId ?? localCell
  return {
    eventType: 'Update',
    uri: '/lol-champ-select/v1/session',
    data: {
      localPlayerCellId: localCell,
      actions: [[
        {
          id: 1,
          actorCellId: localCell,
          type: 'pick',
          championId: overrides.selectedChampId ?? 0,
          completed: false,
          isInProgress: inProgressCell === localCell
        }
      ]],
      myTeam: [{ cellId: localCell, championId: 0, championPickIntent: 0, assignedPosition: 'middle', summonerId: 1, puuid: 'abc' }],
      theirTeam: [],
      timer: { adjustedTimeLeftInPhase: 30000, totalTimeInPhase: 30000, phase: overrides.phase ?? 'BAN_PICK', isInfinite: false },
      bans: { myTeamBans: [], theirTeamBans: [] }
    }
  }
}

describe('useChampSelectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockLcu.get.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts inactive', () => {
    const store = useChampSelectStore()
    expect(store.active).toBe(false)
    expect(store.isMyTurn).toBe(false)
  })

  it('becomes active on Update event', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 2, inProgressCellId: 2 }))
    expect(store.active).toBe(true)
  })

  it('sets myAction when pick is in-progress', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 0, inProgressCellId: 0 }))
    expect(store.myAction).not.toBeNull()
    expect(store.myAction?.isInProgress).toBe(true)
    expect(store.isMyTurn).toBe(true)
  })

  it('sets myAction to upcoming pick when not in-progress', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 0, inProgressCellId: 99 }))
    expect(store.myAction).not.toBeNull()
    expect(store.myAction?.isInProgress).toBe(false)
    expect(store.isMyTurn).toBe(false)
  })

  it('canLockIn requires both isMyTurn and a selected champion', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 0, inProgressCellId: 0 }))
    expect(store.canLockIn).toBe(false)
    store.selectedChampId = 1
    expect(store.canLockIn).toBe(true)
  })

  it('ticks timer down', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession())
    expect(store.timeLeft).toBe(30)
    vi.advanceTimersByTime(5000)
    expect(store.timeLeft).toBe(25)
  })

  it('resets on Delete event', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession())
    store.handleLcuEvent({ eventType: 'Delete', uri: '/lol-champ-select/v1/session', data: null as any })
    expect(store.active).toBe(false)
    expect(store.myAction).toBeNull()
    expect(store.timeLeft).toBe(0)
  })

  it('reset() clears all state', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession())
    store.selectedChampId = 42
    store.reset()
    expect(store.active).toBe(false)
    expect(store.selectedChampId).toBe(0)
    expect(store.myAction).toBeNull()
  })

  it('hoverChampion sets selectedChampId and PATCHes the action', async () => {
    mockLcu.patch.mockResolvedValue(undefined)
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 0, inProgressCellId: 0 }))
    await store.hoverChampion(119)
    expect(store.selectedChampId).toBe(119)
    expect(mockLcu.patch).toHaveBeenCalledWith(
      '/lol-champ-select/v1/session/actions/1',
      { championId: 119 }
    )
  })

  it('hoverChampion stores selection locally even without an action', async () => {
    const store = useChampSelectStore()
    await store.hoverChampion(55)
    expect(store.selectedChampId).toBe(55)
    expect(mockLcu.patch).not.toHaveBeenCalled()
  })

  it('lockIn PATCHes champion then POSTs complete', async () => {
    mockLcu.patch.mockResolvedValue(undefined)
    mockLcu.post.mockResolvedValue(undefined)
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 0, inProgressCellId: 0 }))
    store.selectedChampId = 157
    await store.lockIn()
    expect(mockLcu.patch).toHaveBeenCalledWith(
      '/lol-champ-select/v1/session/actions/1',
      { championId: 157 }
    )
    expect(mockLcu.post).toHaveBeenCalledWith(
      '/lol-champ-select/v1/session/actions/1/complete'
    )
  })

  it('lockIn is a no-op without a selected champion', async () => {
    mockLcu.patch.mockResolvedValue(undefined)
    mockLcu.post.mockResolvedValue(undefined)
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 0, inProgressCellId: 0 }))
    await store.lockIn()
    expect(mockLcu.patch).not.toHaveBeenCalled()
    expect(mockLcu.post).not.toHaveBeenCalled()
  })

  it('syncs selectedChampId from LCU session if not yet set', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 0, inProgressCellId: 0, selectedChampId: 99 }))
    expect(store.selectedChampId).toBe(99)
  })

  it('keeps champions cached across resets', async () => {
    mockLcu.get.mockResolvedValue([
      { id: 1, name: 'Annie', alias: 'Annie', squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/1.png', roles: ['mage'] }
    ])
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession())
    await vi.runAllTimersAsync()
    expect(store.champions.length).toBeGreaterThan(0)
    store.reset()
    expect(store.champions.length).toBeGreaterThan(0)
  })
})
