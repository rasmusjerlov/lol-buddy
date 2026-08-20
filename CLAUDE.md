# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A desktop companion app for League of Legends ("LoL Buddy") that hooks into the official League Client Update (LCU) local API. Core features: match auto-accept, party invites, and chat. Distributed as a manually-installed Windows `.exe` for a small friend group. This is a client-augmentation tool — it only touches the local League Client's HTTP/WebSocket API, never game memory or process.

## Tech Stack

- **Shell**: Electron
- **Frontend**: Vue 3 + Vite
- **State**: Pinia
- **IPC**: Electron `ipcMain`/`ipcRenderer` via `contextBridge` (no `nodeIntegration`)
- **LCU connection**: Node `https`/`ws` in the main process only
- **Local settings**: `electron-store`
- **Packaging**: `electron-builder` (Windows target)

## Development Commands

Once the project is scaffolded:

```bash
npm run dev          # Start Electron app in development mode
npm run build        # Build for production
npm run build:win    # Build Windows installer via electron-builder
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
```

> **Note:** These commands don't exist yet — project is in planning phase. Update this file as the project is scaffolded.

## Architecture

```
electron/              # Main process (Node.js)
├── main.ts
├── lcu/
│   ├── lockfileWatcher.ts   # Watches League lockfile for connect/disconnect
│   ├── authManager.ts       # Builds Basic Auth header from lockfile credentials
│   ├── lcuClient.ts         # REST + WSS wrapper for LCU API
│   └── endpoints.ts         # Typed endpoint constants
├── ipc/
│   └── handlers.ts          # ipcMain handlers
└── preload.ts               # contextBridge API surface

src/                   # Renderer process (Vue 3)
├── stores/
│   ├── connection.ts
│   ├── matchmaking.ts
│   ├── lobby.ts
│   └── chat.ts
├── views/
│   ├── StatusBar.vue
│   ├── MatchAcceptCard.vue
│   ├── PartyPanel.vue
│   ├── ChatPanel.vue
│   └── SettingsPanel.vue
├── App.vue
└── main.ts
```

### Key Patterns

**LCU Connection flow:** League writes a `lockfile` containing `pid:port:password:protocol` while running. `lockfileWatcher.ts` (chokidar) detects creation/deletion. `authManager.ts` extracts credentials and builds `Basic riot:<password>` header + base URL `https://127.0.0.1:<port>`.
- macOS lockfile path: `/Applications/League of Legends.app/Contents/LoL/lockfile`
- Windows lockfile path: `C:\Riot Games\League of Legends\lockfile`

**TLS:** LCU uses a self-signed certificate. Disable strict TLS verification **only** for this specific connection — scope it narrowly in `lcuClient.ts`, not globally.

**IPC rule:** The renderer never calls LCU directly. All LCU access goes through: Renderer → `ipcRenderer.invoke` → `ipcMain` handler → `lcuClient` → LCU. Events flow back the same path. This is mandatory — `nodeIntegration` is off.

**LCU WebSocket:** Subscribe to events at `wss://127.0.0.1:<port>/`. Key subscriptions:
- `OnJsonApiEvent_lol-matchmaking_v1_ready-check` — match found events
- Lobby and chat events for party/invite/chat features

**Pinia stores** receive LCU events forwarded from main via IPC and expose reactive state to Vue views.

## Build Order (Milestones)

1. LCU connectivity spike — lockfile → auth → one REST call → WSS subscription
2. Match accept — ready-check event, accept card UI, manual accept
3. Auto-accept toggle + `electron-store` settings persistence
4. Lobby/party — read state, display members, send/receive invites
5. Chat (lobby) — active lobby conversation
6. Chat (friends & DMs) — friends list, per-friend conversations
7. Packaging — `electron-builder --win`, GitHub Release

## Important Notes

- **Development platform:** League ships a macOS client, so you can develop and test against a real LCU instance on macOS. Final builds target Windows only.
- **Chat endpoints:** LCU chat has drifted across patches (XMPP → in-house). Verify current endpoint shapes at [Hextech Docs](https://www.mingweisamuel.com/lcu-schema/tool/) or community LCU references before implementing chat features.
- **Auto-accept:** Blitz and similar tools ship this feature without Riot enforcement action, but it's not officially endorsed. The in-app settings panel should surface a visible disclaimer.
- **No shared backend needed:** Each friend's instance only talks to their own local LCU — no server coordination required for v1.

## Notes for Claude
Do not be afraid to ask questions. Always make sure the developer and you (Claude) are 100 % aligned on scope.
Implement with TDD (Test Driven Development - Testing framework is decided by Claude Code)
Use git as version control. Commit and push directly to main.
After completing any change, run `npm run typecheck && npm test` — if both pass, commit and push to main immediately without waiting for manual approval.
Do NOT manually bump `package.json` version — CI runs `npm version patch` automatically on every push to main and publishes a GitHub release. Manual bumps with `[skip ci]` block CI and prevent releases from being published.