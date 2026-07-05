import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface LobbyMember {
  summonerId: number
  ready: boolean
  isLocalMember: boolean
  displayName: string
}

export interface Friend {
  summonerId: number
  puuid: string
  gameName: string
  gameTag: string
  name: string
  availability: 'chat' | 'away' | 'dnd' | 'mobile' | 'offline' | string
  displayName: string
}

export interface ReceivedInvitation {
  invitationId: string
  state: string
  timestamp: string
  toSummonerId: number
  fromSummonerName?: string
}

interface RawMember {
  summonerId: number
  summonerName?: string
  gameName?: string
  ready: boolean
}

interface LobbyData {
  localMember: RawMember
  members: RawMember[]
  gameConfig: { gameMode: string; mapId: number; queueId: number }
  invitations: unknown[]
}

interface LobbyEventPayload {
  data: LobbyData | null
  eventType: string
  uri: string
}

interface InvitationEventPayload {
  data: ReceivedInvitation[]
  eventType: string
  uri: string
}

interface SummonerInfo {
  summonerId: number
  gameName: string
  displayName?: string
  summonerName?: string
}

async function resolveName(summonerId: number): Promise<string> {
  try {
    const info = await window.lcu.get<SummonerInfo>(`/lol-summoner/v1/summoners/${summonerId}`)
    return info.gameName || info.displayName || info.summonerName || String(summonerId)
  } catch {
    return String(summonerId)
  }
}

export const useLobbyStore = defineStore('lobby', () => {
  const members = ref<LobbyMember[]>([])
  const friends = ref<Friend[]>([])
  const gameMode = ref<string | null>(null)
  const queueId = ref<number | null>(null)
  const receivedInvitations = ref<ReceivedInvitation[]>([])
  const localSummonerId = ref<number | null>(null)
  const inviteError = ref<string | null>(null)
  const friendsLoading = ref(false)

  const inLobby = computed(() => members.value.length > 0)
  const onlineFriends = computed(() =>
    friends.value.filter((f) => f.availability !== 'offline')
  )

  async function handleLobbyEvent(payload: LobbyEventPayload): Promise<void> {
    if (payload.eventType === 'Delete' || !payload.data) {
      reset()
      return
    }
    const { members: raw, localMember, gameConfig } = payload.data
    localSummonerId.value = localMember.summonerId
    gameMode.value = gameConfig.gameMode
    queueId.value = gameConfig.queueId

    // Set members immediately with placeholder names, then resolve async
    members.value = raw.map((m) => ({
      summonerId: m.summonerId,
      ready: m.ready,
      isLocalMember: m.summonerId === localMember.summonerId,
      displayName: m.gameName || m.summonerName || '…'
    }))

    // Resolve real names from summoner endpoint (LCU omits them from lobby data)
    await Promise.all(
      raw.map(async (m) => {
        if (m.gameName || m.summonerName) return // already have a name
        const name = await resolveName(m.summonerId)
        const entry = members.value.find((e) => e.summonerId === m.summonerId)
        if (entry) entry.displayName = name
      })
    )
  }

  function handleInvitationEvent(payload: InvitationEventPayload): void {
    if (Array.isArray(payload.data)) {
      receivedInvitations.value = payload.data
    }
  }

  async function loadFriends(): Promise<void> {
    friendsLoading.value = true
    try {
      const raw = await window.lcu.get<Friend[]>('/lol-chat/v1/friends')
      friends.value = (raw ?? []).map((f) => ({
        ...f,
        displayName: f.gameName || f.name || 'Unknown'
      }))
    } catch {
      friends.value = []
    } finally {
      friendsLoading.value = false
    }
  }

  async function inviteById(summonerId: number): Promise<void> {
    inviteError.value = null
    try {
      await window.lcu.post('/lol-lobby/v2/lobby/invitations', [{ toSummonerId: summonerId }])
    } catch (e) {
      inviteError.value = e instanceof Error ? e.message : 'Invite failed'
    }
  }

  async function inviteByName(name: string): Promise<void> {
    inviteError.value = null
    try {
      const results = await window.lcu.get<SummonerInfo[]>(
        `/lol-summoner/v1/summoners?name=${encodeURIComponent(name)}`
      )
      if (!results || results.length === 0) {
        inviteError.value = `Summoner "${name}" not found`
        return
      }
      await inviteById(results[0].summonerId)
    } catch (e) {
      inviteError.value = e instanceof Error ? e.message : 'Invite failed'
    }
  }

  async function acceptInvitation(invitationId: string): Promise<void> {
    await window.lcu.post(`/lol-lobby/v2/received-invitations/${invitationId}/accept`)
    receivedInvitations.value = receivedInvitations.value.filter(
      (i) => i.invitationId !== invitationId
    )
  }

  async function declineInvitation(invitationId: string): Promise<void> {
    await window.lcu.post(`/lol-lobby/v2/received-invitations/${invitationId}/decline`)
    receivedInvitations.value = receivedInvitations.value.filter(
      (i) => i.invitationId !== invitationId
    )
  }

  function reset(): void {
    members.value = []
    gameMode.value = null
    queueId.value = null
    receivedInvitations.value = []
    localSummonerId.value = null
    inviteError.value = null
  }

  return {
    members,
    friends,
    onlineFriends,
    friendsLoading,
    gameMode,
    queueId,
    receivedInvitations,
    inviteError,
    inLobby,
    handleLobbyEvent,
    handleInvitationEvent,
    loadFriends,
    inviteById,
    inviteByName,
    acceptInvitation,
    declineInvitation,
    reset
  }
})
