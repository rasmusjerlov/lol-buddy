import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLobbyStore } from './lobby'

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
  value: { lcu: mockLcu, settings: { get: vi.fn(), set: vi.fn() } },
  writable: true
})

// Summoner name resolution returns gameName when present, else fetches by ID
const MOCK_LOBBY = {
  localMember: { summonerId: 1, summonerName: '', gameName: 'Jim3k', ready: false },
  members: [
    { summonerId: 1, summonerName: '', gameName: 'Jim3k', ready: false },
    { summonerId: 2, summonerName: '', gameName: 'Ally', ready: true }
  ],
  gameConfig: { gameMode: 'CLASSIC', mapId: 11, queueId: 420 },
  invitations: []
}

// Lobby where names must be resolved via summoner endpoint
const MOCK_LOBBY_NO_NAMES = {
  localMember: { summonerId: 1, summonerName: '', gameName: '', ready: false },
  members: [
    { summonerId: 1, summonerName: '', gameName: '', ready: false }
  ],
  gameConfig: { gameMode: 'CLASSIC', mapId: 11, queueId: 420 },
  invitations: []
}

const MOCK_INVITATIONS = [
  { invitationId: 'abc', state: 'Pending', timestamp: '2026-01-01', toSummonerId: 99 }
]

const MOCK_SENT_INVITATIONS = [
  { invitationId: 'si-1', state: 'Pending', timestamp: '2026-01-01', toSummonerId: 20, toDisplayName: 'Target1' },
  { invitationId: 'si-2', state: 'Declined', timestamp: '2026-01-01', toSummonerId: 21, toSummonerName: 'Target2' }
]

const MOCK_FRIENDS = [
  { summonerId: 10, puuid: 'p1', gameName: 'Friend1', gameTag: 'EUW', name: 'friend1', availability: 'chat', displayName: 'Friend1' },
  { summonerId: 11, puuid: 'p2', gameName: 'Friend2', gameTag: 'EUW', name: 'friend2', availability: 'offline', displayName: 'Friend2' }
]

const MOCK_FRIENDS_WITH_DND = [
  { summonerId: 1, puuid: 'p-local', gameName: 'Jim3k', gameTag: 'EUW', name: 'jim3k', availability: 'chat', displayName: 'Jim3k' },
  { summonerId: 2, puuid: 'p-ally', gameName: 'Ally', gameTag: 'EUW', name: 'ally', availability: 'dnd', displayName: 'Ally' }
]

function makeLobbyEvent(data: unknown, eventType = 'Update') {
  return { data, eventType, uri: '/lol-lobby/v2/lobby' }
}

function makeInviteEvent(data: unknown, eventType = 'Update') {
  return { data, eventType, uri: '/lol-lobby/v2/received-invitations' }
}

