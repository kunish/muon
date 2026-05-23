import type { MatrixSession } from '@muon/enterprise-contracts'
import type { LoginCredentials, RegisterParams } from './types'
import type { DesktopEffect } from '@/shared/lib/effect'
import type { SafeStorageLike } from '@/shared/safeStorageStore'
import { matrixSessionSchema } from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { getDesktopBridge, isElectronRuntime } from '@/desktop/bridge'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { makeEncryptedStore } from '@/shared/safeStorageStore'
import { createClient, createEphemeralClient } from './client'

const STORAGE_KEY = 'muon_auth'
const LEADING_AT_RE = /^@/

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

function matrixSessionStore() {
  return makeEncryptedStore({ key: STORAGE_KEY, schema: matrixSessionSchema, safeStorage: bridgeSafeStorage() })
}

export function loginWithPasswordEffect(
  serverUrl: string,
  credentials: LoginCredentials,
): DesktopEffect<MatrixSession> {
  return Effect.gen(function* () {
    const client = createEphemeralClient(serverUrl)
    const localpart = credentials.username.replace(LEADING_AT_RE, '').split(':')[0]

    const response = yield* fromPromise(() =>
      client.login('m.login.password', {
        identifier: { type: 'm.id.user', user: localpart },
        password: credentials.password,
      }),
    )

    return {
      serverUrl,
      userId: response.user_id,
      accessToken: response.access_token,
      deviceId: response.device_id,
    }
  })
}

export function loginWithPassword(serverUrl: string, credentials: LoginCredentials): Promise<MatrixSession> {
  return runDesktopEffect(loginWithPasswordEffect(serverUrl, credentials))
}

export function registerEffect(serverUrl: string, params: RegisterParams): DesktopEffect<MatrixSession> {
  return Effect.gen(function* () {
    const client = createEphemeralClient(serverUrl)
    const localpart = params.username.replace(LEADING_AT_RE, '').split(':')[0]
    const response = yield* fromPromise(() =>
      client.register(localpart, params.password, null, { type: 'm.login.dummy' }),
    )

    return {
      serverUrl,
      userId: response.user_id,
      accessToken: response.access_token!,
      deviceId: response.device_id!,
    }
  })
}

export function register(serverUrl: string, params: RegisterParams): Promise<MatrixSession> {
  return runDesktopEffect(registerEffect(serverUrl, params))
}

/** Read-only loader. Used by EnterpriseSession.restore via the readMatrixSession dep — does NOT create a Matrix client. */
export function readMatrixSessionFromStoreEffect(): DesktopEffect<MatrixSession | null> {
  return fromPromise(() => matrixSessionStore().read())
}

export function readMatrixSessionFromStore(): Promise<MatrixSession | null> {
  return runDesktopEffect(readMatrixSessionFromStoreEffect())
}

/** Persist the given session and create the Matrix client. Called by lifecycle after a fresh enterprise sign-in. */
export function activateMatrixSessionEffect(session: MatrixSession): DesktopEffect<void> {
  return Effect.gen(function* () {
    yield* fromPromise(() => matrixSessionStore().write(session))
    yield* fromSync(() => createClient(session))
  })
}

export function activateMatrixSession(session: MatrixSession): Promise<void> {
  return runDesktopEffect(activateMatrixSessionEffect(session))
}

export function clearMatrixSessionStore(): void {
  matrixSessionStore().clear()
}
