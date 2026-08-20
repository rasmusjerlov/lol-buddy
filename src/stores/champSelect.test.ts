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
  assignedChampionId: number
  benchChampions: Array<{ championId: number; isPriority: boolean }>
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
      myTeam: [{ cellId: localCell, championId: overrides.assignedChampionId ?? 0, championPickIntent: 0, assignedPosition: 'middle', summonerId: 1, puuid: 'abc' }],
      theirTeam: [],
      timer: { adjustedTimeLeftInPhase: 30000, totalTimeInPhase: 30000, phase: overrides.phase ?? 'BAN_PICK', isInfinite: false },
      bans: { myTeamBans: [], theirTeamBans: [] },
      benchChampions: overrides.benchChampions
    }
  }
}

function makePoolSession(champIds: number[], localPlayerCellId = 0): ChampSelectEventPayload {
  return {
    eventType: 'Update',
    uri: '/lol-champ-select/v1/session',
    data: {
      localPlayerCellId,
      actions: [[
        ...champIds.map((championId, idx) => ({
          id: idx + 1,
          actorCellId: localPlayerCellId,
          type: 'pick' as const,
          championId,
          completed: false,
          isInProgress: true
        }))
      ]],
      myTeam: [{ cellId: localPlayerCellId, championId: 0, championPickIntent: 0, assignedPosition: '', summonerId: 1, puuid: 'abc' }],
      theirTeam: [],
      timer: { adjustedTimeLeftInPhase: 30000, totalTimeInPhase: 30000, phase: 'PLANNING', isInfinite: false },
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

  it('extracts assignedChampionId from myTeam in ARAM', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 0, assignedChampionId: 222 }))
    expect(store.assignedChampionId).toBe(222)
    expect(store.selectedChampId).toBe(222)
  })

  it('extracts benchChampionIds from benchChampions', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({
      benchChampions: [
        { championId: 1, isPriority: false },
        { championId: 2, isPriority: true }
      ]
    }))
    expect(store.benchChampionIds).toEqual([1, 2])
  })

  it('filters out zero champion ids from bench', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({
      benchChampions: [{ championId: 0, isPriority: false }, { championId: 55, isPriority: false }]
    }))
    expect(store.benchChampionIds).toEqual([55])
  })

  it('swapBenchChamp POSTs to bench/swap and updates local state', async () => {
    mockLcu.post.mockResolvedValue(undefined)
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ assignedChampionId: 10 }))
    await store.swapBenchChamp(99)
    expect(mockLcu.post).toHaveBeenCalledWith('/lol-champ-select/v1/session/bench/swap/99')
    expect(store.assignedChampionId).toBe(99)
    expect(store.selectedChampId).toBe(99)
  })

  it('reset clears bench and assigned champion state', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({
      assignedChampionId: 50,
      benchChampions: [{ championId: 123, isPriority: false }]
    }))
    store.reset()
    expect(store.assignedChampionId).toBe(0)
    expect(store.benchChampionIds).toEqual([])
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

  // --- Champion pool (ARAM Mayhem) ---

  it('extracts pickableChampionIds from multiple pre-filled pick actions', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makePoolSession([157, 99, 64]))
    expect(store.pickableChampionIds).toEqual([157, 99, 64])
  })

  it('pickableChampionIds is empty when only one pick action exists', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makeSession({ localPlayerCellId: 0, inProgressCellId: 0 }))
    expect(store.pickableChampionIds).toEqual([])
  })

  it('canLockIn is true in pool mode once a champion is selected', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makePoolSession([157, 99, 64]))
    expect(store.canLockIn).toBe(false)
    store.selectedChampId = 157
    expect(store.canLockIn).toBe(true)
  })

  it('lockIn uses the action whose championId matches the selection in pool mode', async () => {
    mockLcu.patch.mockResolvedValue(undefined)
    mockLcu.post.mockResolvedValue(undefined)
    const store = useChampSelectStore()
    store.handleLcuEvent(makePoolSession([157, 99, 64])) // ids 1, 2, 3
    store.selectedChampId = 99
    await store.lockIn()
    expect(mockLcu.patch).toHaveBeenCalledWith('/lol-champ-select/v1/session/actions/2', { championId: 99 })
    expect(mockLcu.post).toHaveBeenCalledWith('/lol-champ-select/v1/session/actions/2/complete')
  })

  it('hoverChampion in pool mode patches the matching action', async () => {
    mockLcu.patch.mockResolvedValue(undefined)
    const store = useChampSelectStore()
    store.handleLcuEvent(makePoolSession([157, 99, 64])) // ids 1, 2, 3
    await store.hoverChampion(64)
    expect(store.selectedChampId).toBe(64)
    expect(mockLcu.patch).toHaveBeenCalledWith('/lol-champ-select/v1/session/actions/3', { championId: 64 })
  })

  it('reset clears pickableChampionIds', () => {
    const store = useChampSelectStore()
    store.handleLcuEvent(makePoolSession([157, 99]))
    store.reset()
    expect(store.pickableChampionIds).toEqual([])
  })
})
