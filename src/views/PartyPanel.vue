<template>
  <div class="party-panel">

    <!-- Received invitations -->
    <section v-if="lobby.receivedInvitations.length">
      <h3 class="section-label">Invitations</h3>
      <div v-for="inv in lobby.receivedInvitations" :key="inv.invitationId" class="invite-banner">
        <span class="invite-from">{{ inv.fromSummonerName || 'Someone' }} invited you</span>
        <div class="row-actions">
          <button class="chip green" @click="lobby.acceptInvitation(inv.invitationId)">Accept</button>
          <button class="chip red"   @click="lobby.declineInvitation(inv.invitationId)">Decline</button>
        </div>
      </div>
    </section>

    <!-- Online friends (excluding party members already shown below) -->
    <section v-if="invitableFriends.length">
      <h3 class="section-label">
        Friends online
        <span class="badge">{{ invitableFriends.length }}</span>
      </h3>
      <ul class="friend-list">
        <li v-for="friend in invitableFriends" :key="friend.puuid" class="friend-row">
          <span class="status-pip" :class="friend.availability" />
          <span class="friend-name">{{ friend.displayName }}</span>
          <button
            class="invite-btn"
            :class="inviteBtnStateClass(friend.summonerId)"
            :disabled="isInviteBtnDisabled(friend.summonerId)"
            @click="handleInviteClick(friend.summonerId)"
          >
            <span v-if="getInviteStatus(friend.summonerId)?.state === 'Pending'" class="invite-spinner" />
            <span class="invite-label">{{ inviteBtnLabel(friend.summonerId) }}</span>
            <span v-if="getInviteStatus(friend.summonerId)?.state === 'Declined'" class="invite-label retry-label">Retry ↩</span>
          </button>
        </li>
      </ul>
    </section>

    <!-- Party members -->
    <section>
      <h3 class="section-label">
        Party
        <span class="badge">{{ lobby.members.length }} / 5</span>
        <span v-if="lobby.gameMode" class="badge mode">{{ formatMode(lobby.gameMode) }}</span>
      </h3>
      <ul class="member-list">
        <li
          v-for="member in lobby.members"
          :key="member.summonerId"
          class="member-row"
          :class="{ local: member.isLocalMember }"
        >
          <span class="member-pip" :class="memberPipClass(member)" />
          <span class="member-name">{{ member.displayName }}</span>
          <span v-if="member.isLocalMember" class="you-badge">you</span>
          <span v-else-if="member.availability === 'dnd'" class="member-status in-game">In Game</span>
        </li>
      </ul>
    </section>

    <!-- Invite by name -->
    <section>
      <h3 class="section-label">Invite by name</h3>
      <div class="input-row">
        <input
          v-model="inviteName"
          class="text-input"
          placeholder="Summoner name…"
          maxlength="32"
          @keydown.enter="sendInvite"
        />
        <button class="primary-btn" :disabled="!inviteName.trim()" @click="sendInvite">+</button>
      </div>
      <p v-if="lobby.inviteError" class="error-msg">{{ lobby.inviteError }}</p>
    </section>

    <!-- Queue -->
    <section class="queue-section">
      <div v-if="lobby.inQueue" class="queue-row">
        <span class="queue-status">
          <span class="searching-dot" />
          Searching {{ formatTime(lobby.timeInQueue) }}
        </span>
        <button class="chip red" @click="lobby.cancelQueue()">Cancel</button>
      </div>
      <button v-else class="find-match-btn" @click="lobby.startQueue()">
        Find Match
      </button>
    </section>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLobbyStore } from '../stores/lobby'
import type { LobbyMember } from '../stores/lobby'

const lobby = useLobbyStore()
const inviteName = ref('')

const memberSummonerIds = computed(() => new Set(lobby.members.map((m) => m.summonerId)))

const invitableFriends = computed(() =>
  lobby.onlineFriends.filter((f) => !memberSummonerIds.value.has(f.summonerId))
)

function getInviteStatus(summonerId: number) {
  return lobby.sentInvitationsBySummonerId.get(summonerId) ?? null
}

function inviteBtnStateClass(summonerId: number): string {
  const status = getInviteStatus(summonerId)
  return status ? status.state.toLowerCase() : ''
}

function isInviteBtnDisabled(summonerId: number): boolean {
  const state = getInviteStatus(summonerId)?.state
  return state === 'Pending' || state === 'Accepted'
}

function inviteBtnLabel(summonerId: number): string {
  const status = getInviteStatus(summonerId)
  if (!status) return 'Invite'
  const labels: Record<string, string> = {
    Pending: 'Pending',
    Accepted: 'Joined!',
    Declined: 'Declined',
    Revoked: 'Invite',
    Error: 'Retry',
  }
  return labels[status.state] ?? 'Invite'
}

function handleInviteClick(summonerId: number): void {
  const state = getInviteStatus(summonerId)?.state
  if (!state || state === 'Declined' || state === 'Revoked' || state === 'Error') {
    lobby.inviteById(summonerId)
  }
}

