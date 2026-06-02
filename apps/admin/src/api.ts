import type {
  AdminLoginRequest,
  AdminSession,
  AuditLog,
  ChangeOwnPasswordRequest,
  CreateDepartmentRequest,
  CreateOrganizationRequest,
  CreateUserRequest,
  Department,
  DeviceSessionPublic,
  EnterpriseUser,
  InstallRequest,
  Organization,
  ResetPasswordRequest,
  UpdateDepartmentRequest,
  UpdateUserRequest,
} from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { fromPromise, runAdminEffect } from './effect'

const API_BASE_URL = import.meta.env.VITE_MUON_API_BASE_URL ?? 'http://127.0.0.1:8787'

function parseErrorPayload(response: Response) {
  return fromPromise(() => response.json() as Promise<{ error?: string }>).pipe(
    Effect.catchAll(() => Effect.succeed({})),
  )
}

function requestEffect<T>(path: string, init?: RequestInit) {
  return Effect.gen(function* () {
    const response = yield* fromPromise(() =>
      fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...init?.headers,
        },
      }),
    )
    if (!response.ok) {
      const payload = yield* parseErrorPayload(response)
      return yield* Effect.fail(new Error(payload.error ?? '请求失败'))
    }
    return (yield* fromPromise(() => response.json())) as T
  })
}

function request<T>(path: string, init?: RequestInit): Promise<T> {
  return runAdminEffect(requestEffect<T>(path, init))
}

export function getInstallStatus(): Promise<{ installed: boolean }> {
  return request('/api/install/status')
}

export function installMuon(input: InstallRequest): Promise<unknown> {
  return request('/api/install', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function loginAdmin(input: AdminLoginRequest): Promise<{ session: AdminSession; user: EnterpriseUser }> {
  return request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listOrganizations(token: string): Promise<{ organizations: Organization[] }> {
  return request('/api/admin/organizations', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}

export function createOrganization(
  token: string,
  input: CreateOrganizationRequest,
): Promise<{ organization: Organization; owner: EnterpriseUser }> {
  return request('/api/admin/organizations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
}

export function listUsers(token: string): Promise<{ users: EnterpriseUser[] }> {
  return request('/api/admin/users', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}

export function listDepartments(token: string): Promise<{ departments: Department[] }> {
  return request('/api/admin/departments', {
    headers: { authorization: `Bearer ${token}` },
  })
}

export function createDepartment(token: string, input: CreateDepartmentRequest): Promise<{ department: Department }> {
  return request('/api/admin/departments', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateDepartment(
  token: string,
  departmentId: string,
  input: UpdateDepartmentRequest,
): Promise<{ department: Department }> {
  return request(`/api/admin/departments/${encodeURIComponent(departmentId)}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteDepartment(token: string, departmentId: string): Promise<{ ok: true }> {
  return request(`/api/admin/departments/${encodeURIComponent(departmentId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  })
}

export function createAdminUser(token: string, input: CreateUserRequest): Promise<{ user: EnterpriseUser }> {
  return request('/api/admin/users', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
}

export function updateAdminUser(
  token: string,
  userId: string,
  input: UpdateUserRequest,
): Promise<{ user: EnterpriseUser }> {
  return request(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
}

export function resetAdminUserPassword(
  token: string,
  userId: string,
  input: ResetPasswordRequest,
): Promise<{ user: EnterpriseUser }> {
  return request(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
}

export function listAuditLogs(token: string): Promise<{ auditLogs: AuditLog[] }> {
  return request('/api/admin/audit-logs', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}

export function getAdminMe(token: string): Promise<{ user: EnterpriseUser }> {
  return request('/api/admin/me', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}

export function logoutAdmin(token: string): Promise<{ ok: true }> {
  return request('/api/admin/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
}

export function changeOwnPassword(token: string, input: ChangeOwnPasswordRequest): Promise<{ user: EnterpriseUser }> {
  return request('/api/admin/me/password', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
}

export function listUserDeviceSessions(token: string, userId: string): Promise<{ sessions: DeviceSessionPublic[] }> {
  return request(`/api/admin/users/${encodeURIComponent(userId)}/sessions`, {
    headers: { authorization: `Bearer ${token}` },
  })
}

export function revokeUserDeviceSession(token: string, userId: string, sessionId: string): Promise<{ ok: true }> {
  return request(`/api/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  })
}
