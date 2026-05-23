import type { MatrixSession as MatrixSessionContract, MuonSession } from '@muon/enterprise-contracts'
import type { DesktopEffect } from '@/shared/lib/effect'
import type { EncryptedStore, SafeStorageLike } from '@/shared/safeStorageStore'
import { muonSessionSchema, oauthTokenResponseSchema } from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { z } from 'zod'
import { getDesktopBridge, isElectronRuntime } from '@/desktop/bridge'
import { openUrl as defaultOpenUrl } from '@/desktop/opener'
import { readMatrixSessionFromStore } from '@/matrix/auth'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { makeEncryptedStore } from '@/shared/safeStorageStore'

const pkceTransientSchema = z.object({
  codeVerifier: z.string().min(1),
  state: z.string().min(1),
})

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
  constructor(
    public readonly kind:
      | 'invalid-callback'
      | 'state-mismatch'
      | 'no-pkce-state'
      | 'exchange-failed'
      | 'refresh-revoked'
      | 'refresh-network',
    message: string,
  ) {
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

function sha256Base64UrlEffect(value: string): DesktopEffect<string> {
  return Effect.gen(function* () {
    const data = new TextEncoder().encode(value)
    const digest = yield* fromPromise(() => crypto.subtle.digest('SHA-256', data))
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  })
}

const DEFAULT_DEVICE_NAME = 'Muon Desktop'

export function startEffect(deps: EnterpriseSessionDeps): DesktopEffect<void> {
  return Effect.gen(function* () {
    const codeVerifier = randomUrlToken()
    const state = randomUrlToken(16)
    const codeChallenge = yield* sha256Base64UrlEffect(codeVerifier)

    yield* fromPromise(() => deps.pkceStore.write({ codeVerifier, state }))

    const authorizeUrl = new URL('/api/oauth/authorize', deps.apiBaseUrl)
    authorizeUrl.searchParams.set('client_id', deps.clientId)
    authorizeUrl.searchParams.set('redirect_uri', deps.redirectUri)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('code_challenge', codeChallenge)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')
    authorizeUrl.searchParams.set('state', state)

    yield* fromPromise(() => deps.openUrl(authorizeUrl.toString()))
  })
}

export function start(deps: EnterpriseSessionDeps): Promise<void> {
  return runDesktopEffect(startEffect(deps))
}

function failEnterpriseSession<A>(kind: EnterpriseSessionError['kind'], message: string): DesktopEffect<A> {
  return fromSync(() => {
    throw new EnterpriseSessionError(kind, message)
  })
}

export function completeEffect(callbackUrl: string, deps: EnterpriseSessionDeps): DesktopEffect<EnterpriseSession> {
  return Effect.gen(function* () {
    const callback = yield* parseEnterpriseAuthCallbackEffect(callbackUrl)
    if (!callback)
      return yield* failEnterpriseSession<EnterpriseSession>('invalid-callback', 'Invalid enterprise auth callback')

    const pkce = yield* fromPromise(() => deps.pkceStore.read())
    if (!pkce)
      return yield* failEnterpriseSession<EnterpriseSession>(
        'no-pkce-state',
        'Enterprise login was not started on this device (no PKCE state)',
      )

    if (pkce.state !== callback.state)
      return yield* failEnterpriseSession<EnterpriseSession>(
        'state-mismatch',
        'Enterprise login state does not match this device',
      )

    const response: Response = yield* fromPromise(() =>
      deps.http(`${deps.apiBaseUrl}/api/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: callback.code,
          codeVerifier: pkce.codeVerifier,
          redirectUri: deps.redirectUri,
          clientId: deps.clientId,
          deviceName: DEFAULT_DEVICE_NAME,
        }),
      }),
    )

    const payload = yield* fromPromise(() => response.json())
    if (!response.ok)
      return yield* failEnterpriseSession<EnterpriseSession>(
        'exchange-failed',
        payload?.error ?? 'Enterprise login failed',
      )

    const tokenResponse = oauthTokenResponseSchema.parse(payload)
    const muon = tokenResponse.muonSession
    const matrix = tokenResponse.matrixSession

    yield* fromPromise(() => deps.muonStore.write(muon))
    yield* fromSync(() => deps.pkceStore.clear())

    // Note: the returned MatrixSession is NOT persisted here. The lifecycle orchestrator
    // owns MatrixSession activation, persistence, and client creation.
    return { muon, matrix }
  })
}

export function complete(callbackUrl: string, deps: EnterpriseSessionDeps): Promise<EnterpriseSession> {
  return runDesktopEffect(completeEffect(callbackUrl, deps))
}

export function refreshEffect(deps: EnterpriseSessionDeps): DesktopEffect<EnterpriseSession | null> {
  return Effect.gen(function* () {
    const stored = yield* fromPromise(() => deps.muonStore.read())
    if (!stored) return null

    const response: Response = yield* fromPromise(() =>
      deps.http(`${deps.apiBaseUrl}/api/oauth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          refreshToken: stored.refreshToken,
          clientId: deps.clientId,
          deviceName: stored.deviceName,
        }),
      }),
    ).pipe(
      Effect.catchAll(
        (err): DesktopEffect<Response> =>
          failEnterpriseSession<Response>('refresh-network', err instanceof Error ? err.message : 'Network error'),
      ),
    )

    if (!response.ok) {
      yield* fromSync(() => deps.muonStore.clear())
      return yield* failEnterpriseSession<EnterpriseSession | null>(
        'refresh-revoked',
        `Refresh failed with status ${response.status}`,
      )
    }

    const payload = yield* fromPromise(() => response.json())
    const tokenResponse = oauthTokenResponseSchema.parse(payload)
    yield* fromPromise(() => deps.muonStore.write(tokenResponse.muonSession))

    // Matrix session comes from the server's refresh response, not from any desktop store
    // (EnterpriseSession does not own Matrix storage).
    return { muon: tokenResponse.muonSession, matrix: tokenResponse.matrixSession }
  })
}

