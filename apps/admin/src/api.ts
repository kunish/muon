import type {
  AdminLoginRequest,
  AdminSession,
  AuditLog,
  ChangeOwnPasswordRequest,
  CreateOrganizationRequest,
  CreateUserRequest,
  DeviceSessionPublic,
  EnterpriseUser,
  InstallRequest,
  Organization,
  ResetPasswordRequest,
  UpdateUserRequest,
} from '@muon/enterprise-contracts'

const API_BASE_URL = import.meta.env.VITE_MUON_API_BASE_URL ?? 'http://127.0.0.1:8787'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? '请求失败')
  }
  return (await response.json()) as T
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