describe('useLobbyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with no lobby', () => {
    const store = useLobbyStore()
    expect(store.inLobby).toBe(false)
    expect(store.members).toHaveLength(0)
  })

  it('loads lobby state from event (names present)', async () => {
    const store = useLobbyStore()
    await store.handleLobbyEvent(makeLobbyEvent(MOCK_LOBBY))
    expect(store.inLobby).toBe(true)
    expect(store.members).toHaveLength(2)
    expect(store.members[0].displayName).toBe('Jim3k')
    expect(store.members[1].displayName).toBe('Ally')
  })

  it('resolves names via summoner endpoint when missing', async () => {
    mockLcu.get.mockResolvedValueOnce({ summonerId: 1, gameName: 'ResolvedName' })
    const store = useLobbyStore()
    await store.handleLobbyEvent(makeLobbyEvent(MOCK_LOBBY_NO_NAMES))
    expect(store.members[0].displayName).toBe('ResolvedName')
  })

  it('clears lobby on Delete event', async () => {
    const store = useLobbyStore()
    await store.handleLobbyEvent(makeLobbyEvent(MOCK_LOBBY))
    await store.handleLobbyEvent(makeLobbyEvent(null, 'Delete'))
    expect(store.inLobby).toBe(false)
  })

  it('tracks received invitations', () => {
    const store = useLobbyStore()
    store.handleInvitationEvent(makeInviteEvent(MOCK_INVITATIONS))
    expect(store.receivedInvitations).toHaveLength(1)
    expect(store.receivedInvitations[0].invitationId).toBe('abc')
  })

  it('invites by summoner ID directly', async () => {
    mockLcu.post.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    await store.inviteById(42)
    expect(mockLcu.post).toHaveBeenCalledWith(
      '/lol-lobby/v2/lobby/invitations',
      [{ toSummonerId: 42 }]
    )
  })

  it('sends an invite by summoner name', async () => {
    mockLcu.get.mockResolvedValueOnce([{ summonerId: 42 }])
    mockLcu.post.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    await store.inviteByName('Ally')
    expect(mockLcu.post).toHaveBeenCalledWith(
      '/lol-lobby/v2/lobby/invitations',
      [{ toSummonerId: 42 }]
    )
  })

  it('accepts a received invitation', async () => {
    mockLcu.post.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    store.handleInvitationEvent(makeInviteEvent(MOCK_INVITATIONS))
    await store.acceptInvitation('abc')
    expect(mockLcu.post).toHaveBeenCalledWith(
      '/lol-lobby/v2/received-invitations/abc/accept'
    )
  })

  it('declines a received invitation', async () => {
    mockLcu.post.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    store.handleInvitationEvent(makeInviteEvent(MOCK_INVITATIONS))
    await store.declineInvitation('abc')
    expect(mockLcu.post).toHaveBeenCalledWith(
      '/lol-lobby/v2/received-invitations/abc/decline'
    )
  })

  it('loads friends and filters online ones', async () => {
    mockLcu.get.mockResolvedValueOnce(MOCK_FRIENDS)
    const store = useLobbyStore()
    await store.loadFriends()
    expect(store.friends).toHaveLength(2)
    expect(store.onlineFriends).toHaveLength(1)
    expect(store.onlineFriends[0].displayName).toBe('Friend1')
  })

  it('resets on disconnect', async () => {
    const store = useLobbyStore()
    await store.handleLobbyEvent(makeLobbyEvent(MOCK_LOBBY))
    store.reset()
    expect(store.inLobby).toBe(false)
    expect(store.members).toHaveLength(0)
  })

  // Queue
  it('starts not in queue', () => {
    const store = useLobbyStore()
    expect(store.inQueue).toBe(false)
    expect(store.timeInQueue).toBe(0)
  })

  it('startQueue posts to the search endpoint and sets inQueue', async () => {
    mockLcu.post.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    await store.startQueue()
    expect(mockLcu.post).toHaveBeenCalledWith('/lol-lobby/v2/lobby/matchmaking/search')
    expect(store.inQueue).toBe(true)
  })

  it('queue timer increments while searching', async () => {
    mockLcu.post.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    await store.startQueue()
    vi.advanceTimersByTime(3000)
    expect(store.timeInQueue).toBe(3)
  })

  it('cancelQueue deletes the search endpoint and clears inQueue', async () => {
    mockLcu.post.mockResolvedValueOnce(undefined)
    mockLcu.delete.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    await store.startQueue()
    await store.cancelQueue()
    expect(mockLcu.delete).toHaveBeenCalledWith('/lol-lobby/v2/lobby/matchmaking/search')
    expect(store.inQueue).toBe(false)
    expect(store.timeInQueue).toBe(0)
  })

  it('timer stops after cancel', async () => {
    mockLcu.post.mockResolvedValueOnce(undefined)
    mockLcu.delete.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    await store.startQueue()
    await store.cancelQueue()
    vi.advanceTimersByTime(5000)
    expect(store.timeInQueue).toBe(0)
  })

  it('clearQueueState clears inQueue and timer', async () => {
    mockLcu.post.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    await store.startQueue()
    store.clearQueueState()
    expect(store.inQueue).toBe(false)
    expect(store.timeInQueue).toBe(0)
  })

  it('reset clears queue state', async () => {
    mockLcu.post.mockResolvedValueOnce(undefined)
    const store = useLobbyStore()
    await store.startQueue()
    store.reset()
    expect(store.inQueue).toBe(false)
  })

  // Sent invitations
  it('parses sent invitations from lobby event', async () => {
    const store = useLobbyStore()
    const lobbyWithInvites = { ...MOCK_LOBBY, invitations: MOCK_SENT_INVITATIONS }
    await store.handleLobbyEvent(makeLobbyEvent(lobbyWithInvites))
    expect(store.sentInvitations).toHaveLength(2)
    expect(store.sentInvitations[0].state).toBe('Pending')
    expect(store.sentInvitations[1].state).toBe('Declined')
  })

  it('sentInvitationsBySummonerId maps by summonerId', async () => {
    const store = useLobbyStore()
    const lobbyWithInvites = { ...MOCK_LOBBY, invitations: MOCK_SENT_INVITATIONS }
    await store.handleLobbyEvent(makeLobbyEvent(lobbyWithInvites))
    expect(store.sentInvitationsBySummonerId.get(20)?.state).toBe('Pending')
    expect(store.sentInvitationsBySummonerId.get(21)?.state).toBe('Declined')
    expect(store.sentInvitationsBySummonerId.get(99)).toBeUndefined()
  })

  it('falls back to toSummonerName for displayName when toDisplayName missing', async () => {
    const store = useLobbyStore()
    const lobbyWithInvites = { ...MOCK_LOBBY, invitations: MOCK_SENT_INVITATIONS }
    await store.handleLobbyEvent(makeLobbyEvent(lobbyWithInvites))
    expect(store.sentInvitations[1].toDisplayName).toBe('Target2')
  })

  it('reset clears sent invitations', async () => {
    const store = useLobbyStore()
    const lobbyWithInvites = { ...MOCK_LOBBY, invitations: MOCK_SENT_INVITATIONS }
    await store.handleLobbyEvent(makeLobbyEvent(lobbyWithInvites))
    store.reset()
    expect(store.sentInvitations).toHaveLength(0)
  })

  // Member availability cross-reference
  it('sets member availability from friends list', async () => {
    mockLcu.get.mockResolvedValueOnce(MOCK_FRIENDS_WITH_DND)
    const store = useLobbyStore()
    await store.loadFriends()
    await store.handleLobbyEvent(makeLobbyEvent(MOCK_LOBBY))
    const ally = store.members.find((m) => m.summonerId === 2)
    expect(ally?.availability).toBe('dnd')
  })

  it('refreshes member availability after loadFriends completes', async () => {
    const store = useLobbyStore()
    // Lobby loads first (no friends yet)
    await store.handleLobbyEvent(makeLobbyEvent(MOCK_LOBBY))
    expect(store.members.find((m) => m.summonerId === 2)?.availability).toBeUndefined()
    // Friends load after
    mockLcu.get.mockResolvedValueOnce(MOCK_FRIENDS_WITH_DND)
    await store.loadFriends()
    expect(store.members.find((m) => m.summonerId === 2)?.availability).toBe('dnd')
  })
})