export function refresh(deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  return runDesktopEffect(refreshEffect(deps))
}

type RestoreRefreshResult = { tag: 'fallthrough' } | { tag: 'return'; session: EnterpriseSession | null }

export function restoreEffect(deps: EnterpriseSessionDeps): DesktopEffect<EnterpriseSession | null> {
  return Effect.gen(function* () {
    const muon = yield* fromPromise(() => deps.muonStore.read())
    if (!muon) return null

    const msUntilExpiry = Date.parse(muon.expiresAt) - deps.clock()
    const needsRefresh = msUntilExpiry < deps.refreshThresholdMs

    if (needsRefresh) {
      const refreshResult: RestoreRefreshResult = yield* refreshEffect(deps).pipe(
        Effect.map((session): RestoreRefreshResult => ({ tag: 'return', session })),
        Effect.catchAll((err): DesktopEffect<RestoreRefreshResult> => {
          if (err instanceof EnterpriseSessionError && err.kind === 'refresh-network') {
            // Network error — fall through to use the existing stored MuonSession.
            const result: RestoreRefreshResult = { tag: 'fallthrough' }
            return fromSync(() => result)
          }
          const result: RestoreRefreshResult = { tag: 'return', session: null }
          return fromSync(() => result)
        }),
      )
      if (refreshResult.tag === 'return') return refreshResult.session
    }

    const matrix = yield* fromPromise(() => deps.readMatrixSession())
    if (!matrix) return null

    return { muon, matrix }
  })
}

export function restore(deps: EnterpriseSessionDeps): Promise<EnterpriseSession | null> {
  return runDesktopEffect(restoreEffect(deps))
}

export function clearEffect(deps: EnterpriseSessionDeps): DesktopEffect<void> {
  return fromSync(() => {
    deps.muonStore.clear()
    deps.pkceStore.clear()
    // Matrix storage is owned by the MatrixSession module and cleared by lifecycle deactivation.
  })
}

export function clear(deps: EnterpriseSessionDeps): void {
  runDesktopSync(clearEffect(deps))
}

export function parseEnterpriseAuthCallbackEffect(url: string): DesktopEffect<{ code: string; state: string } | null> {
  return fromSync(() => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'muon:' || parsed.hostname !== 'auth' || parsed.pathname !== '/callback') return null
    const code = parsed.searchParams.get('code')
    const state = parsed.searchParams.get('state')
    if (!code || !state) return null
    return { code, state }
  }).pipe(Effect.catchAll(() => Effect.succeed(null)))
}

export function parseEnterpriseAuthCallback(url: string): { code: string; state: string } | null {
  return runDesktopSync(parseEnterpriseAuthCallbackEffect(url))
}

const REFRESH_NEAR_EXPIRY_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY_MUON = 'muon_enterprise_session'
const STORAGE_KEY_PKCE = 'muon_enterprise_pkce'

function bridgeSafeStorage(): SafeStorageLike {
  if (!isElectronRuntime()) {
    return {
      isAvailable: () => Promise.resolve(false),
      encrypt: (s) => Promise.resolve(s),
      decrypt: (s) => Promise.resolve(s),
    }
  }
  return {
    isAvailable: () => getDesktopBridge()!.safeStorage.isAvailable(),
    encrypt: (s) => getDesktopBridge()!.safeStorage.encrypt(s),
    decrypt: (s) => getDesktopBridge()!.safeStorage.decrypt(s),
  }
}

export function defaultEnterpriseSessionDeps(
  apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL,
): EnterpriseSessionDeps {
  return runDesktopSync(defaultEnterpriseSessionDepsEffect(apiBaseUrl))
}

export function defaultEnterpriseSessionDepsEffect(
  apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL,
): DesktopEffect<EnterpriseSessionDeps> {
  return fromSync(() => {
    const safeStorage = bridgeSafeStorage()
    return {
      apiBaseUrl: String(apiBaseUrl || '').replace(/\/+$/g, ''),
      http: globalThis.fetch.bind(globalThis),
      clock: () => Date.now(),
      openUrl: defaultOpenUrl,
      muonStore: makeEncryptedStore({ key: STORAGE_KEY_MUON, schema: muonSessionSchema, safeStorage }),
      pkceStore: makeEncryptedStore({ key: STORAGE_KEY_PKCE, schema: pkceTransientSchema, safeStorage }),
      readMatrixSession: readMatrixSessionFromStore,
      refreshThresholdMs: REFRESH_NEAR_EXPIRY_MS,
      clientId: 'muon-desktop',
      redirectUri: 'muon://auth/callback',
    }
  })
}

export function isEnterpriseAuthConfiguredEffect(
  apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL,
): DesktopEffect<boolean> {
  return fromSync(() => String(apiBaseUrl || '').replace(/\/+$/g, '').length > 0)
}

export function isEnterpriseAuthConfigured(apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL): boolean {
  return runDesktopSync(isEnterpriseAuthConfiguredEffect(apiBaseUrl))
}
