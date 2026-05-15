import type {
  AuditLog,
  EnterpriseUser,
  MatrixSession,
  Organization,
  OrganizationStatus,
  UserRole,
  UserStatus,
} from '@muon/enterprise-contracts'
import { randomUUID } from 'node:crypto'

export interface EnterpriseUserRecord extends EnterpriseUser {
  passwordHash: string
}

export interface CreateOrganizationInput {
  name: string
  slug: string
  status?: OrganizationStatus
}

export interface CreateUserInput {
  displayName: string
  email: string
  mustChangePassword: boolean
  organizationId: string
  passwordHash: string
  roles: UserRole[]
  status: UserStatus
  username: string
}

export interface UpdateUserInput {
  displayName?: string
  email?: string
  roles?: UserRole[]
  status?: UserStatus
  username?: string
}

export interface ResetUserPasswordInput {
  mustChangePassword: boolean
  passwordHash: string
}

export interface AppendAuditLogInput {
  action: string
  actorUserId: string | null
  ipAddress?: string | null
  metadata?: Record<string, unknown>
  organizationId: string
  targetId?: string | null
  targetType: string
  userAgent?: string | null
}

export interface AuthorizationCodeRecord {
  clientId: string
  codeChallenge: string
  codeChallengeMethod: 'plain' | 'S256'
  codeHash: string
  createdAt: string
  expiresAt: string
  id: string
  matrixSession: MatrixSession
  organizationId: string
  redirectUri: string
  usedAt: string | null
  userId: string
}

export interface DeviceSessionRecord {
  accessTokenHash: string
  createdAt: string
  deviceName: string
  expiresAt: string
  id: string
  organizationId: string
  refreshTokenHash: string
  revokedAt: string | null
  userId: string
}

export interface MatrixAccountRecord {
  accessToken: string
  lastProvisionedAt: string
  matrixDeviceId: string
  matrixUserId: string
  organizationId: string
  provisioningStatus: 'active' | 'failed'
  userId: string
}

export interface CreateAuthorizationCodeInput {
  clientId: string
  codeChallenge: string
  codeChallengeMethod: 'plain' | 'S256'
  codeHash: string
  expiresAt: string
  matrixSession: MatrixSession
  organizationId: string
  redirectUri: string
  userId: string
}

export interface CreateAdminSessionInput {
  organizationId: string
  userId: string
  accessTokenHash: string
  refreshTokenHash: string
  expiresAt: string
}

export interface AdminSessionRecord {
  id: string
  organizationId: string
  userId: string
  accessTokenHash: string
  refreshTokenHash: string
  expiresAt: string
  revokedAt: string | null
  createdAt: string
  lastSeenAt: string
}

