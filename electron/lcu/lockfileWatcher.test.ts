import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { LockfileWatcher } from './lockfileWatcher'

const VALID_LOCKFILE = 'LeagueClient:12345:54321:testpass:https'

describe('LockfileWatcher', () => {
  let watcher: LockfileWatcher
  let tmpPath: string

  beforeEach(() => {
    watcher = new LockfileWatcher()
    tmpPath = join(tmpdir(), `lockfile-test-${Date.now()}`)
  })

  afterEach(async () => {
    watcher.stop()
    await rm(tmpPath, { force: true })
  })

  it('emits connected event when lockfile appears', async () => {
    const events: Parameters<Parameters<LockfileWatcher['on']>[0]>[0][] = []
    watcher.on((e) => events.push(e))
    watcher.start(tmpPath)

    await writeFile(tmpPath, VALID_LOCKFILE, 'utf8')

    // Wait for chokidar to pick it up
    await new Promise((r) => setTimeout(r, 300))

    const connected = events.find((e) => e.type === 'connected')
    expect(connected).toBeDefined()
    if (connected?.type === 'connected') {
      expect(connected.credentials.port).toBe(54321)
      expect(connected.credentials.password).toBe('testpass')
    }
  })

  it('emits disconnected event when lockfile is removed', async () => {
    await writeFile(tmpPath, VALID_LOCKFILE, 'utf8')

    const events: Parameters<Parameters<LockfileWatcher['on']>[0]>[0][] = []
    watcher.on((e) => events.push(e))
    watcher.start(tmpPath)

    await new Promise((r) => setTimeout(r, 200))
    await rm(tmpPath)
    await new Promise((r) => setTimeout(r, 300))

    expect(events.some((e) => e.type === 'disconnected')).toBe(true)
  })

  it('unsubscribes listener when returned function is called', async () => {
    const listener = vi.fn()
    const unsub = watcher.on(listener)
    unsub()

    watcher.start(tmpPath)
    await writeFile(tmpPath, VALID_LOCKFILE, 'utf8')
    await new Promise((r) => setTimeout(r, 300))

    expect(listener).not.toHaveBeenCalled()
  })
})
