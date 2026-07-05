import { describe, it, expect } from 'vitest'
import { parseLockfile } from './authManager'

describe('parseLockfile', () => {
  const validLockfile = 'LeagueClient:12345:54321:abc123xyz:https'

  it('parses all fields correctly', () => {
    const creds = parseLockfile(validLockfile)
    expect(creds.pid).toBe(12345)
    expect(creds.port).toBe(54321)
    expect(creds.password).toBe('abc123xyz')
    expect(creds.protocol).toBe('https')
  })

  it('builds correct baseUrl and wsUrl', () => {
    const creds = parseLockfile(validLockfile)
    expect(creds.baseUrl).toBe('https://127.0.0.1:54321')
    expect(creds.wsUrl).toBe('wss://127.0.0.1:54321')
  })

  it('builds correct Basic Auth header value', () => {
    const creds = parseLockfile(validLockfile)
    const decoded = Buffer.from(creds.basicAuth, 'base64').toString('utf8')
    expect(decoded).toBe('riot:abc123xyz')
  })

  it('throws on wrong number of fields', () => {
    expect(() => parseLockfile('LeagueClient:12345:54321')).toThrow(/expected 5/)
  })

  it('throws on non-numeric pid or port', () => {
    expect(() => parseLockfile('LeagueClient:abc:54321:pass:https')).toThrow(/not numbers/)
  })

  it('trims trailing whitespace/newlines', () => {
    expect(() => parseLockfile(validLockfile + '\n')).not.toThrow()
  })
})
