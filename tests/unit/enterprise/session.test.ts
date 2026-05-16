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
