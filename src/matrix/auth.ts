import type { LoginCredentials, RegisterParams } from './types'
import { createClient, destroyClient, getClient } from './client'

const STORAGE_KEY = 'muon_auth'

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

export async function login(serverUrl: string, credentials: LoginCredentials): Promise<StoredSession> {
  const client = createClient({ serverUrl })
  const response = await client.login('m.login.password', {
    user: credentials.username,
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
  const response = await client.register(
    params.username,
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

export async function logout(): Promise<void> {
  try {
    await getClient().logout(true)
  }
  catch {
    // ignore logout errors
  }
  clearSession()
  destroyClient()
}

export function restoreSession(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw)
    return false

  try {
    const session: StoredSession = JSON.parse(raw)
    createClient(session)
    return true
  }
  catch {
    clearSession()
    return false
  }
}
