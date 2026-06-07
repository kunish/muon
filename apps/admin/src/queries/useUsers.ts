import type { CreateUserRequest, ResetPasswordRequest, UpdateUserRequest } from '@muon/enterprise-contracts'
import type { MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { toValue } from 'vue'
import {
  createAdminUser,
  listUserDeviceSessions,
  listUsers,
  resetAdminUserPassword,
  revokeUserDeviceSession,
  updateAdminUser,
} from '@/api'
import { handleAuthError } from '@/lib/authError'
import { sessionStore } from '@/stores/sessionStore'

export const usersQueryKey = ['users'] as const

/** 某用户的设备会话 queryKey。按 userId 分桶，配合懒加载 `enabled` 控制按需拉取。 */
export function userSessionsQueryKey(userId: string) {
  return ['userSessions', userId] as const
}

/**
 * 用户列表 query。包装 api.ts 的 `listUsers` Effect，仅在已登录时启用。
 */
export function useUsers() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: () => listUsers(sessionStore.state.adminToken),
    enabled: () => Boolean(sessionStore.state.adminToken),
    select: (data) => data.users,
  })
}

/**
 * 创建用户 mutation。成功后失效用户列表触发刷新；401 → clearToken。
 */
export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserRequest) => createAdminUser(sessionStore.state.adminToken, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
    onError: handleAuthError,
  })
}

/**
 * 更新用户 mutation。字段编辑与启停（传 `status`）共用此 mutation；
 * 成功后失效用户列表触发刷新；401 → clearToken。
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; patch: UpdateUserRequest }) =>
      updateAdminUser(sessionStore.state.adminToken, input.userId, input.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
    onError: handleAuthError,
  })
}

/**
 * 重置用户密码 mutation。成功后失效用户列表（mustChangePassword 标记可能变化）；
 * 401 → clearToken。
 */
export function useResetUserPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; payload: ResetPasswordRequest }) =>
      resetAdminUserPassword(sessionStore.state.adminToken, input.userId, input.payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
    onError: handleAuthError,
  })
}

/**
 * 单用户设备会话 query（嵌套、按需）。queryKey 含 userId，`enabled` 仅在该用户行展开时为 true，
 * 实现懒加载：未展开不请求。包装 api.ts 的 `listUserDeviceSessions` Effect。
 */
export function useUserSessions(userId: string, enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: userSessionsQueryKey(userId),
    queryFn: () => listUserDeviceSessions(sessionStore.state.adminToken, userId),
    enabled: () => toValue(enabled) && Boolean(sessionStore.state.adminToken),
    select: (data) => data.sessions,
  })
}

/**
 * 吊销单个设备会话 mutation。成功后仅失效对应用户的会话 query（`['userSessions', userId]`），
 * 不波及用户列表；401 → clearToken。
 */
export function useRevokeUserSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; sessionId: string }) =>
      revokeUserDeviceSession(sessionStore.state.adminToken, input.userId, input.sessionId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: userSessionsQueryKey(variables.userId) })
    },
    onError: handleAuthError,
  })
}
