<template>
  <div class="chat-panel">
    <div class="chat-header">
      <h3 class="section-label">Chat</h3>
      <div class="conv-tabs" v-if="chat.conversations.length > 1">
        <button
          v-for="conv in chat.conversations"
          :key="conv.id"
          class="conv-tab"
          :class="{ active: chat.activeConversationId === conv.id }"
          @click="chat.selectConversation(conv.id)"
        >
          <span class="tab-label">{{ isLobbyConv(conv.id, conv.type) ? 'Lobby' : conv.name }}</span>
          <span v-if="conv.unread > 0 && chat.activeConversationId !== conv.id" class="unread-pip">
            {{ conv.unread > 9 ? '9+' : conv.unread }}
          </span>
        </button>
      </div>
    </div>

    <div class="messages" ref="messagesEl">
      <div
        v-for="msg in chat.activeMessages"
        :key="msg.id"
        class="message"
        :class="{ mine: isMine(msg) }"
      >
        <div class="bubble-wrap">
          <span v-if="!isMine(msg) && chat.activeConversation?.type !== 'chat'" class="sender-name">
            {{ senderName(msg) }}
          </span>
          <span class="bubble">{{ msg.body }}</span>
        </div>
      </div>
      <div v-if="chat.activeMessages.length === 0" class="empty-chat">
        No messages yet
      </div>
    </div>

    <form class="input-row" @submit.prevent="send">
      <input
        v-model="draft"
        class="chat-input"
        placeholder="Send a message…"
        :disabled="!chat.activeConversationId"
        maxlength="500"
      />
      <button type="submit" class="send-btn" :disabled="!draft.trim() || !chat.activeConversationId">
        Send
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useChatStore } from '../stores/chat'
import { useConnectionStore } from '../stores/connection'
import { useLobbyStore } from '../stores/lobby'

const chat = useChatStore()
const connection = useConnectionStore()
const lobby = useLobbyStore()
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)

function isMine(msg: { fromPuuid?: string; fromSummonerId: number }): boolean {
  const s = connection.summoner
  if (!s) return false
  if (msg.fromPuuid && s.puuid) return msg.fromPuuid === s.puuid
  return msg.fromSummonerId !== 0 && msg.fromSummonerId === s.summonerId
}

function isLobbyConv(id: string, type: string): boolean {
  return type === 'groupchat' || id.includes('pre-game') || id.includes('pregame')
}

function senderName(msg: { fromSummonerId: number; fromPuuid?: string }): string {
  // Prefer PUUID match — groupchat messages have fromSummonerId: 0
  if (msg.fromPuuid) {
    const byPuuid = lobby.members.find(m => m.puuid === msg.fromPuuid)
    if (byPuuid?.displayName) return byPuuid.displayName
  }
  // Fallback: summonerId match (works for DM chats)
  if (msg.fromSummonerId) {
    const byId = lobby.members.find(m => m.summonerId === msg.fromSummonerId)
    if (byId?.displayName) return byId.displayName
  }
  return '?'
}

async function send(): Promise<void> {
  const text = draft.value.trim()
  if (!text || !chat.activeConversationId) return
  draft.value = ''
  await chat.sendMessage(chat.activeConversationId, text)
}

function scrollToBottom(): void {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

watch(() => chat.activeMessages.length, scrollToBottom)
watch(() => chat.activeConversationId, scrollToBottom)
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  min-height: 0;
  flex: 1;
}

.chat-header {
  padding: 10px 12px 0;
  flex-shrink: 0;
}

.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-2);
  margin-bottom: 8px;
}

.conv-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
  margin: 0 -12px;
  padding: 0 12px;
}

.conv-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: none;
  background: transparent;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s;
  -webkit-app-region: no-drag;
}

.conv-tab:hover { color: var(--text-1); }
.conv-tab.active {
  color: var(--accent-hi);
  border-bottom-color: var(--accent);
}

.unread-pip {
  background: var(--accent);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  min-width: 15px;
  height: 15px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  min-height: 0;
}

.message {
  display: flex;
  justify-content: flex-start;
}

.message.mine {
  justify-content: flex-end;
}

.bubble-wrap {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  gap: 2px;
}

.message.mine .bubble-wrap {
  align-items: flex-end;
}

.sender-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
  padding: 0 4px;
}

.bubble {
  padding: 5px 10px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.4;
  background: var(--bg-4);
  color: var(--text-1);
  word-break: break-word;
}

.message.mine .bubble {
  background: var(--accent);
  color: #fff;
}

.empty-chat {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
  margin: auto;
}

.input-row {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-3);
}

.chat-input {
  flex: 1;
  background: var(--bg-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  transition: border-color 0.15s;
  -webkit-app-region: no-drag;
}

.chat-input::placeholder { color: var(--text-3); }
.chat-input:focus { border-color: var(--accent); }

.send-btn {
  padding: 5px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  -webkit-app-region: no-drag;
}

.send-btn:disabled { opacity: 0.4; cursor: default; }
.send-btn:not(:disabled):hover { opacity: 0.85; }
</style>
