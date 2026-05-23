import type { AdminLoginRequest, AdminSession } from '@muon/enterprise-contracts'
import type { ApiEffect } from '../../effect'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import { createHash, randomBytes } from 'node:crypto'
import { adminLoginRequestSchema } from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { fromPromise, fromSync, runApiEffect } from '../../effect'
import { verifyPasswordEffect } from '../../security/password'
import { assertAdminRole } from '../users/rbac'

export class AdminAuthenticationError extends Error {
  constructor(message = 'Admin authentication required') {
    super(message)
    this.name = 'AdminAuthenticationError'
  }
}

export class MustChangePasswordError extends Error {
  readonly code = 'must_change_password'
  constructor(message = 'Password must be changed before continuing') {
    super(message)
    this.name = 'MustChangePasswordError'
  }
}

export interface AdminLoginResult {
  session: AdminSession
  user: EnterpriseUserRecord
}

export interface AdminSessionService {
  login: (input: AdminLoginRequest) => Promise<AdminLoginResult>
  validate: (token: string) => Promise<EnterpriseUserRecord>
  revoke: (token: string) => Promise<void>
  revokeOthersForUser: (currentToken: string) => Promise<void>
}

export interface AdminSessionEffectService {
  login: (input: AdminLoginRequest) => ApiEffect<AdminLoginResult>
  validate: (token: string) => ApiEffect<EnterpriseUserRecord>
  revoke: (token: string) => ApiEffect<void>
  revokeOthersForUser: (currentToken: string) => ApiEffect<void>
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
  const service = createAdminSessionEffectService({ repository })
  return {
    login: (input) => runApiEffect(service.login(input)),
    validate: (token) => runApiEffect(service.validate(token)),
    revoke: (token) => runApiEffect(service.revoke(token)),
    revokeOthersForUser: (currentToken) => runApiEffect(service.revokeOthersForUser(currentToken)),
  }
}

export function createAdminSessionEffectService({ repository }: AdminSessionServiceDeps): AdminSessionEffectService {
  return {
    login(input) {
      return Effect.gen(function* () {
        const request = yield* fromSync(() => adminLoginRequestSchema.parse(input))
        const organization = yield* fromPromise(() => repository.findOrganizationBySlug(request.organizationSlug))
        if (!organization) return yield* Effect.fail(new Error('Invalid organization or credentials'))

        const user = yield* fromPromise(() => repository.findUserByUsername(organization.id, request.username))
        if (!user || user.status !== 'active')
          return yield* Effect.fail(new Error('Invalid organization or credentials'))

        const passwordMatches = yield* verifyPasswordEffect(request.password, user.passwordHash)
        if (!passwordMatches) return yield* Effect.fail(new Error('Invalid organization or credentials'))

        yield* fromSync(() => assertAdminRole(user))

        yield* fromPromise(() =>
          repository.appendAuditLog({
            organizationId: organization.id,
            actorUserId: user.id,
            action: 'admin.login',
            targetType: 'user',
            targetId: user.id,
          }),
        )

        const accessToken = createToken()
        const refreshToken = createToken()
        const expiresAt = sessionExpiry()
        yield* fromPromise(() =>
          repository.createAdminSession({
            organizationId: organization.id,
            userId: user.id,
            accessTokenHash: sha256(accessToken),
            refreshTokenHash: sha256(refreshToken),
            expiresAt,
          }),
        )

        return {
          user,
          session: { accessToken, refreshToken, expiresAt },
        }
      })
    },

    validate(token) {
      return Effect.gen(function* () {
        if (!token) return yield* Effect.fail(new AdminAuthenticationError())

        const session = yield* fromPromise(() => repository.findAdminSessionByTokenHash(sha256(token)))
        if (!session || session.revokedAt) return yield* Effect.fail(new AdminAuthenticationError())

        if (new Date(session.expiresAt).getTime() <= Date.now())
          return yield* Effect.fail(new AdminAuthenticationError())

        const user = yield* fromPromise(() => repository.findUserById(session.organizationId, session.userId))
        if (!user || user.status !== 'active') return yield* Effect.fail(new AdminAuthenticationError())

        void runApiEffect(
          fromPromise(() => repository.touchAdminSession(session.id)).pipe(Effect.catchAll(() => Effect.void)),
        )
        return user
      })
    },

    revoke(token) {
      return Effect.gen(function* () {
        if (!token) return
        const session = yield* fromPromise(() => repository.findAdminSessionByTokenHash(sha256(token)))
        if (!session) return
        yield* fromPromise(() => repository.revokeAdminSession(session.id))
      })
    },

    revokeOthersForUser(currentToken) {
      return Effect.gen(function* () {
        if (!currentToken) return
        const session = yield* fromPromise(() => repository.findAdminSessionByTokenHash(sha256(currentToken)))
        if (!session) return
        yield* fromPromise(() =>
          repository.revokeAllAdminSessionsForUserExcept(session.organizationId, session.userId, session.id),
        )
      })
    },
  }
}
