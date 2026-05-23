import type { EnterpriseUserRecord } from '../../repository'

export function hasAdminRole(user: EnterpriseUserRecord): boolean {
  return user.roles.includes('owner') || user.roles.includes('admin')
}

export function assertAdminRole(user: EnterpriseUserRecord): void {
  if (!hasAdminRole(user)) throw new Error('Requires admin role')
}
