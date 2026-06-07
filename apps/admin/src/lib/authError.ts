import { clearToken } from '@/stores/sessionStore'

/**
 * 401/认证类错误判定。沿用旧 AdminApp 的语义：消息匹配
 * authentication / credentials / required 即视为认证失效。
 */
export function isAuthenticationError(error: unknown): boolean {
  return error instanceof Error && /authentication|credentials|required/i.test(error.message)
}

/** 认证类错误 → 收口到 sessionStore.clearToken()，统一登出。 */
export function handleAuthError(error: unknown): void {
  if (isAuthenticationError(error)) clearToken()
}
