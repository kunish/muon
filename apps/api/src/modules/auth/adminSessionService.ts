import type { AdminLoginRequest, MuonSession } from '@muon/enterprise-contracts'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import { randomBytes } from 'node:crypto'
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

      return {
        user,
        session: {
          accessToken: createToken(),
          refreshToken: createToken(),
          expiresAt: sessionExpiry(),
        },
      }
    },
  }
}
