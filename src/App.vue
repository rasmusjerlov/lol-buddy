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
        <div class="settings-footer">
          <SettingsPanel />
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import StatusBar from './views/StatusBar.vue'
import MatchAcceptCard from './views/MatchAcceptCard.vue'
import PartyPanel from './views/PartyPanel.vue'
import SettingsPanel from './views/SettingsPanel.vue'
import { useConnectionStore } from './stores/connection'
import { useMatchmakingStore } from './stores/matchmaking'
import { useLobbyStore } from './stores/lobby'
import { LCU_EVENTS } from '../electron/lcu/endpoints'

const connection = useConnectionStore()
const mm = useMatchmakingStore()
const lobby = useLobbyStore()

let unsubConnected: (() => void) | null = null
let unsubDisconnected: (() => void) | null = null
let unsubEvent: (() => void) | null = null

onMounted(async () => {
  unsubConnected = window.lcu.onConnected((info) => {
    connection.onConnected(info)
    lobby.loadFriends()
  })

  unsubDisconnected = window.lcu.onDisconnected(() => {
    connection.onDisconnected()
    mm.reset()
    lobby.reset()
  })

  unsubEvent = window.lcu.onEvent((payload) => {
    switch (payload.eventName) {
      case LCU_EVENTS.READY_CHECK:
        mm.handleLcuEvent(payload.data as Parameters<typeof mm.handleLcuEvent>[0])
        break
      case LCU_EVENTS.LOBBY:
        lobby.handleLobbyEvent(payload.data as Parameters<typeof lobby.handleLobbyEvent>[0])
        break
      case LCU_EVENTS.RECEIVED_INVITATIONS:
        lobby.handleInvitationEvent(payload.data as Parameters<typeof lobby.handleInvitationEvent>[0])
        break
    }
  })

  const status = await window.lcu.getStatus()
  if (status.connected && status.port !== undefined) {
    await connection.onConnected({ port: status.port })
    lobby.loadFriends()
    try {
      const lobbyData = await window.lcu.get('/lol-lobby/v2/lobby')
      if (lobbyData) {
        await lobby.handleLobbyEvent({
          data: lobbyData as Parameters<typeof lobby.handleLobbyEvent>[0]['data'],
          eventType: 'Update',
          uri: '/lol-lobby/v2/lobby'
        })
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
