import type { CreateOrganizationRequest } from '@muon/enterprise-contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createOrganization, listOrganizations } from '@/api'
import { clearToken, sessionStore } from '@/stores/sessionStore'

export const organizationsQueryKey = ['organizations'] as const

/** 401/认证类错误 → 收口到 sessionStore.clearToken()。复用 AdminApp 的判定语义。 */
function isAuthenticationError(error: unknown): boolean {
  return error instanceof Error && /authentication|credentials|required/i.test(error.message)
}

function handleAuthError(error: unknown): void {
  if (isAuthenticationError(error)) clearToken()
}

/**
 * 组织列表 query。包装 api.ts 的 `listOrganizations` Effect（已内部 runAdminEffect），
 * 仅在已登录时启用，token 缺失时禁用并返回空。
 */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationsQueryKey,
    queryFn: () => listOrganizations(sessionStore.state.adminToken),
    enabled: () => Boolean(sessionStore.state.adminToken),
    select: (data) => data.organizations,
  })
}

/**
 * 创建组织 mutation。成功后失效组织列表触发刷新；
 * 401 → clearToken。包装 api.ts 的 `createOrganization` Effect。
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrganizationRequest) => createOrganization(sessionStore.state.adminToken, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationsQueryKey })
    },
    onError: handleAuthError,
  })
}
