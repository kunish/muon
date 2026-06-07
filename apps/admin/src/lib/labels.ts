import type { Organization, UserRole, UserStatus } from '@muon/enterprise-contracts'

/** 角色 → 中文标签。沿用旧 AdminApp 的语义。 */
export function roleLabel(role: UserRole): string {
  return role === 'owner' ? 'Owner' : role === 'admin' ? '管理员' : '成员'
}

/** 用户/组织状态 → 中文标签。组织与用户共用同一组状态枚举，故收口到一处。 */
export function statusLabel(status: Organization['status'] | UserStatus): string {
  return status === 'active' ? '正常' : status === 'disabled' ? '已停用' : '已暂停'
}
