import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { LockfileWatcher } from './lcu/lockfileWatcher'
import { LcuClient } from './lcu/lcuClient'
import { LCU_EVENTS } from './lcu/endpoints'
import { registerIpcHandlers, setActiveClient, broadcastToRenderer } from './ipc/handlers'
import { IPC } from './ipc/channels'

// macOS: inside the app bundle; Windows: default Riot install location
const LOCKFILE_PATH =
  process.platform === 'darwin'
    ? '/Applications/League of Legends.app/Contents/LoL/lockfile'
    : 'C:\\Riot Games\\League of Legends\\lockfile'

let lcuClient: LcuClient | null = null
const lockfileWatcher = new LockfileWatcher()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 380,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
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

function startLcuWatcher(): void {
  lockfileWatcher.on(async (event) => {
    if (event.type === 'connected') {
      lcuClient?.disconnect()
      lcuClient = new LcuClient(event.credentials)
      setActiveClient(lcuClient, event.credentials)
      lcuClient.connectWebSocket()

      // Forward all LCU events to the renderer
      Object.values(LCU_EVENTS).forEach((eventName) => {
        lcuClient!.subscribe(eventName, (data) => {
          broadcastToRenderer(IPC.LCU_EVENT, { eventName, data })
        })
      })

      broadcastToRenderer(IPC.LCU_CONNECTED, {
        port: event.credentials.port
      })
    } else {
      lcuClient?.disconnect()
      lcuClient = null
      setActiveClient(null, null)
      broadcastToRenderer(IPC.LCU_DISCONNECTED)
    }
  })

  lockfileWatcher.start(LOCKFILE_PATH)
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
    lcuClient?.disconnect()
    lockfileWatcher.stop()
    app.quit()
  }
})
