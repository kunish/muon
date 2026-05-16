/* eslint-disable unused-imports/no-unused-imports -- complete/refresh/restore/EnterpriseSessionError/MatrixSession/matrixSessionSchema used by Tasks 7-10 */
import type { MatrixSession, MuonSession } from '@muon/enterprise-contracts'
import type { EnterpriseSessionDeps, PkceTransientState } from '@/enterprise/session'
import type { SafeStorageLike } from '@/shared/safeStorageStore'
import { matrixSessionSchema, muonSessionSchema } from '@muon/enterprise-contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { complete, EnterpriseSessionError, refresh, restore, start } from '@/enterprise/session'
import { makeEncryptedStore } from '@/shared/safeStorageStore'

const pkceTransientSchema = z.object({
  codeVerifier: z.string(),
  state: z.string(),
})

function plaintextSafeStorage(): SafeStorageLike {
  return {
    isAvailable: vi.fn().mockResolvedValue(false),
    encrypt: vi.fn(async s => s),
    decrypt: vi.fn(async s => s),
  }
}

function makeDeps(overrides: Partial<EnterpriseSessionDeps> = {}): EnterpriseSessionDeps {
  const safeStorage = plaintextSafeStorage()
  return {
    apiBaseUrl: 'https://api.example.com',
    http: vi.fn() as unknown as typeof fetch,
    clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    openUrl: vi.fn().mockResolvedValue(undefined),
    muonStore: makeEncryptedStore<MuonSession>({ key: 'test_muon', schema: muonSessionSchema, safeStorage }),
    pkceStore: makeEncryptedStore<PkceTransientState>({ key: 'test_pkce', schema: pkceTransientSchema, safeStorage }),
    readMatrixSession: vi.fn().mockResolvedValue(null),
    refreshThresholdMs: 24 * 60 * 60 * 1000,
    clientId: 'muon-desktop',
    redirectUri: 'muon://auth/callback',
    ...overrides,
  }
}

describe('enterpriseSession.start', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists PKCE state and opens authorize URL with required params', async () => {
    const openUrl = vi.fn().mockResolvedValue(undefined)
    const deps = makeDeps({ openUrl })

    await start(deps)

    expect(openUrl).toHaveBeenCalledTimes(1)
    const openedUrl = new URL(openUrl.mock.calls[0]![0]! as string)
    expect(openedUrl.origin + openedUrl.pathname).toBe('https://api.example.com/api/oauth/authorize')
    expect(openedUrl.searchParams.get('client_id')).toBe('muon-desktop')
    expect(openedUrl.searchParams.get('redirect_uri')).toBe('muon://auth/callback')
    expect(openedUrl.searchParams.get('response_type')).toBe('code')
    expect(openedUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(openedUrl.searchParams.get('code_challenge')).toMatch(/^[\w-]+$/)
    expect(openedUrl.searchParams.get('state')).toBeTruthy()

    const pkce = await deps.pkceStore.read()
    expect(pkce).not.toBeNull()
    expect(pkce!.state).toBe(openedUrl.searchParams.get('state'))
  })
})

describe('enterpriseSession.complete', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('rejects an invalid callback URL', async () => {
    const deps = makeDeps()
    await expect(complete('not-a-url', deps)).rejects.toBeInstanceOf(EnterpriseSessionError)
  })

  it('rejects when no PKCE state was started', async () => {
    const deps = makeDeps()
    await expect(complete('muon://auth/callback?code=c&state=s', deps)).rejects.toThrow(/PKCE/i)
  })

  it('rejects when callback state does not match stored state', async () => {
    const deps = makeDeps()
    await deps.pkceStore.write({ codeVerifier: 'v', state: 'expected' })
    await expect(complete('muon://auth/callback?code=c&state=wrong', deps)).rejects.toThrow(/state/i)
  })

  it('exchanges the code and persists both sessions, clearing PKCE state', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        muonSession: {
          accessToken: 'mat',
          refreshToken: 'mrt',
          expiresAt: '2030-01-01T00:00:00.000Z',
          deviceName: 'Muon Desktop',
        },
        matrixSession: {
          serverUrl: 'https://matrix.example.com',
          userId: '@u:example.com',
          accessToken: 'xat',
          deviceId: 'DEV',
        },
      }),
    }) as unknown as typeof fetch

    const deps = makeDeps({ http })
    await deps.pkceStore.write({ codeVerifier: 'verifier', state: 'st' })

    const session = await complete('muon://auth/callback?code=abc&state=st', deps)

    expect(session.muon.accessToken).toBe('mat')
    expect(session.muon.deviceName).toBe('Muon Desktop')
    expect(session.matrix.userId).toBe('@u:example.com')

    // EnterpriseSession persists ONLY the MuonSession; the returned MatrixSession is the lifecycle orchestrator's job to activate.
    expect(await deps.muonStore.read()).toEqual(session.muon)
    expect(await deps.pkceStore.read()).toBeNull()

    const [calledUrl, calledInit] = (http as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(String(calledUrl)).toBe('https://api.example.com/api/oauth/token')
    const body = JSON.parse((calledInit as RequestInit).body as string)
    expect(body.code).toBe('abc')
    expect(body.codeVerifier).toBe('verifier')
    expect(body.clientId).toBe('muon-desktop')
    expect(body.redirectUri).toBe('muon://auth/callback')
    expect(body.deviceName).toBe('Muon Desktop')
  })

  it('throws on non-ok response and does not persist anything', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'bad_request' }),
    }) as unknown as typeof fetch
    const deps = makeDeps({ http })
    await deps.pkceStore.write({ codeVerifier: 'v', state: 's' })

    await expect(complete('muon://auth/callback?code=c&state=s', deps)).rejects.toThrow()
    expect(await deps.muonStore.read()).toBeNull()
  })
})

