import type { AdminLoginRequest, MuonSession } from '@muon/enterprise-contracts'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import { createHash, randomBytes } from 'node:crypto'
import { adminLoginRequestSchema } from '@muon/enterprise-contracts'
import { verifyPassword } from '../../security/password'
import { assertAdminRole } from '../users/rbac'

export class AdminAuthenticationError extends Error {
  constructor(message = 'Admin authentication required') {
    super(message)
    this.name = 'AdminAuthenticationError'
  }
}

export interface AdminSession {
  session: MuonSession
  user: EnterpriseUserRecord
}

export interface AdminSessionService {
  login: (input: AdminLoginRequest) => Promise<AdminSession>
  validate: (token: string) => Promise<EnterpriseUserRecord>
  revoke: (token: string) => Promise<void>
}

export interface AdminSessionServiceDeps {
  repository: EnterpriseRepository
}

function createToken(): string {
  return randomBytes(32).toString('base64url')
}

function sessionExpiry(): string {
  return new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString()
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function createAdminSessionService({ repository }: AdminSessionServiceDeps): AdminSessionService {
  return {
    async login(input) {
      const request = adminLoginRequestSchema.parse(input)
      const organization = await repository.findOrganizationBySlug(request.organizationSlug)
      if (!organization)
        throw new Error('Invalid organization or credentials')

      const user = await repository.findUserByUsername(organization.id, request.username)
      if (!user || user.status !== 'active')
        throw new Error('Invalid organization or credentials')

      if (!await verifyPassword(request.password, user.passwordHash))
        throw new Error('Invalid organization or credentials')

      assertAdminRole(user)

      await repository.appendAuditLog({
        organizationId: organization.id,
        actorUserId: user.id,
        action: 'admin.login',
        targetType: 'user',
        targetId: user.id,
      })

      const accessToken = createToken()
      const refreshToken = createToken()
      const expiresAt = sessionExpiry()
      await repository.createAdminSession({
        organizationId: organization.id,
        userId: user.id,
        accessTokenHash: sha256(accessToken),
        refreshTokenHash: sha256(refreshToken),
        expiresAt,
      })

      return {
        user,
        session: { accessToken, refreshToken, expiresAt },
      }
    },

    async validate(token) {
      if (!token)
        throw new AdminAuthenticationError()

      const session = await repository.findAdminSessionByTokenHash(sha256(token))
      if (!session || session.revokedAt)
        throw new AdminAuthenticationError()

      if (new Date(session.expiresAt).getTime() <= Date.now())
        throw new AdminAuthenticationError()

      const user = await repository.findUserById(session.organizationId, session.userId)
      if (!user || user.status !== 'active')
        throw new AdminAuthenticationError()

      repository.touchAdminSession(session.id).catch(() => {})
      return user
    },

    async revoke(_token) {
      // implemented in Task 10
      throw new Error('revoke not implemented')
    },
  }
}
