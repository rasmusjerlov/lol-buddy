# Project Plan: League Companion Client ("LoL Buddy")

## 1. Overview

A desktop companion app for League of Legends, similar in spirit to Blitz, built for personal use among a small friend group. It hooks into the official League Client Update (LCU) local API to provide:

- **Match accept** — one-click or auto-accept ready checks
- **Party invites** — send/accept/manage lobby invites
- **Chat** — lobby/champ-select chat + friends list + direct messages

This is a *client augmentation tool*, not a game-modifying tool. It does not touch match gameplay, memory, or the game process itself — only the local League Client's HTTP/WebSocket API, the same surface Riot's own client UI uses.

## 2. Goals & Non-Goals

**Goals**
- Working app for you and your friend group, distributed as a manually-installed Windows executable (GitHub Releases)
- Core LCU feature parity: matchmaking, invites, chat
- Clean, maintainable Vue codebase you can keep extending (stats overlays, champ select tools, etc. later)

**Non-Goals (v1)**
- No gameplay automation, scripting, or in-game overlays that read/write game memory
- No public distribution / auto-updater infrastructure (manual installs only for now)
- No Riot Web API integration yet (match history, ranked stats) — pure LCU for v1

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron | Cross-platform dev (build/test on macOS, ship for Windows), mature ecosystem, matches your JS/Vue background |
| Frontend | Vue 3 + Vite | Your existing expertise; fast dev loop |
| State | Pinia | Clean reactive store for LCU-pushed events |
| IPC | Electron `ipcMain`/`ipcRenderer` (contextBridge, no `nodeIntegration`) | Security best practice — main process owns all LCU/network access |
| LCU connection | Node `https`/`ws` in the main process | LCU uses a self-signed cert + Basic Auth token from a local lockfile |
| Local settings | `electron-store` | Auto-accept toggle, notification prefs, window state |
| Packaging | `electron-builder` | Produces a signed-or-unsigned Windows `.exe`, easy GitHub Releases workflow |

**Note on development:** Because League ships an official macOS client, you can run League itself on your Mac during development and connect to a real local LCU instance — no mocking required. Final packaging targets Windows only (`electron-builder --win`).

## 4. Architecture

```
┌─────────────────────────────────────────────┐
│                Electron Main                 │
│                                                │
│  ┌──────────────┐   ┌───────────────────┐    │
│  │ LockfileWatch │──▶│  LCU Auth Manager  │    │
│  │ (chokidar)    │   │ (port + token)     │    │
│  └──────────────┘   └────────┬──────────┘    │
│                               ▼                │
│                     ┌───────────────────┐      │
│                     │   LCU Client       │      │
│                     │ (REST + WSS)       │      │
│                     └────────┬──────────┘      │
│                               │ events/data      │
│                               ▼                │
│                     ┌───────────────────┐      │
│                     │  IPC Bridge        │      │
│                     │ (contextBridge)    │      │
│                     └────────┬──────────┘      │
└──────────────────────────────┼─────────────────┘
                                ▼
┌─────────────────────────────────────────────┐
│              Renderer (Vue app)               │
│                                                │
│   Pinia stores ◀── IPC events                 │
│     - matchmaking store                        │
│     - lobby/party store                        │
│     - chat store (lobby + friends + DMs)       │
│                                                │
│   Views:                                       │
│     - StatusBar (connection state)             │
│     - MatchAcceptCard                          │
│     - PartyPanel (invites, lobby members)      │
│     - ChatPanel (tabs: lobby / friend DMs)      │
│     - SettingsPanel (auto-accept toggle, etc.)  │
└─────────────────────────────────────────────┘
```

### Key components

**LockfileWatch**
League writes a `lockfile` in the install directory (`<LeagueInstall>/lockfile`) containing `pid:port:password:protocol` while the client is running. Watch for its creation/deletion to know when to connect/disconnect.

**LCU Auth Manager**
Builds a Basic Auth header (`riot:<password>`) and the base URL `https://127.0.0.1:<port>`. LCU uses a self-signed cert — main process must disable strict TLS verification for this specific connection only (not globally).

**LCU Client**
Thin wrapper exposing:
- REST calls (`GET/POST/PATCH` to endpoints like `/lol-matchmaking/v1/ready-check`, `/lol-lobby/v2/lobby/invitations`, `/lol-chat/v1/conversations`)
- A persistent WSS connection to `wss://127.0.0.1:<port>/` for event subscriptions (`OnJsonApiEvent_lol-matchmaking_v1_ready-check`, chat message events, etc.)

