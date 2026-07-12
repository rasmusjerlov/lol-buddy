export const LCU = {
  CURRENT_SUMMONER: '/lol-summoner/v1/current-summoner',
  READY_CHECK: '/lol-matchmaking/v1/ready-check',
  READY_CHECK_ACCEPT: '/lol-matchmaking/v1/ready-check/accept',
  READY_CHECK_DECLINE: '/lol-matchmaking/v1/ready-check/decline',
  LOBBY: '/lol-lobby/v2/lobby',
  LOBBY_INVITATIONS: '/lol-lobby/v2/lobby/invitations',
  RECEIVED_INVITATIONS: '/lol-lobby/v2/received-invitations',
  CHAT_CONVERSATIONS: '/lol-chat/v1/conversations',
  CHAT_FRIENDS: '/lol-chat/v1/friends',
  CHAT_ME: '/lol-chat/v1/me',
  LOBBY_MATCHMAKING_SEARCH: '/lol-lobby/v2/lobby/matchmaking/search',
  CHAMP_SELECT_SESSION: '/lol-champ-select/v1/session',
  CHAMPION_SUMMARY: '/lol-game-data/assets/v1/champion-summary'
} as const

export const LCU_EVENTS = {
  READY_CHECK: 'OnJsonApiEvent_lol-matchmaking_v1_ready-check',
  LOBBY: 'OnJsonApiEvent_lol-lobby_v2_lobby',
  RECEIVED_INVITATIONS: 'OnJsonApiEvent_lol-lobby_v2_received-invitations',
  CHAT_CONVERSATIONS: 'OnJsonApiEvent_lol-chat_v1_conversations',
  CHAMP_SELECT: 'OnJsonApiEvent_lol-champ-select_v1_session'
} as const