const validMatrix: MatrixSession = {
  serverUrl: 'https://matrix.example.com',
  userId: '@u:example.com',
  accessToken: 'xat',
  deviceId: 'DEV',
}

const validMuon: MuonSession = {
  accessToken: 'old-at',
  refreshToken: 'old-rt',
  expiresAt: '2030-01-01T00:00:00.000Z',
  deviceName: 'My Laptop',
}

describe('enterpriseSession.refresh', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no MuonSession is stored', async () => {
    const deps = makeDeps()
    const result = await refresh(deps)
    expect(result).toBeNull()
  })

  it('rotates tokens, persists the new MuonSession, and uses the stored deviceName in the request', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        muonSession: {
          accessToken: 'new-at',
          refreshToken: 'new-rt',
          expiresAt: '2031-01-01T00:00:00.000Z',
          deviceName: 'My Laptop',
        },
        matrixSession: validMatrix,
      }),
    }) as unknown as typeof fetch

    const deps = makeDeps({ http })
    await deps.muonStore.write(validMuon)

    const result = await refresh(deps)
    expect(result?.muon.accessToken).toBe('new-at')
    expect(result?.muon.deviceName).toBe('My Laptop')
    expect(result?.matrix).toEqual(validMatrix)

    const stored = await deps.muonStore.read()
    expect(stored?.accessToken).toBe('new-at')

    const [, init] = (http as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.refreshToken).toBe('old-rt')
    expect(body.deviceName).toBe('My Laptop')
  })

  it('clears the stored MuonSession on 401 (server-side revoke), does not touch Matrix storage', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_refresh_token' }),
    }) as unknown as typeof fetch

    const readMatrixSession = vi.fn().mockResolvedValue(validMatrix)
    const deps = makeDeps({ http, readMatrixSession })
    await deps.muonStore.write(validMuon)

    await expect(refresh(deps)).rejects.toBeInstanceOf(EnterpriseSessionError)

    expect(await deps.muonStore.read()).toBeNull()
    // readMatrixSession was not invoked from refresh — refresh does not own Matrix lifecycle
    expect(readMatrixSession).not.toHaveBeenCalled()
  })

  it('keeps stored MuonSession on network error', async () => {
    const http = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch
    const deps = makeDeps({ http })
    await deps.muonStore.write(validMuon)

    await expect(refresh(deps)).rejects.toBeInstanceOf(EnterpriseSessionError)
    expect(await deps.muonStore.read()).toEqual(validMuon)
  })
})

describe('enterpriseSession.restore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when no MuonSession is stored', async () => {
    const deps = makeDeps()
    expect(await restore(deps)).toBeNull()
  })

  it('returns the stored bundle without refreshing when not near expiry', async () => {
    const http = vi.fn() as unknown as typeof fetch
    const readMatrixSession = vi.fn().mockResolvedValue(validMatrix)
    const deps = makeDeps({
      http,
      readMatrixSession,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })

    const farFuture: MuonSession = {
      ...validMuon,
      expiresAt: '2026-06-16T00:00:00.000Z',
    }
    await deps.muonStore.write(farFuture)

    const result = await restore(deps)
    expect(result).toEqual({ muon: farFuture, matrix: validMatrix })
    expect(http).not.toHaveBeenCalled()
    expect(readMatrixSession).toHaveBeenCalled()
  })

  it('returns null when no MatrixSession exists even if MuonSession is valid', async () => {
    const readMatrixSession = vi.fn().mockResolvedValue(null)
    const deps = makeDeps({
      readMatrixSession,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })
    const farFuture: MuonSession = { ...validMuon, expiresAt: '2026-06-16T00:00:00.000Z' }
    await deps.muonStore.write(farFuture)

    expect(await restore(deps)).toBeNull()
  })

  it('refreshes when within the threshold and returns the rotated bundle', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        muonSession: {
          accessToken: 'rotated',
          refreshToken: 'rotated-rt',
          expiresAt: '2031-01-01T00:00:00.000Z',
          deviceName: 'My Laptop',
        },
        matrixSession: validMatrix,
      }),
    }) as unknown as typeof fetch

    const deps = makeDeps({
      http,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })

    const nearExpiry: MuonSession = {
      ...validMuon,
      expiresAt: '2026-05-16T12:00:00.000Z',
    }
    await deps.muonStore.write(nearExpiry)

    const result = await restore(deps)
    expect(http).toHaveBeenCalledTimes(1)
    expect(result?.muon.accessToken).toBe('rotated')
    expect(result?.matrix).toEqual(validMatrix)
  })

  it('returns the still-valid stored bundle when near-expiry refresh fails with network error', async () => {
    const http = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch
    const readMatrixSession = vi.fn().mockResolvedValue(validMatrix)
    const deps = makeDeps({
      http,
      readMatrixSession,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })
    const nearExpiry: MuonSession = {
      ...validMuon,
      expiresAt: '2026-05-16T12:00:00.000Z',
    }
    await deps.muonStore.write(nearExpiry)

    const result = await restore(deps)
    expect(result?.muon.accessToken).toBe(nearExpiry.accessToken)
    expect(result?.matrix).toEqual(validMatrix)
  })

  it('returns null when refresh detects a revoked session (401)', async () => {
    const http = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_refresh_token' }),
    }) as unknown as typeof fetch
    const deps = makeDeps({
      http,
      clock: () => Date.parse('2026-05-16T00:00:00.000Z'),
    })
    const nearExpiry: MuonSession = {
      ...validMuon,
      expiresAt: '2026-05-16T12:00:00.000Z',
    }
    await deps.muonStore.write(nearExpiry)

    expect(await restore(deps)).toBeNull()
    expect(await deps.muonStore.read()).toBeNull()
  })
})
