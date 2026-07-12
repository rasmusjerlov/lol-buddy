import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ChatMessage {
  id: string
  body: string
  fromSummonerId: number
  fromPuuid?: string
  fromId?: string
  timestamp: string
  type: string
  isHistorical: boolean
}

export interface Conversation {
  id: string
  type: string
  name: string
  gameName: string
  unread: number
}

// LCU uses 'chat' for DMs and 'groupchat' for MUC rooms (lobby, pre-game)
function isUserMessage(msg: { type: string }): boolean {
  return msg.type === 'chat' || msg.type === 'groupchat'
}

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([])
  const messagesByConv = ref<Record<string, ChatMessage[]>>({})
  const activeConversationId = ref<string | null>(null)

  const activeMessages = computed<ChatMessage[]>(() =>
    activeConversationId.value ? (messagesByConv.value[activeConversationId.value] ?? []) : []
  )

  const activeConversation = computed<Conversation | undefined>(() =>
    conversations.value.find(c => c.id === activeConversationId.value)
  )

  async function loadConversations(): Promise<void> {
    try {
      const raw = await window.lcu.get<any[]>('/lol-chat/v1/conversations')
      if (!Array.isArray(raw) || raw.length === 0) return

      const previous = activeConversationId.value
      const prevConvs = conversations.value
      conversations.value = raw.map(c => {
        const isLobby = c.type === 'groupchat' || String(c.id).includes('pre-game') || String(c.id).includes('pregame')
        // Preserve our locally-tracked unread count; LCU's unreadMessageCount is total, not delta
        const existing = prevConvs.find(ec => ec.id === c.id)
        return {
          id: c.id,
          type: c.type,
          name: isLobby ? 'Lobby' : (c.gameName || c.name || c.id),
          gameName: c.gameName ?? '',
          unread: existing?.unread ?? 0
        }
      })

      // Prefer the previous selection; otherwise auto-select the lobby/pre-game chat
      const keepSelection = previous && conversations.value.find(c => c.id === previous)
      if (!keepSelection) {
        const lobby = conversations.value.find(
          c => c.type === 'groupchat' || c.id.includes('pre-game') || c.id.includes('pregame')
        )
        if (lobby) await selectConversation(lobby.id)
      }
    } catch {
      // Chat API not ready yet — panel stays hidden until next event triggers a reload
    }
  }

  async function selectConversation(id: string): Promise<void> {
    activeConversationId.value = id
    // Mark unread as read
    const conv = conversations.value.find(c => c.id === id)
    if (conv) conv.unread = 0

    if (messagesByConv.value[id] === undefined) {
      const msgs = await window.lcu.get<ChatMessage[]>(`/lol-chat/v1/conversations/${id}/messages`)
      messagesByConv.value[id] = (msgs ?? []).filter(isUserMessage)
    }
  }

  async function sendMessage(conversationId: string, body: string): Promise<void> {
    await window.lcu.post(`/lol-chat/v1/conversations/${conversationId}/messages`, {
      body,
      type: 'chat'
    })
    // LCU does not push sent messages back via WebSocket — re-fetch to show them
    try {
      const msgs = await window.lcu.get<ChatMessage[]>(
        `/lol-chat/v1/conversations/${conversationId}/messages`
      )
      if (Array.isArray(msgs)) {
        messagesByConv.value[conversationId] = msgs.filter(isUserMessage)
      }
    } catch { /* best-effort */ }
  }

  function handleIncomingMessage(conversationId: string, msg: ChatMessage): void {
    if (!isUserMessage(msg) || msg.isHistorical) return

    if (!messagesByConv.value[conversationId]) {
      messagesByConv.value[conversationId] = []
    }
    // Only act on genuinely new messages
    const existing = messagesByConv.value[conversationId]
    if (existing.find(m => m.id === msg.id)) return

    existing.push(msg)

    if (conversationId !== activeConversationId.value) {
      const conv = conversations.value.find(c => c.id === conversationId)
      if (conv) conv.unread++
    }
  }

  function reset(): void {
    conversations.value = []
    messagesByConv.value = {}
    activeConversationId.value = null
  }

  return {
    conversations,
    activeConversationId,
    activeMessages,
    activeConversation,
    loadConversations,
    selectConversation,
    sendMessage,
    handleIncomingMessage,
    reset
  }
})
