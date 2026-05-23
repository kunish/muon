import type { MatrixSession } from '@muon/enterprise-contracts'
import { activateMatrixSession, clearMatrixSessionStore } from './auth'
import { destroyClient, getClient } from './client'
import { bindClientEvents, unbindClientEvents } from './events'
import { startSync, stopSync } from './sync'

export interface DeactivateOptions {
  revoke?: boolean
}

let activeSession: MatrixSession | null = null

function sameMatrixSession(left: MatrixSession, right: MatrixSession): boolean {
  return (
    left.serverUrl === right.serverUrl &&
    left.userId === right.userId &&
    left.deviceId === right.deviceId &&
    left.accessToken === right.accessToken
  )
}

function warnLocalCleanupFailure(step: string, err: unknown): void {
  console.warn(`[matrix] ${step} failed during local MatrixSession cleanup`, err)
}

export async function activate(session: MatrixSession): Promise<boolean> {
  if (activeSession) {
    if (sameMatrixSession(activeSession, session)) return false

    throw new Error('Cannot activate a different MatrixSession while another MatrixSession is active')
  }

  await activateMatrixSession(session)
  bindClientEvents()
  startSync()
  activeSession = session
  return true
}

export async function revokeMatrixSession(): Promise<void> {
  try {
    await getClient().logout(true)
  } catch (err) {
    console.warn('[matrix] MatrixSession revoke failed against homeserver; continuing local cleanup', err)
  }
}

export async function deactivate(options: DeactivateOptions = {}): Promise<void> {
  try {
    stopSync()
  } catch (err) {
    warnLocalCleanupFailure('stopSync', err)
  }

  if (options.revoke) await revokeMatrixSession()

  try {
    unbindClientEvents()
  } catch (err) {
    warnLocalCleanupFailure('unbindClientEvents', err)
  }

  try {
    clearMatrixSessionStore()
  } catch (err) {
    warnLocalCleanupFailure('clearMatrixSessionStore', err)
  }

  try {
    destroyClient()
  } catch (err) {
    warnLocalCleanupFailure('destroyClient', err)
  }

  activeSession = null
}

export function __resetMatrixSessionLifecycleForTests(): void {
  activeSession = null
}
