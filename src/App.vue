<template>
  <div class="app">
    <StatusBar />
    <main class="content">
      <MatchAcceptCard v-if="connection.status === 'connected'" />

      <template v-if="connection.status === 'disconnected'">
        <p class="idle">Open League of Legends to get started.</p>
      </template>

      <template v-else-if="!mm.isActive">
        <PartyPanel v-if="lobby.inLobby" />
        <p v-else class="idle-connected">Not in a lobby — queue up or join a party in League.</p>

        <ChatPanel v-if="chat.conversations.length > 0" />
      </template>

      <div class="settings-footer">
        <SettingsPanel />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import StatusBar from './views/StatusBar.vue'
import MatchAcceptCard from './views/MatchAcceptCard.vue'
import PartyPanel from './views/PartyPanel.vue'
import ChatPanel from './views/ChatPanel.vue'
import SettingsPanel from './views/SettingsPanel.vue'
import { useConnectionStore } from './stores/connection'
import { useMatchmakingStore } from './stores/matchmaking'
import { useLobbyStore } from './stores/lobby'
import { useChatStore } from './stores/chat'
import { LCU_EVENTS } from '../electron/lcu/endpoints'

const connection = useConnectionStore()
const mm = useMatchmakingStore()
const lobby = useLobbyStore()
const chat = useChatStore()

let unsubConnected: (() => void) | null = null
let unsubDisconnected: (() => void) | null = null
let unsubEvent: (() => void) | null = null

onMounted(async () => {
  unsubConnected = window.lcu.onConnected((info) => {
    connection.onConnected(info)
    lobby.loadFriends()
    chat.loadConversations()
  })

  unsubDisconnected = window.lcu.onDisconnected(() => {
    connection.onDisconnected()
    mm.reset()
    lobby.reset()
    chat.reset()
  })

  unsubEvent = window.lcu.onEvent(async (payload) => {
    switch (payload.eventName) {
      case LCU_EVENTS.READY_CHECK: {
        const rcPayload = payload.data as { data?: { state?: string } }
        mm.handleLcuEvent(rcPayload as Parameters<typeof mm.handleLcuEvent>[0])
        if (rcPayload?.data?.state !== 'InProgress') {
          lobby.clearQueueState()
        }
        break
      }
      case LCU_EVENTS.LOBBY:
        lobby.handleLobbyEvent(payload.data as Parameters<typeof lobby.handleLobbyEvent>[0])
        break
      case LCU_EVENTS.RECEIVED_INVITATIONS:
        lobby.handleInvitationEvent(payload.data as Parameters<typeof lobby.handleInvitationEvent>[0])
        break
      case LCU_EVENTS.CHAT_CONVERSATIONS: {
        // Payload.data.data is the updated conversation object; lastMessage is the newest msg
        const convData = (payload.data as any)?.data
        if (convData?.id) {
          if (convData.lastMessage?.id) {
            chat.handleIncomingMessage(convData.id, convData.lastMessage)
          }
          // If this is a new conversation we don't know about, refresh the list
          if (!chat.conversations.find((c) => c.id === convData.id)) {
            await chat.loadConversations()
          }
        }
        break
      }
    }
  })

  const status = await window.lcu.getStatus()
  if (status.connected && status.port !== undefined) {
    await connection.onConnected({ port: status.port })
    lobby.loadFriends()
    chat.loadConversations()
    try {
      const readyCheck = await window.lcu.get<{ state: string; timer: number; playerResponse: string }>('/lol-matchmaking/v1/ready-check')
      if (readyCheck && (readyCheck as { state: string }).state === 'InProgress') {
        mm.handleLcuEvent({
          data: readyCheck as Parameters<typeof mm.handleLcuEvent>[0]['data'],
          eventType: 'Update',
          uri: '/lol-matchmaking/v1/ready-check'
        })
      }
    } catch { /* no active ready check */ }

    try {
      const lobbyData = await window.lcu.get('/lol-lobby/v2/lobby')
      if (lobbyData) {
        await lobby.handleLobbyEvent({
          data: lobbyData as Parameters<typeof lobby.handleLobbyEvent>[0]['data'],
          eventType: 'Update',
          uri: '/lol-lobby/v2/lobby'
        })
        // Retry chat load now that we know a lobby (and thus a groupchat) exists
        await chat.loadConversations()
      }
    } catch { /* no active lobby */ }
  }
})

onUnmounted(() => {
  unsubConnected?.()
  unsubDisconnected?.()
  unsubEvent?.()
})
</script>

<style>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 20px 16px;
  gap: 16px;
  overflow-y: auto;
  min-height: 0;
}

.idle {
  flex: 1;
  display: flex;
  align-items: center;
  color: var(--text-3);
  font-size: 13px;
}

.idle-connected {
  flex: 1;
  display: flex;
  align-items: center;
  color: var(--text-3);
  font-size: 13px;
  text-align: center;
  line-height: 1.6;
}

.settings-footer {
  width: 100%;
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: auto;
}
</style>
