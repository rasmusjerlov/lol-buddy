import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LcuClient } from './lcuClient'
import type { LcuCredentials } from './authManager'

const MOCK_CREDS: LcuCredentials = {
  pid: 1,
  port: 54321,
  password: 'testpass',
  protocol: 'https',
  basicAuth: Buffer.from('riot:testpass').toString('base64'),
  baseUrl: 'https://127.0.0.1:54321',
  wsUrl: 'wss://127.0.0.1:54321'
}

describe('LcuClient REST', () => {
  let client: LcuClient
  const originalFetch = global.fetch

  beforeEach(() => {
    client = new LcuClient(MOCK_CREDS)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sends GET with correct auth header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ summonerLevel: 100 })
    })
    global.fetch = mockFetch as unknown as typeof fetch

    await client.get('/lol-summoner/v1/current-summoner')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://127.0.0.1:54321/lol-summoner/v1/current-summoner')
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: `Basic ${MOCK_CREDS.basicAuth}`
    })
  })

  it('sends POST with JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => ''
    })
    global.fetch = mockFetch as unknown as typeof fetch

    await client.post('/lol-lobby/v2/lobby/invitations', [{ toSummonerId: 42 }])

    const [, options] = mockFetch.mock.calls[0]
    expect((options as RequestInit).method).toBe('POST')
    expect((options as RequestInit).body).toBe(JSON.stringify([{ toSummonerId: 42 }]))
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not found'
    }) as unknown as typeof fetch

    await expect(client.get('/bad-path')).rejects.toThrow('404')
  })

  it('returns undefined for empty response body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => ''
    }) as unknown as typeof fetch

    const result = await client.get('/empty')
    expect(result).toBeUndefined()
  })
})

describe('LcuClient subscribe', () => {
  it('returns an unsubscribe function', () => {
    const client = new LcuClient(MOCK_CREDS)
    const unsub = client.subscribe('OnJsonApiEvent', vi.fn())
    expect(typeof unsub).toBe('function')
    client.disconnect()
  })
})