export interface CreateDeviceSessionInput {
  accessTokenHash: string
  deviceName: string
  expiresAt: string
  organizationId: string
  refreshTokenHash: string
  userId: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function publicUser(user: EnterpriseUserRecord): EnterpriseUser {
  const { passwordHash: _passwordHash, ...safeUser } = user
  return safeUser
}

export interface EnterpriseRepository {
  adminSessions: AdminSessionRecord[]
  auditLogs: AuditLog[]
  authorizationCodes: AuthorizationCodeRecord[]
  deviceSessions: DeviceSessionRecord[]
  matrixAccounts: MatrixAccountRecord[]
  organizations: Organization[]
  users: EnterpriseUserRecord[]
  appendAuditLog: (input: AppendAuditLogInput) => Promise<AuditLog>
  createAdminSession: (input: CreateAdminSessionInput) => Promise<AdminSessionRecord>
  createAuthorizationCode: (input: CreateAuthorizationCodeInput) => Promise<AuthorizationCodeRecord>
  createDeviceSession: (input: CreateDeviceSessionInput) => Promise<DeviceSessionRecord>
  createOrganization: (input: CreateOrganizationInput) => Promise<Organization>
  createUser: (input: CreateUserInput) => Promise<EnterpriseUserRecord>
  findActiveDeviceSessionsByUser: (
    organizationId: string,
    userId: string,
  ) => Promise<DeviceSessionRecord[]>
  findAdminSessionByTokenHash: (accessTokenHash: string) => Promise<AdminSessionRecord | null>
  findAuthorizationCodeByHash: (codeHash: string) => Promise<AuthorizationCodeRecord | null>
  findDeviceSessionById: (id: string) => Promise<DeviceSessionRecord | null>
  findDeviceSessionByRefreshTokenHash: (refreshTokenHash: string) => Promise<DeviceSessionRecord | null>
  findMatrixAccount: (organizationId: string, userId: string) => Promise<MatrixAccountRecord | null>
  findOrganizationBySlug: (slug: string) => Promise<Organization | null>
  findUserById: (organizationId: string, userId: string) => Promise<EnterpriseUserRecord | null>
  findUserByUsername: (organizationId: string, username: string) => Promise<EnterpriseUserRecord | null>
  getPublicUser: (user: EnterpriseUserRecord) => EnterpriseUser
  isInstalled: () => Promise<boolean>
  listAuditLogsByOrganization: (organizationId: string) => Promise<AuditLog[]>
  listOrganizations: () => Promise<Organization[]>
  listUsersByOrganization: (organizationId: string) => Promise<EnterpriseUserRecord[]>
  markAuthorizationCodeUsed: (id: string) => Promise<AuthorizationCodeRecord>
  resetUserPassword: (organizationId: string, userId: string, input: ResetUserPasswordInput) => Promise<EnterpriseUserRecord>
  revokeAdminSession: (id: string) => Promise<void>
  revokeDeviceSession: (id: string) => Promise<boolean>
  revokeAllAdminSessionsForUserExcept: (
    organizationId: string,
    userId: string,
    exceptSessionId: string,
  ) => Promise<void>
  touchAdminSession: (id: string) => Promise<void>
  updateUser: (organizationId: string, userId: string, input: UpdateUserInput) => Promise<EnterpriseUserRecord>
  upsertMatrixAccount: (input: Omit<MatrixAccountRecord, 'lastProvisionedAt' | 'provisioningStatus'>) => Promise<MatrixAccountRecord>
}

export function createInMemoryEnterpriseRepository(): EnterpriseRepository {
  const organizations: Organization[] = []
  const users: EnterpriseUserRecord[] = []
  const adminSessions: AdminSessionRecord[] = []
  const auditLogs: AuditLog[] = []
  const authorizationCodes: AuthorizationCodeRecord[] = []
  const deviceSessions: DeviceSessionRecord[] = []
  const matrixAccounts: MatrixAccountRecord[] = []

  return {
    adminSessions,
    auditLogs,
    authorizationCodes,
    deviceSessions,
    matrixAccounts,
    organizations,
    users,

    async createAdminSession(input) {
      const nowTimestamp = nowIso()
      const session: AdminSessionRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        userId: input.userId,
        accessTokenHash: input.accessTokenHash,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: nowTimestamp,
        lastSeenAt: nowTimestamp,
      }
      adminSessions.push(session)
      return session
    },

    async findAdminSessionByTokenHash(accessTokenHash) {
      return adminSessions.find(session => session.accessTokenHash === accessTokenHash) ?? null
    },

    async touchAdminSession(id) {
      const session = adminSessions.find(item => item.id === id)
      if (session)
        session.lastSeenAt = nowIso()
    },

    async revokeAdminSession(id) {
      const session = adminSessions.find(item => item.id === id)
      if (session && !session.revokedAt)
        session.revokedAt = nowIso()
    },

    async revokeDeviceSession(id) {
      const session = deviceSessions.find(item => item.id === id)
      if (session && !session.revokedAt) {
        session.revokedAt = nowIso()
        return true
      }
      return false
    },

    async revokeAllAdminSessionsForUserExcept(organizationId, userId, exceptSessionId) {
      const nowTimestamp = nowIso()
      for (const session of adminSessions) {
        if (session.organizationId !== organizationId) continue
        if (session.userId !== userId) continue
        if (session.id === exceptSessionId) continue
        if (session.revokedAt) continue
        session.revokedAt = nowTimestamp
      }
    },

    async appendAuditLog(input) {
      const event: AuditLog = {
        id: randomUUID(),
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        createdAt: nowIso(),
      }
      auditLogs.push(event)
      return event
    },

    async createAuthorizationCode(input) {
      const code: AuthorizationCodeRecord = {
        id: randomUUID(),
        codeHash: input.codeHash,
        organizationId: input.organizationId,
        userId: input.userId,
        clientId: input.clientId,
        redirectUri: input.redirectUri,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: input.codeChallengeMethod,
        matrixSession: input.matrixSession,
        expiresAt: input.expiresAt,
        usedAt: null,
        createdAt: nowIso(),
      }
      authorizationCodes.push(code)
      return code
    },

    async createDeviceSession(input) {
      const session: DeviceSessionRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        userId: input.userId,
        deviceName: input.deviceName,
        accessTokenHash: input.accessTokenHash,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: nowIso(),
      }
      deviceSessions.push(session)
      return session
    },

