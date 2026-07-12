<template>
  <div class="cs-panel">
    <div class="cs-header">
      <span class="cs-title">Champion Select</span>
      <span class="phase-badge" :class="phaseClass">{{ phaseLabel }}</span>
    </div>

    <div v-if="cs.totalTime > 0" class="timer-bar">
      <div
        class="timer-fill"
        :class="{ urgent: cs.timeLeft <= 5 }"
        :style="{ width: timerPercent + '%' }"
      />
      <span class="timer-label">{{ cs.timeLeft }}s</span>
    </div>

    <div v-if="cs.isMyTurn" class="turn-badge">
      Your turn to pick
    </div>
    <div v-else-if="cs.myAction" class="waiting-badge">
      Waiting for your turn…
    </div>

    <input
      v-model="search"
      type="text"
      class="search-input"
      placeholder="Search champions…"
      @keydown.escape="search = ''"
    />

    <div v-if="cs.loadingChampions" class="loading-text">Loading champions…</div>
    <div v-else class="champ-grid">
      <button
        v-for="champ in filteredChampions"
        :key="champ.id"
        class="champ-cell"
        :class="{
          selected: cs.selectedChampId === champ.id,
          banned: cs.allBans.includes(champ.id)
        }"
        :title="champ.name"
        @click="cs.hoverChampion(champ.id)"
      >
        <div class="icon-wrap">
          <img
            :src="`lcu://${champ.squarePortraitPath}`"
            :alt="champ.name"
            loading="lazy"
            class="champ-icon"
            @error="onImgError"
          />
          <span v-if="cs.allBans.includes(champ.id)" class="ban-overlay">✕</span>
        </div>
        <span class="champ-name">{{ champ.name }}</span>
      </button>
    </div>

    <div v-if="cs.isMyTurn" class="lock-section">
      <div v-if="selectedChampion" class="selected-preview">
        <img
          :src="`lcu://${selectedChampion.squarePortraitPath}`"
          class="preview-icon"
          @error="onImgError"
        />
        <span class="preview-name">{{ selectedChampion.name }}</span>
      </div>
      <button
        class="lock-btn"
        :disabled="!cs.canLockIn"
        @click="cs.lockIn()"
      >
        Lock In
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChampSelectStore } from '../stores/champSelect'

const cs = useChampSelectStore()
const search = ref('')

const phaseLabel = computed(() => {
  switch (cs.phase) {
    case 'PLANNING': return 'Planning'
    case 'BAN_PICK': return 'Pick/Ban'
    case 'FINALIZATION': return 'Finalization'
    case 'GAME_STARTING': return 'Game Starting'
    default: return cs.phase || 'Champion Select'
  }
})

const phaseClass = computed(() => ({
  'phase-pick': cs.phase === 'BAN_PICK' || cs.phase === 'FINALIZATION',
  'phase-plan': cs.phase === 'PLANNING'
}))

const timerPercent = computed(() =>
  cs.totalTime > 0 ? (cs.timeLeft / cs.totalTime) * 100 : 0
)

const filteredChampions = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return cs.champions
  return cs.champions.filter((c) => c.name.toLowerCase().includes(q))
})

const selectedChampion = computed(() =>
  cs.champions.find((c) => c.id === cs.selectedChampId) ?? null
)

function onImgError(e: Event): void {
  ;(e.target as HTMLImageElement).style.display = 'none'
}
</script>

<style scoped>
.cs-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.cs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cs-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-1);
}

.phase-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-4);
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.phase-badge.phase-pick { background: color-mix(in srgb, var(--accent) 20%, var(--bg-4)); color: var(--accent-hi); }

/* Timer */
.timer-bar {
  position: relative;
  height: 6px;
  background: var(--bg-4);
  border-radius: 3px;
  overflow: hidden;
}

.timer-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 1s linear, background 0.3s;
}
.timer-fill.urgent { background: var(--red); }

.timer-label {
  position: absolute;
  right: 0;
  top: 8px;
  font-size: 10px;
  color: var(--text-3);
}

/* Turn indicator */
.turn-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--green);
  text-align: center;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--green) 12%, var(--bg-3));
  border: 1px solid color-mix(in srgb, var(--green) 30%, transparent);
}

.waiting-badge {
  font-size: 11px;
  color: var(--text-3);
  text-align: center;
  padding: 4px 0;
}

/* Search */
.search-input {
  width: 100%;
  padding: 7px 10px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  font-size: 12px;
  outline: none;
  -webkit-app-region: no-drag;
}
.search-input::placeholder { color: var(--text-3); }
.search-input:focus { border-color: var(--accent); }

/* Champion grid */
.loading-text {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
  padding: 16px 0;
}

.champ-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-4) transparent;
}

.champ-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--bg-3);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: border-color 0.12s, background 0.12s, opacity 0.12s;
}
.champ-cell:hover { background: var(--bg-4); border-color: var(--bg-4); }
.champ-cell.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, var(--bg-3)); }
.champ-cell.banned { opacity: 0.35; pointer-events: none; }

.icon-wrap {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 2px;
  overflow: hidden;
  background: var(--bg-4);
  flex-shrink: 0;
}

.champ-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ban-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.6);
  font-size: 16px;
  font-weight: 900;
  color: #fff;
}

.champ-name {
  font-size: 8.5px;
  color: var(--text-2);
  text-align: center;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

/* Lock-in section */
.lock-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.selected-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-icon {
  width: 32px;
  height: 32px;
  border-radius: 2px;
  object-fit: cover;
  background: var(--bg-4);
}

.preview-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.lock-btn {
  width: 100%;
  padding: 11px 0;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: filter 0.15s, transform 0.1s;
}
.lock-btn:hover:not(:disabled) { filter: brightness(1.15); }
.lock-btn:active:not(:disabled) { transform: scale(0.98); }
.lock-btn:disabled { opacity: 0.4; cursor: default; }
</style>
