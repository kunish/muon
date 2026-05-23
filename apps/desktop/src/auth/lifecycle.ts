import type { LoginCredentials } from '@matrix/types'
import { activateMatrixSession, bindClientEvents, logoutMatrix, restoreMatrixSession, startSync, stopSync } from '@matrix/index'
import { clear as clearEnterprise, complete as completeEnterprise, defaultEnterpriseSessionDeps, restore as restoreEnterprise } from '@/enterprise/session'

export interface BootstrapResult {
  restored: boolean
}

export async function bootstrap(): Promise<BootstrapResult> {
  const deps = defaultEnterpriseSessionDeps()

  const enterprise = await restoreEnterprise(deps).catch(() => null)
  if (enterprise) {
    await activateMatrixSession(enterprise.matrix)
    bindClientEvents()
    startSync()
    return { restored: true }
  }

  const matrixOnly = await restoreMatrixSession()
  if (matrixOnly) {
    bindClientEvents()
    startSync()
    return { restored: true }
  }

  return { restored: false }
}

export async function signInWithPassword(serverUrl: string, credentials: LoginCredentials): Promise<void> {
  const { loginWithPassword } = await import('@matrix/index')
  await loginWithPassword(serverUrl, credentials)
  bindClientEvents()
  startSync()
}

export async function signInWithEnterprise(callbackUrl: string): Promise<void> {
  const deps = defaultEnterpriseSessionDeps()
  const session = await completeEnterprise(callbackUrl, deps)
  await activateMatrixSession(session.matrix)
  bindClientEvents()
  startSync()
}

export async function startEnterpriseSignIn(): Promise<void> {
  const { start } = await import('@/enterprise/session')
  await start(defaultEnterpriseSessionDeps())
}

export async function signOut(): Promise<void> {
  stopSync()
  await logoutMatrix()
  clearEnterprise(defaultEnterpriseSessionDeps())
}

export { isEnterpriseAuthConfigured } from '@/enterprise/session'
