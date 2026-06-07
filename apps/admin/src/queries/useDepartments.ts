import type { CreateDepartmentRequest } from '@muon/enterprise-contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { createDepartment, deleteDepartment, listDepartments, updateDepartment } from '@/api'
import { handleAuthError } from '@/lib/authError'
import { sessionStore } from '@/stores/sessionStore'

export const departmentsQueryKey = ['departments'] as const

/**
 * 部门列表 query。包装 api.ts 的 `listDepartments` Effect，仅在已登录时启用。
 */
export function useDepartments() {
  return useQuery({
    queryKey: departmentsQueryKey,
    queryFn: () => listDepartments(sessionStore.state.adminToken),
    enabled: () => Boolean(sessionStore.state.adminToken),
    select: (data) => data.departments,
  })
}

/**
 * 创建部门 mutation。成功后失效部门列表触发刷新；401 → clearToken。
 */
export function useCreateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDepartmentRequest) => createDepartment(sessionStore.state.adminToken, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: departmentsQueryKey })
    },
    onError: handleAuthError,
  })
}

/**
 * 调整部门上级 mutation。成功后失效部门列表触发刷新；401 → clearToken。
 */
export function useReparentDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { departmentId: string; parentId: string | null }) =>
      updateDepartment(sessionStore.state.adminToken, input.departmentId, { parentId: input.parentId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: departmentsQueryKey })
    },
    onError: handleAuthError,
  })
}

/**
 * 删除部门 mutation。成功后失效部门列表触发刷新；401 → clearToken。
 */
export function useDeleteDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (departmentId: string) => deleteDepartment(sessionStore.state.adminToken, departmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: departmentsQueryKey })
    },
    onError: handleAuthError,
  })
}
