import type { LoginCredentials, RegisterParams } from '@matrix/types'
import type { MatrixSession } from '@muon/enterprise-contracts'
import type { SignOutReason } from './lifecycleEvents'
import { clear as clearEnterprise, complete as completeEnterprise, defaultEnterpriseSessionDeps, isEnterpriseAuthConfigured, restore as restoreEnterprise, start as startEnterprise } from '@/enterprise/session'
import { loginWithPassword, readMatrixSessionFromStore, register } from '@/matrix/auth'
import { setMyDisplayName } from '@/matrix/profile'
import { activate, deactivate } from '@/matrix/sessionLifecycle'
import { emitSignIn, emitSignOut } from './lifecycleEvents'

export interface BootstrapResult {
  restored: 'enterprise' | 'matrix-only' | false
}

async function activateSession(session: MatrixSession): Promise<void> {
  const activated = await activate(session)
  if (activated)
    emitSignIn(session)
}

export async function bootstrap(): Promise<BootstrapResult> {
  const deps = defaultEnterpriseSessionDeps()
  const enterprise = await restoreEnterprise(deps).catch(() => null)
  if (enterprise) {
    await activateSession(enterprise.matrix)
    return { restored: 'enterprise' }
  }

  const matrixOnly = await readMatrixSessionFromStore()
  if (matrixOnly) {
    await activateSession(matrixOnly)
    return { restored: 'matrix-only' }
  }

  return { restored: false }
}

export { isEnterpriseAuthConfigured }

export async function signInWithPassword(serverUrl: string, credentials: LoginCredentials): Promise<void> {
  const session = await loginWithPassword(serverUrl, credentials)
  await activateSession(session)
}

export async function signUpWithPassword(serverUrl: string, params: RegisterParams): Promise<void> {
  const session = await register(serverUrl, params)
  await activateSession(session)

  if (params.displayName)
    await setMyDisplayName(params.displayName)
}

export async function signInWithEnterprise(callbackUrl: string): Promise<void> {
  const deps = defaultEnterpriseSessionDeps()
  const session = await completeEnterprise(callbackUrl, deps)
  await activateSession(session.matrix)
}

export async function startEnterpriseSignIn(): Promise<void> {
  await startEnterprise(defaultEnterpriseSessionDeps())
}

export async function signOut(reason: SignOutReason = 'user-initiated'): Promise<void> {
  emitSignOut(reason)
  try {
    await deactivate({ revoke: true })
  }
  finally {
    clearEnterprise(defaultEnterpriseSessionDeps())
  }
}