function memberPipClass(member: LobbyMember): string {
  if (member.isLocalMember) return 'local'
  if (member.availability === 'dnd') return 'in-game'
  if (member.availability === 'chat') return 'online'
  if (member.availability === 'away') return 'away'
  return ''
}

async function sendInvite(): Promise<void> {
  const name = inviteName.value.trim()
  if (!name) return
  await lobby.inviteByName(name)
  if (!lobby.inviteError) inviteName.value = ''
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatMode(mode: string): string {
  const map: Record<string, string> = {
    CLASSIC: "Summoner's Rift",
    ARAM: 'ARAM',
    CHERRY: 'ARAM: Mayhem',
    KIWI: 'ARAM: Mayhem',
    URF: 'URF',
    ONEFORALL: 'One for All',
  }
  return map[mode] ?? mode
}
</script>

<style scoped>
.party-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* Section */
section { display: flex; flex-direction: column; gap: 8px; }

.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-2);
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-1);
  background: var(--bg-4);
  border-radius: 20px;
  padding: 1px 7px;
  letter-spacing: 0;
  text-transform: none;
}

.badge.mode {
  color: var(--accent-hi);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

/* Invitation banner */
.invite-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-3));
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  gap: 12px;
}

.invite-from {
  font-size: 13px;
  color: var(--text-1);
  font-weight: 500;
}

.row-actions { display: flex; gap: 6px; }

.chip {
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: filter 0.15s;
}
.chip:hover { filter: brightness(1.15); }
.chip.green { background: var(--green); color: #fff; }
.chip.red   { background: var(--red);   color: #fff; }

/* Member list */
.member-list, .friend-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-3);
  font-size: 13px;
  color: var(--text-1);
}

.member-row.local {
  background: color-mix(in srgb, var(--gold) 8%, var(--bg-3));
  color: var(--gold);
  font-weight: 600;
}

.member-pip {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bg-4);
  flex-shrink: 0;
}
.member-pip.local   { background: var(--gold); }
.member-pip.online  { background: var(--green); box-shadow: 0 0 4px var(--green); }
.member-pip.away    { background: var(--amber); }
.member-pip.in-game { background: var(--red);   box-shadow: 0 0 4px var(--red); }

.you-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gold);
  opacity: 0.6;
}

.member-status {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: var(--radius-sm);
  padding: 2px 7px;
}

.member-status.in-game {
  background: color-mix(in srgb, var(--red) 15%, transparent);
  color: var(--red);
}

/* Friends */
.friend-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-3);
  font-size: 13px;
}

.status-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-3);
}
.status-pip.chat   { background: var(--green);  box-shadow: 0 0 5px var(--green); }
.status-pip.away   { background: var(--amber);  box-shadow: 0 0 5px var(--amber); }
.status-pip.dnd    { background: var(--red);    box-shadow: 0 0 5px var(--red); }
.status-pip.mobile { background: var(--blue);   box-shadow: 0 0 5px var(--blue); }

.friend-name { flex: 1; color: var(--text-1); }

.invite-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  color: var(--accent-hi);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.invite-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 35%, transparent);
  color: #fff;
}
.invite-btn:disabled { cursor: default; }

.invite-btn.pending {
  color: var(--amber);
  background: color-mix(in srgb, var(--amber) 14%, transparent);
  border-color: color-mix(in srgb, var(--amber) 30%, transparent);
}

.invite-btn.accepted {
  color: var(--green);
  background: color-mix(in srgb, var(--green) 14%, transparent);
  border-color: color-mix(in srgb, var(--green) 30%, transparent);
}

.invite-btn.declined {
  color: var(--red);
  background: color-mix(in srgb, var(--red) 14%, transparent);
  border-color: color-mix(in srgb, var(--red) 30%, transparent);
}
.invite-btn.declined:hover {
  background: color-mix(in srgb, var(--red) 28%, transparent);
  color: #fff;
}

/* Swap "Declined" → "Retry ↩" text on hover */
.retry-label { display: none; }
.invite-btn.declined:hover .invite-label:not(.retry-label) { display: none; }
.invite-btn.declined:hover .retry-label { display: inline; }

/* Pending spinner */
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.invite-spinner {
  width: 10px;
  height: 10px;
  border: 2px solid color-mix(in srgb, var(--amber) 30%, transparent);
  border-top-color: var(--amber);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

/* Invite input */
.input-row { display: flex; gap: 8px; }

.text-input {
  flex: 1;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
  -webkit-app-region: no-drag;
  transition: border-color 0.15s;
}
.text-input:focus { border-color: var(--accent); }
.text-input::placeholder { color: var(--text-3); }

.primary-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background 0.15s;
}
.primary-btn:hover:not(:disabled) { background: var(--accent-hi); }
.primary-btn:disabled { opacity: 0.35; cursor: default; }

.error-msg { font-size: 12px; color: var(--red); margin-top: 2px; }

/* Queue */
.queue-section { margin-top: 4px; }

.find-match-btn {
  width: 100%;
  padding: 11px 0;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background 0.15s, transform 0.1s;
}
.find-match-btn:hover  { background: var(--accent-hi); }
.find-match-btn:active { transform: scale(0.98); }

.queue-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-3));
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.queue-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.searching-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
  animation: pulse 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}
</style>
