<template>
  <Transition name="card">
    <div v-if="mm.isActive" class="accept-card">
      <p class="title">Match Found</p>

      <div class="timer-ring" :class="urgencyClass">
        <svg viewBox="0 0 64 64" class="ring-svg">
          <circle class="track" cx="32" cy="32" r="28" />
          <circle
            class="progress"
            cx="32"
            cy="32"
            r="28"
            :stroke-dashoffset="dashOffset"
          />
        </svg>
        <span class="timer-label">{{ mm.countdown }}</span>
      </div>

      <div v-if="mm.playerResponse === 'Accepted'" class="response accepted">
        Accepted ✓
      </div>
      <div v-else-if="mm.playerResponse === 'Declined'" class="response declined">
        Declined ✗
      </div>
      <div v-else class="actions">
        <button class="btn accept" @click="mm.accept()">Accept</button>
        <button class="btn decline" @click="mm.decline()">Decline</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMatchmakingStore } from '../stores/matchmaking'

const mm = useMatchmakingStore()

const TOTAL = 12 // LCU ready-check window is 12 seconds
const CIRCUMFERENCE = 2 * Math.PI * 28 // ≈ 175.9

const dashOffset = computed(() => {
  const fraction = Math.max(0, mm.countdown) / TOTAL
  return CIRCUMFERENCE * (1 - fraction)
})

const urgencyClass = computed(() => {
  if (mm.countdown <= 3) return 'urgent'
  if (mm.countdown <= 6) return 'warning'
  return ''
})
</script>

<style scoped>
.accept-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 32px 24px;
  background: #0f0f1e;
  border: 1px solid #785a28;
  border-radius: 8px;
  width: 100%;
  max-width: 280px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #c8aa6e;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Ring timer */
.timer-ring {
  position: relative;
  width: 88px;
  height: 88px;
}

.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.track {
  fill: none;
  stroke: #1e1e3a;
  stroke-width: 5;
}

.progress {
  fill: none;
  stroke: #c8aa6e;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 175.9;
  transition: stroke-dashoffset 1s linear, stroke 0.3s;
}

.timer-ring.warning .progress { stroke: #f0a800; }
.timer-ring.urgent  .progress { stroke: #e84057; }

.timer-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 700;
  color: #e0d5c5;
}

/* Buttons */
.actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.btn {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  -webkit-app-region: no-drag;
}

.btn:active { transform: scale(0.97); }

.btn.accept  { background: #1ea448; color: #fff; }
.btn.accept:hover  { background: #25be57; }
.btn.decline { background: #8b1a1a; color: #ffb0b0; }
.btn.decline:hover { background: #a82020; }

/* Post-response label */
.response {
  font-size: 15px;
  font-weight: 600;
  padding: 8px 20px;
  border-radius: 4px;
}
.response.accepted { color: #1ea448; }
.response.declined  { color: #e84057; }

/* Entry animation */
.card-enter-active { transition: all 0.25s ease-out; }
.card-leave-active { transition: all 0.2s ease-in; }
.card-enter-from, .card-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.97);
}
</style>