**IPC Bridge**
Renderer never talks to LCU directly. All calls go: Renderer → IPC → Main → LCU, and events flow back the same way. This keeps `nodeIntegration` off and the attack surface small.

## 5. Feature Breakdown

### 5.1 Match Accept
- Subscribe to `/lol-matchmaking/v1/ready-check` WSS event
- On `InProgress` state: show accept card with countdown timer
- Settings toggle: **Manual** (button + sound/flash alert) vs **Auto** (POST accept immediately)
- ⚠️ Flag in-app: auto-accept automates a client action; Riot hasn't banned tools for this (Blitz/others ship it), but it's not officially endorsed — worth a visible note in Settings, not just buried in this doc.

### 5.2 Party / Invites
- Read current lobby state (`/lol-lobby/v2/lobby`)
- Send invites via summoner name/tag (`POST /lol-lobby/v2/lobby/invitations`)
- Listen for incoming invitations (`/lol-lobby/v2/received-invitations`) and accept/decline from the UI
- Show party member list, roles/positions if in champ select

### 5.3 Chat
- Lobby/champ-select chat: `/lol-chat/v1/conversations` for the active lobby conversation, POST messages, subscribe to new-message events
- Friends list: `/lol-chat/v1/friends` for roster + online status
- Direct messages: per-friend conversation via chat conversation endpoints
- **Research spike required**: Riot has migrated parts of chat/friends between an XMPP-based system and a newer in-house chat service across patches. Exact endpoint shape should be verified against your current client version before implementation (see Section 7).

## 6. Project Structure (suggested)

```
league-companion/
├── electron/
│   ├── main.ts
│   ├── lcu/
│   │   ├── lockfileWatcher.ts
│   │   ├── authManager.ts
│   │   ├── lcuClient.ts        # REST + WSS wrapper
│   │   └── endpoints.ts        # typed endpoint constants
│   ├── ipc/
│   │   └── handlers.ts
│   └── preload.ts              # contextBridge exposure
├── src/                          # Vue renderer
│   ├── stores/
│   │   ├── connection.ts
│   │   ├── matchmaking.ts
│   │   ├── lobby.ts
│   │   └── chat.ts
│   ├── views/
│   │   ├── StatusBar.vue
│   │   ├── MatchAcceptCard.vue
│   │   ├── PartyPanel.vue
│   │   ├── ChatPanel.vue
│   │   └── SettingsPanel.vue
│   ├── App.vue
│   └── main.ts
├── electron-builder.yml
├── package.json
└── vite.config.ts
```

## 7. Suggested Build Order (Milestones)

1. **LCU connectivity spike**: lockfile detection → auth → single REST call (e.g. fetch current summoner) → confirm WSS event subscription works end to end. Prove the pipe before building UI.
2. **Matchmaking**: ready-check event handling, accept card UI, manual accept working.
3. **Auto-accept toggle** + settings persistence.
4. **Lobby/party**: read lobby state, display members, send/receive invites.
5. **Chat — lobby**: send/receive messages in the active lobby conversation.
6. **Chat — friends & DMs**: friends list, per-friend conversation, unread indicators.
7. **Packaging**: electron-builder Windows target, test install on a clean machine, first GitHub Release for friends.

## 8. Open Risks / Things to Verify Early

- **Chat/friends endpoint drift**: verify current LCU chat endpoint shapes against your installed client version before building Section 5.3 — check community-maintained docs (e.g. Hextech Docs) for the current patch rather than relying on older references.
- **TLS handling**: the self-signed LCU cert means disabling verification for that one connection — scope this narrowly in code so it doesn't weaken TLS elsewhere in the app.
- **Riot ToS**: this class of tool (Blitz, Porofessor, etc.) is broadly tolerated because it only automates client-side UI actions, not gameplay. Auto-accept sits at the more automated end of that spectrum — low observed risk historically, but not a guarantee.
- **Multiple friends running it simultaneously**: since each instance only talks to its own local LCU, no shared backend is needed for v1 — confirm this assumption holds once party/invite testing starts with more than one real account.

## 9. Explicitly Deferred (possible v2 ideas)

- Riot Web API integration for match history / ranked stats
- Champ-select overlay (recommended runes/summoners, ban suggestions)
- Auto-updater for easier distribution to the friend group
- macOS packaging (if any friends are on Mac)
