import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFile, rm, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { LockfileWatcher } from './lockfileWatcher'

const VALID_LOCKFILE = 'LeagueClient:12345:54321:testpass:https'

/** Poll until predicate is true or the timeout (ms) is exceeded. */
async function waitFor(pred: () => boolean, timeout = 2000): Promise<void> {
  const deadline = Date.now() + timeout
  while (!pred()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe('LockfileWatcher', () => {
  let watcher: LockfileWatcher
  let tmpDir: string
  let tmpPath: string

  beforeEach(async () => {
    watcher = new LockfileWatcher()
    // Each test gets its own subdirectory so directory events are unambiguous
    tmpDir = join(tmpdir(), `lockfile-test-${Date.now()}`)
    await mkdir(tmpDir, { recursive: true })
    tmpPath = join(tmpDir, 'lockfile')
  })

  afterEach(async () => {
    watcher.stop()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('emits connected event when lockfile appears', async () => {
    const events: Parameters<Parameters<LockfileWatcher['on']>[0]>[0][] = []
    watcher.on((e) => events.push(e))
    watcher.start(tmpPath)

    await writeFile(tmpPath, VALID_LOCKFILE, 'utf8')
    await waitFor(() => events.some((e) => e.type === 'connected'))

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

    await waitFor(() => events.some((e) => e.type === 'connected'))
    await rm(tmpPath)
    await waitFor(() => events.some((e) => e.type === 'disconnected'))

    expect(events.some((e) => e.type === 'disconnected')).toBe(true)
  })

  it('unsubscribes listener when returned function is called', async () => {
    const listener = vi.fn()
    const unsub = watcher.on(listener)
    unsub()

    watcher.start(tmpPath)
    await writeFile(tmpPath, VALID_LOCKFILE, 'utf8')
    await new Promise((r) => setTimeout(r, 500))

    expect(listener).not.toHaveBeenCalled()
  })
})