    async createOrganization(input) {
      if (organizations.some(organization => organization.slug === input.slug))
        throw new Error('Organization slug is already in use')

      const createdAt = nowIso()
      const organization: Organization = {
        id: randomUUID(),
        slug: input.slug,
        name: input.name,
        status: input.status ?? 'active',
        createdAt,
        updatedAt: createdAt,
      }
      organizations.push(organization)
      return organization
    },

    async createUser(input) {
      if (users.some(user => user.organizationId === input.organizationId && user.username === input.username))
        throw new Error('Username is already in use')

      const createdAt = nowIso()
      const user: EnterpriseUserRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        username: input.username,
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        status: input.status,
        mustChangePassword: input.mustChangePassword,
        roles: [...input.roles],
        createdAt,
        updatedAt: createdAt,
      }
      users.push(user)
      return user
    },

    async findActiveDeviceSessionsByUser(organizationId, userId) {
      const now = Date.now()
      return deviceSessions.filter(session =>
        session.organizationId === organizationId
        && session.userId === userId
        && session.revokedAt === null
        && Date.parse(session.expiresAt) > now,
      )
    },

    async findAuthorizationCodeByHash(codeHash) {
      return authorizationCodes.find(code => code.codeHash === codeHash) ?? null
    },

    async findDeviceSessionById(id) {
      return deviceSessions.find(session => session.id === id) ?? null
    },

    async findDeviceSessionByRefreshTokenHash(refreshTokenHash) {
      return deviceSessions.find(session => session.refreshTokenHash === refreshTokenHash) ?? null
    },

    async findMatrixAccount(organizationId, userId) {
      return matrixAccounts.find(account => account.organizationId === organizationId && account.userId === userId) ?? null
    },

    async findOrganizationBySlug(slug) {
      return organizations.find(organization => organization.slug === slug) ?? null
    },

    async findUserById(organizationId, userId) {
      return users.find(user => user.organizationId === organizationId && user.id === userId) ?? null
    },

    async findUserByUsername(organizationId, username) {
      return users.find(user => user.organizationId === organizationId && user.username === username) ?? null
    },

    getPublicUser: publicUser,

    async isInstalled() {
      return organizations.length > 0
    },

    async listAuditLogsByOrganization(organizationId) {
      return auditLogs.filter(event => event.organizationId === organizationId)
    },

    async listOrganizations() {
      return [...organizations]
    },

    async listUsersByOrganization(organizationId) {
      return users.filter(user => user.organizationId === organizationId)
    },

    async markAuthorizationCodeUsed(id) {
      const code = authorizationCodes.find(item => item.id === id)
      if (!code)
        throw new Error('Authorization code not found')
      code.usedAt = nowIso()
      return code
    },

    async resetUserPassword(organizationId, userId, input) {
      const user = users.find(item => item.organizationId === organizationId && item.id === userId)
      if (!user)
        throw new Error('User not found')

      user.passwordHash = input.passwordHash
      user.mustChangePassword = input.mustChangePassword
      user.updatedAt = nowIso()
      return user
    },

    async updateUser(organizationId, userId, input) {
      const user = users.find(item => item.organizationId === organizationId && item.id === userId)
      if (!user)
        throw new Error('User not found')
      if (input.username && users.some(item => item.organizationId === organizationId && item.id !== userId && item.username === input.username))
        throw new Error('Username is already in use')

      user.username = input.username ?? user.username
      user.email = input.email ?? user.email
      user.displayName = input.displayName ?? user.displayName
      user.status = input.status ?? user.status
      user.roles = input.roles ? [...input.roles] : user.roles
      user.updatedAt = nowIso()
      return user
    },

    async upsertMatrixAccount(input) {
      const existing = matrixAccounts.find(account => account.organizationId === input.organizationId && account.userId === input.userId)
      const lastProvisionedAt = nowIso()
      if (existing) {
        existing.matrixUserId = input.matrixUserId
        existing.matrixDeviceId = input.matrixDeviceId
        existing.accessToken = input.accessToken
        existing.lastProvisionedAt = lastProvisionedAt
        existing.provisioningStatus = 'active'
        return existing
      }

      const account: MatrixAccountRecord = {
        ...input,
        lastProvisionedAt,
        provisioningStatus: 'active',
      }
      matrixAccounts.push(account)
      return account
    },
  }
}
