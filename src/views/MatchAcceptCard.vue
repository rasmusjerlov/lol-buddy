<template>
  <Transition name="card">
    <div v-if="mm.isActive" class="accept-card">
      <p class="title">Match Found</p>

      <div class="timer-wrap" :class="urgencyClass">
        <svg viewBox="0 0 64 64" class="ring">
          <circle class="track" cx="32" cy="32" r="26" />
          <circle class="arc" cx="32" cy="32" r="26" :stroke-dashoffset="dashOffset" />
        </svg>
        <span class="timer-num">{{ mm.countdown }}</span>
      </div>

      <div v-if="mm.playerResponse === 'Accepted'" class="response-label accepted">
        ✓ Accepted
      </div>
      <div v-else-if="mm.playerResponse === 'Declined'" class="response-label declined">
        ✗ Declined
      </div>
      <div v-else class="btn-row">
        <button class="action-btn accept" @click="mm.accept()">Accept</button>
        <button class="action-btn decline" @click="mm.decline()">Decline</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMatchmakingStore } from '../stores/matchmaking'

const mm = useMatchmakingStore()

const TOTAL = 12
const CIRC = 2 * Math.PI * 26  // ≈ 163.4

const dashOffset = computed(() => CIRC * (1 - Math.max(0, mm.countdown) / TOTAL))
const urgencyClass = computed(() => {
  if (mm.countdown <= 3) return 'urgent'
  if (mm.countdown <= 6) return 'warn'
  return ''
})
</script>

<style scoped>
.accept-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 28px 20px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 260px;
}

.title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-1);
}

/* Ring timer */
.timer-wrap {
  position: relative;
  width: 84px;
  height: 84px;
}

.ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.track {
  fill: none;
  stroke: var(--bg-4);
  stroke-width: 5;
}

.arc {
  fill: none;
  stroke: var(--accent);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 163.4;
  transition: stroke-dashoffset 1s linear, stroke 0.4s;
}

.timer-wrap.warn  .arc { stroke: var(--amber); }
.timer-wrap.urgent .arc { stroke: var(--red); }

.timer-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
  color: var(--text-1);
}

/* Buttons */
.btn-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

.action-btn {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: filter 0.15s, transform 0.1s;
}
.action-btn:active { transform: scale(0.97); }
.action-btn.accept  { background: var(--green); color: #fff; }
.action-btn.accept:hover  { filter: brightness(1.15); }
.action-btn.decline { background: var(--bg-4); color: var(--red); border: 1px solid var(--red); }
.action-btn.decline:hover { background: color-mix(in srgb, var(--red) 15%, var(--bg-4)); }

/* Post-response */
.response-label {
  font-size: 15px;
  font-weight: 700;
  padding: 8px 24px;
  border-radius: var(--radius-sm);
}
.response-label.accepted { color: var(--green); }
.response-label.declined  { color: var(--red); }

/* Entry animation */
.card-enter-active { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.card-leave-active { transition: all 0.18s ease-in; }
.card-enter-from, .card-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>
