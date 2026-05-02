import type { LoginCredentials, RegisterParams } from './types'
import { oauthTokenResponseSchema } from '@muon/enterprise-contracts'
import { z } from 'zod'
import { openUrl } from '@/electron/opener'
import { createClient, destroyClient, getClient } from './client'
import { unbindClientEvents } from './events'
import { stopSync } from './sync'

const sessionSchema = z.object({
  serverUrl: z.string().url(),
  accessToken: z.string().min(1),
  userId: z.string().regex(/^@[^:]+:.+$/),
  deviceId: z.string().min(1),
})

const STORAGE_KEY = 'muon_auth'
const ENTERPRISE_SESSION_KEY = 'muon_enterprise_session'
const ENTERPRISE_PKCE_KEY = 'muon_enterprise_pkce'

interface StoredSession {
  serverUrl: string
  userId: string
  accessToken: string
  deviceId: string
}

function persistSession(session: StoredSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

const LEADING_AT_RE = /^@/

export async function login(serverUrl: string, credentials: LoginCredentials): Promise<StoredSession> {
  const client = createClient({ serverUrl })

  // Strip leading '@' and any ':server' suffix so both
  // "kunish", "@kunish" and "@kunish:example.com" work.
  const localpart = credentials.username.replace(LEADING_AT_RE, '').split(':')[0]

  const response = await client.login('m.login.password', {
    identifier: {
      type: 'm.id.user',
      user: localpart,
    },
    password: credentials.password,
  })

  const session: StoredSession = {
    serverUrl,
    userId: response.user_id,
    accessToken: response.access_token,
    deviceId: response.device_id,
  }

  persistSession(session)
  createClient(session)
  return session
}

export async function register(serverUrl: string, params: RegisterParams): Promise<StoredSession> {
  const client = createClient({ serverUrl })
  const localpart = params.username.replace(LEADING_AT_RE, '').split(':')[0]
  const response = await client.register(
    localpart,
    params.password,
    null,
    { type: 'm.login.dummy' },
  )

  const session: StoredSession = {
    serverUrl,
    userId: response.user_id,
    accessToken: response.access_token!,
    deviceId: response.device_id!,
  }

  persistSession(session)
  createClient(session)

  if (params.displayName) {
    await getClient().setDisplayName(params.displayName)
  }

  return session
}

export interface EnterpriseAuthCallback {
  code: string
  state: string
}

interface EnterprisePkceState {
  codeVerifier: string
  state: string
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

function enterpriseApiBaseUrl(apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL): string {
  return String(apiBaseUrl || '').replace(/\/+$/g, '')
}

export function isEnterpriseAuthConfigured(apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL): boolean {
  return enterpriseApiBaseUrl(apiBaseUrl).length > 0
}

export function parseEnterpriseAuthCallback(url: string): EnterpriseAuthCallback | null {
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

export async function startEnterpriseLogin(apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL): Promise<void> {
  const baseUrl = enterpriseApiBaseUrl(apiBaseUrl)
  if (!baseUrl)
    throw new Error('Enterprise auth is not configured')

  const codeVerifier = randomUrlToken()
  const state = randomUrlToken(16)
  const codeChallenge = await sha256Base64Url(codeVerifier)
  const pkceState: EnterprisePkceState = { codeVerifier, state }
  localStorage.setItem(ENTERPRISE_PKCE_KEY, JSON.stringify(pkceState))

  const authorizeUrl = new URL('/api/oauth/authorize', baseUrl)
  authorizeUrl.searchParams.set('client_id', 'muon-desktop')
  authorizeUrl.searchParams.set('redirect_uri', 'muon://auth/callback')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('code_challenge', codeChallenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')
  authorizeUrl.searchParams.set('state', state)
  await openUrl(authorizeUrl.toString())
}

export async function completeEnterpriseLogin(callbackUrl: string, apiBaseUrl = import.meta.env.VITE_MUON_API_BASE_URL): Promise<StoredSession> {
  const callback = parseEnterpriseAuthCallback(callbackUrl)
  if (!callback)
    throw new Error('Invalid enterprise auth callback')

  const rawState = localStorage.getItem(ENTERPRISE_PKCE_KEY)
  if (!rawState)
    throw new Error('Enterprise login was not started on this device')

  const pkceState = JSON.parse(rawState) as EnterprisePkceState
  if (pkceState.state !== callback.state)
    throw new Error('Enterprise login state does not match this device')

  const baseUrl = enterpriseApiBaseUrl(apiBaseUrl)
  const response = await fetch(`${baseUrl}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code: callback.code,
      codeVerifier: pkceState.codeVerifier,
      redirectUri: 'muon://auth/callback',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    }),
  })
  const payload = await response.json()
  if (!response.ok)
    throw new Error(payload?.error ?? 'Enterprise login failed')

  const tokenResponse = oauthTokenResponseSchema.parse(payload)
  const session: StoredSession = {
    serverUrl: tokenResponse.matrixSession.serverUrl,
    userId: tokenResponse.matrixSession.userId,
    accessToken: tokenResponse.matrixSession.accessToken,
    deviceId: tokenResponse.matrixSession.deviceId,
  }
  persistSession(session)
  localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify(tokenResponse.muonSession))
  localStorage.removeItem(ENTERPRISE_PKCE_KEY)
  createClient(session)
  return session
}

export async function logout(): Promise<void> {
  try {
    try {
      stopSync()
    }
    catch {
      // continue logout even if local sync cleanup fails
    }

    await getClient().logout(true)
  }
  catch {
    // ignore logout errors
  }
  finally {
    try {
      unbindClientEvents()
    }
    catch {
      // continue clearing local session even if event cleanup fails
    }

    clearSession()
    localStorage.removeItem(ENTERPRISE_SESSION_KEY)
    localStorage.removeItem(ENTERPRISE_PKCE_KEY)
    destroyClient()
  }
}

export function restoreSession(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw)
    return false

  try {
    const parsed = JSON.parse(raw)
    const result = sessionSchema.safeParse(parsed)
    if (!result.success) {
      clearSession()
      return false
    }
    createClient(result.data)
    return true
  }
  catch {
    clearSession()
    return false
  }
}
