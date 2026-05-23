import type { MatrixSession } from '@muon/enterprise-contracts'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
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

function bestEffortCleanup(step: string, cleanup: DesktopEffect<unknown>): DesktopEffect<void> {
  return cleanup.pipe(
    Effect.catchAll((err) =>
      fromSync(() => {
        warnLocalCleanupFailure(step, err)
      }),
    ),
    Effect.asVoid,
  )
}

export function activateEffect(session: MatrixSession): DesktopEffect<boolean> {
  return Effect.gen(function* () {
    if (activeSession) {
      if (sameMatrixSession(activeSession, session)) return false

      return yield* Effect.fail(
        new Error('Cannot activate a different MatrixSession while another MatrixSession is active'),
      )
    }

    yield* fromPromise(() => activateMatrixSession(session))
    yield* fromSync(() => bindClientEvents())
    yield* fromSync(() => startSync())
    activeSession = session
    return true
  })
}

export function activate(session: MatrixSession): Promise<boolean> {
  return runDesktopEffect(activateEffect(session))
}

export function revokeMatrixSessionEffect(): DesktopEffect<void> {
  return fromPromise(() => getClient().logout(true)).pipe(
    Effect.catchAll((err) =>
      fromSync(() => {
        console.warn('[matrix] MatrixSession revoke failed against homeserver; continuing local cleanup', err)
      }),
    ),
    Effect.asVoid,
  )
}

export function revokeMatrixSession(): Promise<void> {
  return runDesktopEffect(revokeMatrixSessionEffect())
}

export function deactivateEffect(options: DeactivateOptions = {}): DesktopEffect<void> {
  return Effect.gen(function* () {
    yield* bestEffortCleanup(
      'stopSync',
      fromSync(() => stopSync()),
    )

    if (options.revoke) yield* revokeMatrixSessionEffect()

    yield* bestEffortCleanup(
      'unbindClientEvents',
      fromSync(() => unbindClientEvents()),
    )
    yield* bestEffortCleanup(
      'clearMatrixSessionStore',
      fromSync(() => clearMatrixSessionStore()),
    )
    yield* bestEffortCleanup(
      'destroyClient',
      fromSync(() => destroyClient()),
    )

    activeSession = null
  })
}

export function deactivate(options: DeactivateOptions = {}): Promise<void> {
  return runDesktopEffect(deactivateEffect(options))
}

export function __resetMatrixSessionLifecycleForTests(): void {
  activeSession = null
}
