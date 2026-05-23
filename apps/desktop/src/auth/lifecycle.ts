import type { LoginCredentials, RegisterParams } from '@matrix/types'
import type { MatrixSession } from '@muon/enterprise-contracts'
import type { SignOutReason } from './lifecycleEvents'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import {
  clear as clearEnterprise,
  complete as completeEnterprise,
  defaultEnterpriseSessionDeps,
  isEnterpriseAuthConfigured,
  restore as restoreEnterprise,
  start as startEnterprise,
} from '@/enterprise/session'
import { loginWithPassword, readMatrixSessionFromStore, register } from '@/matrix/auth'
import { setMyDisplayName } from '@/matrix/profile'
import { activate, deactivate } from '@/matrix/sessionLifecycle'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { emitSignIn, emitSignOut } from './lifecycleEvents'

export interface BootstrapResult {
  restored: 'enterprise' | 'matrix-only' | false
}

function activateSessionEffect(session: MatrixSession): DesktopEffect<void> {
  return Effect.gen(function* () {
    const activated = yield* fromPromise(() => activate(session))
    if (activated) yield* fromSync(() => emitSignIn(session))
  })
}

export function bootstrapEffect(): DesktopEffect<BootstrapResult> {
  return Effect.gen(function* () {
    const deps = defaultEnterpriseSessionDeps()
    const enterprise = yield* fromPromise(() => restoreEnterprise(deps)).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (enterprise) {
      yield* activateSessionEffect(enterprise.matrix)
      return { restored: 'enterprise' }
    }

    const matrixOnly = yield* fromPromise(() => readMatrixSessionFromStore())
    if (matrixOnly) {
      yield* activateSessionEffect(matrixOnly)
      return { restored: 'matrix-only' }
    }

    return { restored: false }
  })
}

export function bootstrap(): Promise<BootstrapResult> {
  return runDesktopEffect(bootstrapEffect())
}

export { isEnterpriseAuthConfigured }

export function signInWithPasswordEffect(serverUrl: string, credentials: LoginCredentials): DesktopEffect<void> {
  return Effect.gen(function* () {
    const session = yield* fromPromise(() => loginWithPassword(serverUrl, credentials))
    yield* activateSessionEffect(session)
  })
}

export function signInWithPassword(serverUrl: string, credentials: LoginCredentials): Promise<void> {
  return runDesktopEffect(signInWithPasswordEffect(serverUrl, credentials))
}

export function signUpWithPasswordEffect(serverUrl: string, params: RegisterParams): DesktopEffect<void> {
  return Effect.gen(function* () {
    const session = yield* fromPromise(() => register(serverUrl, params))
    yield* activateSessionEffect(session)

    if (params.displayName) yield* fromPromise(() => setMyDisplayName(params.displayName!))
  })
}

export function signUpWithPassword(serverUrl: string, params: RegisterParams): Promise<void> {
  return runDesktopEffect(signUpWithPasswordEffect(serverUrl, params))
}

export function signInWithEnterpriseEffect(callbackUrl: string): DesktopEffect<void> {
  return Effect.gen(function* () {
    const deps = defaultEnterpriseSessionDeps()
    const session = yield* fromPromise(() => completeEnterprise(callbackUrl, deps))
    yield* activateSessionEffect(session.matrix)
  })
}

export function signInWithEnterprise(callbackUrl: string): Promise<void> {
  return runDesktopEffect(signInWithEnterpriseEffect(callbackUrl))
}

export function startEnterpriseSignInEffect(): DesktopEffect<void> {
  return fromPromise(() => startEnterprise(defaultEnterpriseSessionDeps()))
}

export function startEnterpriseSignIn(): Promise<void> {
  return runDesktopEffect(startEnterpriseSignInEffect())
}

export function signOutEffect(reason: SignOutReason = 'user-initiated'): DesktopEffect<void> {
  return Effect.gen(function* () {
    yield* fromSync(() => emitSignOut(reason))
    yield* fromPromise(() => deactivate({ revoke: true })).pipe(
      Effect.ensuring(Effect.sync(() => clearEnterprise(defaultEnterpriseSessionDeps()))),
    )
  })
}

export function signOut(reason: SignOutReason = 'user-initiated'): Promise<void> {
  return runDesktopEffect(signOutEffect(reason))
}
