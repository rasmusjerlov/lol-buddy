import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './chat'

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

const LOBBY_CONV = {
  id: 'conv-abc',
  type: 'groupchat',
  gameName: '',
  name: 'Lobby',
  unreadMessageCount: 0,
  lastMessage: null
}

const DM_CONV = {
  id: 'conv-dm1',
  type: 'chat',
  gameName: 'Friend1',
  name: 'Friend1',
  unreadMessageCount: 2,
  lastMessage: null
}

const MOCK_MESSAGES = [
  { id: 'msg1', body: 'Hello!', fromSummonerId: 1, fromObfuscatedSummonerId: 1,
    timestamp: '2026-07-05T10:00:00', type: 'chat', isHistorical: false },
  { id: 'msg2', body: 'Hey there', fromSummonerId: 2, fromObfuscatedSummonerId: 2,
    timestamp: '2026-07-05T10:01:00', type: 'chat', isHistorical: false }
]

describe('useChatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts empty', () => {
    const store = useChatStore()
    expect(store.conversations).toHaveLength(0)
    expect(store.activeConversationId).toBeNull()
  })

  it('loads conversations and auto-selects lobby', async () => {
    mockLcu.get.mockResolvedValueOnce([LOBBY_CONV, DM_CONV])
    const store = useChatStore()
    await store.loadConversations()
    expect(store.conversations).toHaveLength(2)
    expect(store.activeConversationId).toBe('conv-abc')
  })

  it('loads messages for active conversation', async () => {
    mockLcu.get
      .mockResolvedValueOnce([LOBBY_CONV])
      .mockResolvedValueOnce(MOCK_MESSAGES)
    const store = useChatStore()
    await store.loadConversations()
    await store.selectConversation('conv-abc')
    expect(store.activeMessages).toHaveLength(2)
    expect(store.activeMessages[0].body).toBe('Hello!')
  })

  it('sends a message and re-fetches to show it locally', async () => {
    const sentMsg = { id: 'msg-sent', body: 'gg', fromSummonerId: 1, timestamp: '2026-07-05T10:05:00', type: 'chat', isHistorical: false }
    mockLcu.get
      .mockResolvedValueOnce([LOBBY_CONV])   // loadConversations
      .mockResolvedValueOnce([])              // selectConversation (initial messages)
      .mockResolvedValueOnce([sentMsg])       // re-fetch after send
    mockLcu.post.mockResolvedValueOnce(undefined)
    const store = useChatStore()
    await store.loadConversations()
    await store.sendMessage('conv-abc', 'gg')
    expect(mockLcu.post).toHaveBeenCalledWith(
      '/lol-chat/v1/conversations/conv-abc/messages',
      { body: 'gg', type: 'chat' }
    )
    expect(store.activeMessages).toHaveLength(1)
    expect(store.activeMessages[0].body).toBe('gg')
  })

  it('appends incoming message to correct conversation', async () => {
    mockLcu.get
      .mockResolvedValueOnce([LOBBY_CONV])
      .mockResolvedValueOnce([])
    const store = useChatStore()
    await store.loadConversations()
    await store.selectConversation('conv-abc')
    store.handleIncomingMessage('conv-abc', {
      id: 'msg-new', body: 'hi', fromSummonerId: 3,
      timestamp: '2026-07-05T10:02:00', type: 'chat', isHistorical: false
    })
    expect(store.activeMessages).toHaveLength(1)
    expect(store.activeMessages[0].body).toBe('hi')
  })

  it('increments unread count for non-active conversation', async () => {
    mockLcu.get.mockResolvedValueOnce([LOBBY_CONV, DM_CONV]).mockResolvedValueOnce([])
    const store = useChatStore()
    await store.loadConversations()
    await store.selectConversation('conv-abc')
    store.handleIncomingMessage('conv-dm1', {
      id: 'msg-x', body: 'hey', fromSummonerId: 5,
      timestamp: '2026-07-05T10:03:00', type: 'chat', isHistorical: false
    })
    const dm = store.conversations.find(c => c.id === 'conv-dm1')
    expect(dm?.unread).toBe(1) // we track unread locally, ignoring LCU's total count
  })

  it('resets on disconnect', async () => {
    mockLcu.get.mockResolvedValueOnce([LOBBY_CONV])
    const store = useChatStore()
    await store.loadConversations()
    store.reset()
    expect(store.conversations).toHaveLength(0)
    expect(store.activeConversationId).toBeNull()
  })
})
