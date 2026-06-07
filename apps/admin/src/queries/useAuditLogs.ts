import { useQuery } from '@tanstack/vue-query'
import { listAuditLogs } from '@/api'
import { sessionStore } from '@/stores/sessionStore'

export const auditLogsQueryKey = ['auditLogs'] as const

/**
 * 审计日志 query（只读，无 mutation）。包装 api.ts 的 `listAuditLogs` Effect，
 * 仅在已登录时启用。
 */
export function useAuditLogs() {
  return useQuery({
    queryKey: auditLogsQueryKey,
    queryFn: () => listAuditLogs(sessionStore.state.adminToken),
    enabled: () => Boolean(sessionStore.state.adminToken),
    select: (data) => data.auditLogs,
  })
}
