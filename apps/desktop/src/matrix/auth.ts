import type { MatrixSession } from '@muon/enterprise-contracts'
import type { LoginCredentials, RegisterParams } from './types'
import type { SafeStorageLike } from '@/shared/safeStorageStore'
import { matrixSessionSchema } from '@muon/enterprise-contracts'
import { getDesktopBridge, isElectronRuntime } from '@/desktop/bridge'
import { makeEncryptedStore } from '@/shared/safeStorageStore'
import { createClient, createEphemeralClient } from './client'

const STORAGE_KEY = 'muon_auth'
const LEADING_AT_RE = /^@/

function bridgeSafeStorage(): SafeStorageLike {
  if (!isElectronRuntime()) {
    return {
      isAvailable: async () => false,
      encrypt: async (s) => s,
      decrypt: async (s) => s,
    }
  }
  return {
    isAvailable: () => getDesktopBridge()!.safeStorage.isAvailable(),
    encrypt: (s) => getDesktopBridge()!.safeStorage.encrypt(s),
    decrypt: (s) => getDesktopBridge()!.safeStorage.decrypt(s),
  }
}

function matrixSessionStore() {
  return makeEncryptedStore({ key: STORAGE_KEY, schema: matrixSessionSchema, safeStorage: bridgeSafeStorage() })
}

export async function loginWithPassword(serverUrl: string, credentials: LoginCredentials): Promise<MatrixSession> {
  const client = createEphemeralClient(serverUrl)
  const localpart = credentials.username.replace(LEADING_AT_RE, '').split(':')[0]

  const response = await client.login('m.login.password', {
    identifier: { type: 'm.id.user', user: localpart },
    password: credentials.password,
  })

  const session: MatrixSession = {
    serverUrl,
    userId: response.user_id,
    accessToken: response.access_token,
    deviceId: response.device_id,
  }
  return session
}

export async function register(serverUrl: string, params: RegisterParams): Promise<MatrixSession> {
  const client = createEphemeralClient(serverUrl)
  const localpart = params.username.replace(LEADING_AT_RE, '').split(':')[0]
  const response = await client.register(localpart, params.password, null, { type: 'm.login.dummy' })

  const session: MatrixSession = {
    serverUrl,
    userId: response.user_id,
    accessToken: response.access_token!,
    deviceId: response.device_id!,
  }
  return session
}

/** Read-only loader. Used by EnterpriseSession.restore via the readMatrixSession dep — does NOT create a Matrix client. */
export async function readMatrixSessionFromStore(): Promise<MatrixSession | null> {
  return matrixSessionStore().read()
}

/** Persist the given session and create the Matrix client. Called by lifecycle after a fresh enterprise sign-in. */
export async function activateMatrixSession(session: MatrixSession): Promise<void> {
  await matrixSessionStore().write(session)
  createClient(session)
}

export function clearMatrixSessionStore(): void {
  matrixSessionStore().clear()
}
