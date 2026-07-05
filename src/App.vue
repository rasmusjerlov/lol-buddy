<template>
  <div class="app">
    <StatusBar />

    <main class="content">
      <!-- Match found overlay — shown on top of everything -->
      <MatchAcceptCard v-if="connection.status === 'connected'" />

      <template v-if="connection.status === 'disconnected'">
        <p class="idle">Open League of Legends to get started.</p>
      </template>

      <template v-else-if="!mm.isActive">
        <SettingsPanel />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import StatusBar from './views/StatusBar.vue'
import MatchAcceptCard from './views/MatchAcceptCard.vue'
import SettingsPanel from './views/SettingsPanel.vue'
import { useConnectionStore } from './stores/connection'
import { useMatchmakingStore } from './stores/matchmaking'
import { LCU_EVENTS } from '../electron/lcu/endpoints'

const connection = useConnectionStore()
const mm = useMatchmakingStore()

let unsubConnected: (() => void) | null = null
let unsubDisconnected: (() => void) | null = null
let unsubEvent: (() => void) | null = null

onMounted(async () => {
  unsubConnected = window.lcu.onConnected((info) => connection.onConnected(info))
  unsubDisconnected = window.lcu.onDisconnected(() => {
    connection.onDisconnected()
    mm.reset()
  })

  unsubEvent = window.lcu.onEvent((payload) => {
    if (payload.eventName === LCU_EVENTS.READY_CHECK) {
      mm.handleLcuEvent(payload.data as Parameters<typeof mm.handleLcuEvent>[0])
    }
  })

  // Pull current state if League is already running
  const status = await window.lcu.getStatus()
  if (status.connected && status.port !== undefined) {
    connection.onConnected({ port: status.port })
  }
})

onUnmounted(() => {
  unsubConnected?.()
  unsubDisconnected?.()
  unsubEvent?.()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: #0a0a15;
  color: #e0d5c5;
  height: 100vh;
  overflow: hidden;
  user-select: none;
}

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
  justify-content: center;
  padding: 24px;
  gap: 16px;
  overflow-y: auto;
}

.idle {
  color: #5b5b5b;
  font-size: 14px;
  text-align: center;
}
</style>
