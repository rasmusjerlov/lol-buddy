<template>
  <div class="app">
    <StatusBar />
    <main class="content">
      <div v-if="connection.status === 'disconnected'" class="idle-state">
        <p>Open League of Legends to get started.</p>
      </div>
      <div v-else class="connected-state">
        <p class="placeholder">Features coming soon…</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import StatusBar from './views/StatusBar.vue'
import { useConnectionStore } from './stores/connection'

const connection = useConnectionStore()

let unsubConnected: (() => void) | null = null
let unsubDisconnected: (() => void) | null = null

onMounted(() => {
  unsubConnected = window.lcu.onConnected((info) => connection.onConnected(info))
  unsubDisconnected = window.lcu.onDisconnected(() => connection.onDisconnected())
})

onUnmounted(() => {
  unsubConnected?.()
  unsubDisconnected?.()
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
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.idle-state p,
.connected-state .placeholder {
  color: #5b5b5b;
  font-size: 14px;
  text-align: center;
}
</style>
