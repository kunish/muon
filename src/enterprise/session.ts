import type { MatrixSession as MatrixSessionContract, MuonSession } from '@muon/enterprise-contracts'
import type { z } from 'zod'
// eslint-disable-next-line unused-imports/no-unused-imports -- SafeStorageLike used by defaultEnterpriseSessionDeps in Task 10
import type { EncryptedStore, SafeStorageLike } from '@/shared/safeStorageStore'
import { muonSessionSchema, oauthTokenResponseSchema } from '@muon/enterprise-contracts'

export interface EnterpriseSession {
  muon: MuonSession
  matrix: MatrixSessionContract
}

export interface PkceTransientState {
  codeVerifier: string
  state: string
}

export interface EnterpriseSessionDeps {
  apiBaseUrl: string
  http: typeof fetch
  clock: () => number
  openUrl: (url: string) => Promise<void>
  muonStore: EncryptedStore<MuonSession>
  pkceStore: EncryptedStore<PkceTransientState>
  /** Read-only loader for the currently-stored MatrixSession, owned by the MatrixSession module. EnterpriseSession never writes Matrix storage. */
  readMatrixSession: () => Promise<MatrixSessionContract | null>
  refreshThresholdMs: number
  clientId: string
  redirectUri: string
}

export class EnterpriseSessionError extends Error {
  constructor(public readonly kind: 'invalid-callback' | 'state-mismatch' | 'no-pkce-state' | 'exchange-failed' | 'refresh-revoked' | 'refresh-network', message: string) {
    super(message)
    this.name = 'EnterpriseSessionError'
  }
}

function randomUrlToken(bytes = 32): string {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return btoa(String.fromCharCode(...values))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function sha256Base64Url(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

const DEFAULT_DEVICE_NAME = 'Muon Desktop'

// Implementations added in subsequent tasks
export async function start(deps: EnterpriseSessionDeps): Promise<void> {
  const codeVerifier = randomUrlToken()
  const state = randomUrlToken(16)
  const codeChallenge = await sha256Base64Url(codeVerifier)

  await deps.pkceStore.write({ codeVerifier, state })

  const authorizeUrl = new URL('/api/oauth/authorize', deps.apiBaseUrl)
  authorizeUrl.searchParams.set('client_id', deps.clientId)
  authorizeUrl.searchParams.set('redirect_uri', deps.redirectUri)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('code_challenge', codeChallenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')
  authorizeUrl.searchParams.set('state', state)

  await deps.openUrl(authorizeUrl.toString())
}

export async function complete(callbackUrl: string, deps: EnterpriseSessionDeps): Promise<EnterpriseSession> {
  const callback = parseEnterpriseAuthCallback(callbackUrl)
  if (!callback)
    throw new EnterpriseSessionError('invalid-callback', 'Invalid enterprise auth callback')

  const pkce = await deps.pkceStore.read()
  if (!pkce)
    throw new EnterpriseSessionError('no-pkce-state', 'Enterprise login was not started on this device (no PKCE state)')

  if (pkce.state !== callback.state)
    throw new EnterpriseSessionError('state-mismatch', 'Enterprise login state does not match this device')

  const response = await deps.http(`${deps.apiBaseUrl}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: callback.code,
      codeVerifier: pkce.codeVerifier,
      redirectUri: deps.redirectUri,
      clientId: deps.clientId,
      deviceName: DEFAULT_DEVICE_NAME,
    }),
  })

  const payload = await response.json()
  if (!response.ok)
    throw new EnterpriseSessionError('exchange-failed', payload?.error ?? 'Enterprise login failed')

  const tokenResponse = oauthTokenResponseSchema.parse(payload)
  const muon = tokenResponse.muonSession
  const matrix = tokenResponse.matrixSession

  await deps.muonStore.write(muon)
  deps.pkceStore.clear()

  // Note: the returned MatrixSession is NOT persisted here. The lifecycle orchestrator
  // is responsible for calling activateMatrixSession(matrix) which persists + creates the client.
  return { muon, matrix }
}

export async function refresh(deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  const stored = await deps.muonStore.read()
  if (!stored)
    return null

  let response: Response
  try {
    response = await deps.http(`${deps.apiBaseUrl}/api/oauth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refreshToken: stored.refreshToken,
        clientId: deps.clientId,
        deviceName: stored.deviceName,
      }),
    })
  }
  catch (err) {
    throw new EnterpriseSessionError('refresh-network', err instanceof Error ? err.message : 'Network error')
  }

  if (!response.ok) {
    deps.muonStore.clear()
    throw new EnterpriseSessionError('refresh-revoked', `Refresh failed with status ${response.status}`)
  }

  const tokenResponse = oauthTokenResponseSchema.parse(await response.json())
  await deps.muonStore.write(tokenResponse.muonSession)

  // Matrix session comes from the server's refresh response, not from any desktop store
  // (EnterpriseSession does not own Matrix storage).
  return { muon: tokenResponse.muonSession, matrix: tokenResponse.matrixSession }
}

export async function restore(deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  const muon = await deps.muonStore.read()
  if (!muon)
    return null

  const msUntilExpiry = Date.parse(muon.expiresAt) - deps.clock()
  const needsRefresh = msUntilExpiry < deps.refreshThresholdMs

  if (needsRefresh) {
    try {
      return await refresh(deps)
    }
    catch (err) {
      if (!(err instanceof EnterpriseSessionError && err.kind === 'refresh-network'))
        return null
      // Network error — fall through to use the existing stored MuonSession.
    }
  }

  const matrix = await deps.readMatrixSession()
  if (!matrix)
    return null

  return { muon, matrix }
}

export function clear(_deps: EnterpriseSessionDeps): void {
  throw new Error('not implemented')
}

export function parseEnterpriseAuthCallback(url: string): { code: string, state: string } | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'muon:' || parsed.hostname !== 'auth' || parsed.pathname !== '/callback')
      return null
    const code = parsed.searchParams.get('code')
    const state = parsed.searchParams.get('state')
    if (!code || !state)
      return null
    return { code, state }
  }
  catch {
    return null
  }
}

// Silence unused-import warnings on schemas while the module fills in
void muonSessionSchema
void ({} as z.ZodTypeAny)
