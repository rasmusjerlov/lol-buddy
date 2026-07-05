import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import https from 'https'
import { EventEmitter } from 'events'
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

function makeMockRequest(statusCode: number, body: string) {
  const res = Object.assign(new EventEmitter(), { statusCode })
  const req = Object.assign(new EventEmitter(), {
    write: vi.fn(),
    end: vi.fn().mockImplementation(() => {
      res.emit('data', Buffer.from(body))
      res.emit('end')
    })
  })
  return { req, res }
}

describe('LcuClient REST', () => {
  let client: LcuClient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let requestSpy: any

  beforeEach(() => {
    client = new LcuClient(MOCK_CREDS)
  })

  afterEach(() => {
    requestSpy?.mockRestore()
  })

  it('sends GET with correct auth header', async () => {
    const { req, res } = makeMockRequest(200, JSON.stringify({ summonerLevel: 100 }))
    requestSpy = vi.spyOn(https, 'request').mockImplementation((_opts: unknown, cb: unknown) => {
      (cb as (r: unknown) => void)?.(res)
      return req as never
    })

    await client.get('/lol-summoner/v1/current-summoner')

    expect(requestSpy).toHaveBeenCalledOnce()
    const opts = requestSpy.mock.calls[0][0] as Record<string, unknown>
    expect((opts.headers as Record<string, string>)['Authorization']).toBe(
      `Basic ${MOCK_CREDS.basicAuth}`
    )
    expect(opts.method).toBe('GET')
  })

  it('sends POST with JSON body', async () => {
    const { req, res } = makeMockRequest(200, '')
    requestSpy = vi.spyOn(https, 'request').mockImplementation((_opts: unknown, cb: unknown) => {
      (cb as (r: unknown) => void)?.(res)
      return req as never
    })

    await client.post('/lol-lobby/v2/lobby/invitations', [{ toSummonerId: 42 }])

    const opts = requestSpy.mock.calls[0][0] as Record<string, unknown>
    expect(opts.method).toBe('POST')
    expect(req.write).toHaveBeenCalledWith(JSON.stringify([{ toSummonerId: 42 }]))
  })

  it('throws on 4xx response', async () => {
    const { req, res } = makeMockRequest(404, 'Not found')
    requestSpy = vi.spyOn(https, 'request').mockImplementation((_opts: unknown, cb: unknown) => {
      (cb as (r: unknown) => void)?.(res)
      return req as never
    })

    await expect(client.get('/bad-path')).rejects.toThrow('404')
  })

  it('returns undefined for empty response body', async () => {
    const { req, res } = makeMockRequest(200, '')
    requestSpy = vi.spyOn(https, 'request').mockImplementation((_opts: unknown, cb: unknown) => {
      (cb as (r: unknown) => void)?.(res)
      return req as never
    })

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
