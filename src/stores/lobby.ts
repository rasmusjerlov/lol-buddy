import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useConnectionStore } from './connection'

export interface LobbyMember {
  summonerId: number
  puuid: string
  ready: boolean
  isLocalMember: boolean
  displayName: string
  availability?: string
}

export interface SentInvitation {
  invitationId: string
  toSummonerId: number
  state: string
  toDisplayName?: string
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
  puuid?: string
  summonerName?: string
  gameName?: string
  ready: boolean
}

interface RawInvitation {
  invitationId: string
  state: string
  timestamp?: string
  toSummonerId: number
  toSummonerName?: string
  toDisplayName?: string
}

interface LobbyData {
  localMember: RawMember
  members: RawMember[]
  gameConfig: { gameMode: string; mapId: number; queueId: number }
  invitations: RawInvitation[]
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
    // Skip displayName — the LCU literally returns the string "Unknown" for Riot-ID accounts
    return info.gameName || info.summonerName || String(summonerId)
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
  const sentInvitations = ref<SentInvitation[]>([])
  const localSummonerId = ref<number | null>(null)
  const inviteError = ref<string | null>(null)
  const friendsLoading = ref(false)
  const inQueue = ref(false)
  const timeInQueue = ref(0)

  let queueTick: ReturnType<typeof setInterval> | null = null

  const inLobby = computed(() => members.value.length > 0)
  const onlineFriends = computed(() =>
    friends.value.filter((f) => f.availability !== 'offline')
  )
  const sentInvitationsBySummonerId = computed(() => {
    const map = new Map<number, SentInvitation>()
    for (const inv of sentInvitations.value) {
      map.set(inv.toSummonerId, inv)
    }
    return map
  })

  async function handleLobbyEvent(payload: LobbyEventPayload): Promise<void> {
    if (payload.eventType === 'Delete' || !payload.data) {
      reset()
      return
    }
    const { members: raw, localMember, gameConfig } = payload.data
    localSummonerId.value = localMember.summonerId
    gameMode.value = gameConfig.gameMode
    queueId.value = gameConfig.queueId

    const connectionStore = useConnectionStore()
    const localSummoner = connectionStore.summoner

    members.value = raw.map((m) => {
      const isLocal = m.summonerId === localMember.summonerId
      let displayName: string
      if (isLocal && localSummoner) {
        // Use the already-resolved summoner data instead of the lobby payload,
        // which omits gameName for Riot-ID accounts
        displayName = localSummoner.gameName || localSummoner.displayName || '…'
      } else {
        displayName = m.gameName || m.summonerName || '…'
      }
      const friend = friends.value.find((f) => f.summonerId === m.summonerId)
      return { summonerId: m.summonerId, puuid: m.puuid ?? '', ready: m.ready, isLocalMember: isLocal, displayName, availability: friend?.availability }
    })

    if (Array.isArray(payload.data.invitations)) {
      sentInvitations.value = payload.data.invitations.map((inv) => ({
        invitationId: inv.invitationId,
        toSummonerId: inv.toSummonerId,
        state: inv.state,
        toDisplayName: inv.toDisplayName || inv.toSummonerName
      }))
    }

    // Resolve names that the lobby payload omitted
    await Promise.all(
      raw.map(async (m) => {
        const isLocal = m.summonerId === localMember.summonerId
        // Already resolved from connection store
        if (isLocal && localSummoner) return
        // Lobby already included a name
        if (m.gameName || m.summonerName) return
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
      // Refresh availability on existing lobby members in case friends loaded after lobby event
      members.value = members.value.map((m) => {
        const friend = friends.value.find((f) => f.summonerId === m.summonerId)
        return friend ? { ...m, availability: friend.availability } : m
      })
    } catch {
      friends.value = []
    } finally {
      friendsLoading.value = false
    }
  }

  function clearQueueState(): void {
    inQueue.value = false
    timeInQueue.value = 0
    if (queueTick !== null) {
      clearInterval(queueTick)
      queueTick = null
    }
  }

  async function startQueue(): Promise<void> {
    await window.lcu.post('/lol-lobby/v2/lobby/matchmaking/search')
    inQueue.value = true
    timeInQueue.value = 0
    queueTick = setInterval(() => { timeInQueue.value++ }, 1000)
  }

  async function cancelQueue(): Promise<void> {
    try {
      await window.lcu.delete('/lol-lobby/v2/lobby/matchmaking/search')
    } catch { /* LCU may return an error; clear local state regardless */ }
    clearQueueState()
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
    sentInvitations.value = []
    localSummonerId.value = null
    inviteError.value = null
    clearQueueState()
  }

  return {
    members,
    friends,
    onlineFriends,
    friendsLoading,
    gameMode,
    queueId,
    receivedInvitations,
    sentInvitations,
    sentInvitationsBySummonerId,
    inviteError,
    inLobby,
    inQueue,
    timeInQueue,
    handleLobbyEvent,
    handleInvitationEvent,
    loadFriends,
    inviteById,
    inviteByName,
    acceptInvitation,
    declineInvitation,
    startQueue,
    cancelQueue,
    clearQueueState,
    reset
  }
})
