import { app, BrowserWindow, shell, Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { LockfileWatcher } from './lcu/lockfileWatcher'
import { LcuClient } from './lcu/lcuClient'
import { LCU_EVENTS } from './lcu/endpoints'
import { registerIpcHandlers, setActiveClient, broadcastToRenderer } from './ipc/handlers'
import { IPC } from './ipc/channels'
import { getSetting } from './settings'
import { findLeagueLockfilePath } from './lcu/lockfileDiscovery'

let lcuClient: LcuClient | null = null
const lockfileWatcher = new LockfileWatcher()
let discoveryTimer: NodeJS.Timeout | null = null
let readyCheckHandled = false

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 380,
    height: 720,
    minWidth: 320,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

async function handleReadyCheck(): Promise<void> {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    win.flashFrame(true)
  })

  if (Notification.isSupported()) {
    new Notification({
      title: 'Match Found!',
      body: 'A match is ready — click to open LoL Buddy.'
    }).show()
  }

  if (getSetting('autoAccept') && lcuClient) {
    try {
      await lcuClient.post('/lol-matchmaking/v1/ready-check/accept')
    } catch {
      // Already accepted, timed out, or not in ready-check — ignore
    }
  }
}

async function startDiscovery(): Promise<void> {
  if (discoveryTimer) {
    clearTimeout(discoveryTimer)
    discoveryTimer = null
  }

  const customDir = getSetting('leaguePath') || undefined
  const lockfilePath = await findLeagueLockfilePath(customDir)
  if (lockfilePath) {
    lockfileWatcher.start(lockfilePath)
  } else {
    // League not running or not installed at a known path — retry shortly
    discoveryTimer = setTimeout(startDiscovery, 3000)
  }
}

function startLcuWatcher(): void {
  lockfileWatcher.on(async (event) => {
    if (event.type === 'connected') {
      lcuClient?.disconnect()
      lcuClient = new LcuClient(event.credentials)
      setActiveClient(lcuClient, event.credentials)
      lcuClient.connectWebSocket()

      Object.values(LCU_EVENTS).forEach((eventName) => {
        lcuClient!.subscribe(eventName, async (data) => {
          broadcastToRenderer(IPC.LCU_EVENT, { eventName, data })

          if (eventName === LCU_EVENTS.READY_CHECK) {
            const ev = data as { data?: { state?: string } }
            if (ev?.data?.state === 'InProgress') {
              if (!readyCheckHandled) {
                readyCheckHandled = true
                handleReadyCheck()
              }
            } else {
              readyCheckHandled = false
            }
          }
        })
      })

      broadcastToRenderer(IPC.LCU_CONNECTED, { port: event.credentials.port })
    } else {
      lcuClient?.disconnect()
      lcuClient = null
      setActiveClient(null, null)
      broadcastToRenderer(IPC.LCU_DISCONNECTED)
      // League closed — stop watcher and poll until League starts again
      lockfileWatcher.stop()
      startDiscovery()
    }
  })

  startDiscovery()
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lolbuddy.companion')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()
  startLcuWatcher()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (discoveryTimer) clearTimeout(discoveryTimer)
    lcuClient?.disconnect()
    lockfileWatcher.stop()
    app.quit()
  }
})
