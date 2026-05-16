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

export async function complete(_callbackUrl: string, _deps: EnterpriseSessionDeps): Promise<EnterpriseSession> {
  throw new Error('not implemented')
}

export async function refresh(_deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  throw new Error('not implemented')
}

export async function restore(_deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  throw new Error('not implemented')
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
void oauthTokenResponseSchema
void ({} as z.ZodTypeAny)
