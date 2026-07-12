# LoL Buddy

A lightweight desktop companion app for League of Legends. Connects to the official League Client (LCU) API running on your machine — no third-party servers, no memory reading.

## Features

- **Match accept** — shows a countdown card when a match is found; auto-accepts if enabled
- **OS notification + window flash** — alerts you even when the app is minimised
- **Queue** — start and cancel matchmaking search from the app
- **Party panel** — see lobby members, invite friends by name or from your online friends list
- **Chat** — lobby and friend DM conversations
- **Settings** — auto-accept toggle with a visible disclaimer

## Installation (Windows)

1. Go to [**Releases**](../../releases/latest)
2. Download `LoL Buddy Setup x.x.x.exe`
3. Run the installer — Windows may show a SmartScreen warning since the app is unsigned; click **More info → Run anyway**
4. Launch **LoL Buddy**, then start League of Legends

The app connects automatically once the League client is running.

## Development

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev          # start in development mode (hot-reload)
npm run typecheck    # TypeScript type check
npm test             # run test suite
npm run build:win    # build Windows installer → dist/
```

### Stack

| Layer | Technology |
|---|---|
| Shell | Electron 33 |
| UI | Vue 3 + Vite |
| State | Pinia |
| IPC | contextBridge (nodeIntegration off) |
| LCU transport | Node `https` / `ws` (main process only) |
| Settings | electron-store |
| Packaging | electron-builder (NSIS) |

### How it connects to League

League writes a `lockfile` to disk while running (`C:\Riot Games\League of Legends\lockfile` on Windows). LoL Buddy watches that file for creation/deletion, extracts the port and password, and opens an HTTPS + WebSocket connection to `127.0.0.1:<port>`. No data leaves your machine.

## CI / Releases

Every push to `main` runs on a `windows-latest` GitHub Actions runner:

1. Type-check → test → build Windows installer
2. Publishes a new [GitHub Release](../../releases) with the `.exe` attached

## Disclaimer

LoL Buddy uses the official LCU API that Riot exposes locally. Tools like Blitz and Porofessor use the same interface. Auto-accept is provided as a convenience feature and is not officially endorsed by Riot Games. Use at your own discretion.
