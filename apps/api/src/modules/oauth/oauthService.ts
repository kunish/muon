import type {
  OAuthLoginRequest,
  OAuthLoginResponse,
  OAuthRefreshRequest,
  OAuthTokenRequest,
  OAuthTokenResponse,
} from '@muon/enterprise-contracts'
import type { ApiEffect } from '../../effect'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import type { MatrixProvisioningAdapter } from '../matrix/provisioning'
import { createHash, randomBytes } from 'node:crypto'
import { oauthLoginRequestSchema, oauthRefreshRequestSchema, oauthTokenRequestSchema } from '@muon/enterprise-contracts'
import { Effect } from 'effect'
import { fromPromise, fromSync, runApiEffect } from '../../effect'
import { verifyPasswordEffect } from '../../security/password'
import { MustChangePasswordError } from '../auth/adminSessionService'

const DESKTOP_CLIENT_ID = 'muon-desktop'
const DESKTOP_REDIRECT_URI = 'muon://auth/callback'
const CODE_TTL_MS = 1000 * 60 * 5
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

export interface OAuthService {
  exchangeCode: (input: OAuthTokenRequest) => Promise<OAuthTokenResponse>
  loginAndCreateCode: (input: OAuthLoginRequest) => Promise<OAuthLoginResponse>
  refresh: (input: OAuthRefreshRequest) => Promise<OAuthTokenResponse>
}

export interface OAuthEffectService {
  exchangeCode: (input: OAuthTokenRequest) => ApiEffect<OAuthTokenResponse>
  loginAndCreateCode: (input: OAuthLoginRequest) => ApiEffect<OAuthLoginResponse>
  refresh: (input: OAuthRefreshRequest) => ApiEffect<OAuthTokenResponse>
}

export interface OAuthServiceDeps {
  matrix: MatrixProvisioningAdapter
  matrixServerUrl: string
  repository: EnterpriseRepository
}

function token(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

function codeHash(code: string): string {
  return sha256(`oauth-code:${code}`)
}

function assertDesktopClientId(clientId: string): void {
  if (clientId !== DESKTOP_CLIENT_ID) throw new Error('Invalid OAuth client')
}

function assertDesktopClient(clientId: string, redirectUri: string): void {
  assertDesktopClientId(clientId)
  if (redirectUri !== DESKTOP_REDIRECT_URI) throw new Error('Invalid OAuth client')
}

function verifyPkce(method: 'plain' | 'S256', verifier: string, challenge: string): boolean {
  if (method === 'plain') return verifier === challenge
  return sha256(verifier) === challenge
}

function findActiveUserEffect(
  repository: EnterpriseRepository,
  organizationSlug: string,
  username: string,
  password: string,
): ApiEffect<{
  organizationId: string
  user: EnterpriseUserRecord
}> {
  return Effect.gen(function* () {
    const organization = yield* fromPromise(() => repository.findOrganizationBySlug(organizationSlug))
    if (!organization || organization.status !== 'active')
      return yield* Effect.fail(new Error('Invalid organization or credentials'))

    const user = yield* fromPromise(() => repository.findUserByUsername(organization.id, username))
    if (!user || user.status !== 'active') return yield* Effect.fail(new Error('Invalid organization or credentials'))

    const passwordMatches = yield* verifyPasswordEffect(password, user.passwordHash)
    if (!passwordMatches) return yield* Effect.fail(new Error('Invalid organization or credentials'))

    return { organizationId: organization.id, user }
  })
}

export function createOAuthService(deps: OAuthServiceDeps): OAuthService {
  const service = createOAuthEffectService(deps)
  return {
    exchangeCode: (input) => runApiEffect(service.exchangeCode(input)),
    loginAndCreateCode: (input) => runApiEffect(service.loginAndCreateCode(input)),
    refresh: (input) => runApiEffect(service.refresh(input)),
  }
}

export function createOAuthEffectService({
  repository,
  matrix,
  matrixServerUrl,
}: OAuthServiceDeps): OAuthEffectService {
  return {
    loginAndCreateCode(input) {
      return Effect.gen(function* () {
        const request = yield* fromSync(() => oauthLoginRequestSchema.parse(input))
        yield* fromSync(() => assertDesktopClient(request.clientId, request.redirectUri))
        const { organizationId, user } = yield* findActiveUserEffect(
          repository,
          request.organizationSlug,
          request.username,
          request.password,
        )

        if (user.mustChangePassword) return yield* Effect.fail(new MustChangePasswordError())

        const existingMatrixAccount = yield* fromPromise(() => repository.findMatrixAccount(organizationId, user.id))
        const provisioned = existingMatrixAccount
          ? {
              matrixUserId: existingMatrixAccount.matrixUserId,
              accessToken: existingMatrixAccount.accessToken,
              deviceId: existingMatrixAccount.matrixDeviceId,
            }
          : yield* fromPromise(() =>
              matrix.ensureUser({
                organizationSlug: request.organizationSlug,
                username: user.username,
                displayName: user.displayName,
              }),
            )

        yield* fromPromise(() =>
          repository.upsertMatrixAccount({
            organizationId,
            userId: user.id,
            matrixUserId: provisioned.matrixUserId,
            matrixDeviceId: provisioned.deviceId,
            accessToken: provisioned.accessToken,
          }),
        )

        const code = token()
        yield* fromPromise(() =>
          repository.createAuthorizationCode({
            codeHash: codeHash(code),
            organizationId,
            userId: user.id,
            clientId: request.clientId,
            redirectUri: request.redirectUri,
            codeChallenge: request.codeChallenge,
            codeChallengeMethod: request.codeChallengeMethod,
            expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
            matrixSession: {
              serverUrl: matrixServerUrl,
              userId: provisioned.matrixUserId,
              accessToken: provisioned.accessToken,
              deviceId: provisioned.deviceId,
            },
          }),
        )

        yield* fromPromise(() =>
          repository.appendAuditLog({
            organizationId,
            actorUserId: user.id,
            action: 'oauth.code.created',
            targetType: 'oauth_client',
            targetId: request.clientId,
          }),
        )

        return {
          code,
          state: request.state,
          redirectUri: `${request.redirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(request.state)}`,
        }
      })
    },

    exchangeCode(input) {
      return Effect.gen(function* () {
        const request = yield* fromSync(() => oauthTokenRequestSchema.parse(input))
        yield* fromSync(() => assertDesktopClient(request.clientId, request.redirectUri))

        const authorizationCode = yield* fromPromise(() =>
          repository.findAuthorizationCodeByHash(codeHash(request.code)),
        )
        if (!authorizationCode) return yield* Effect.fail(new Error('Invalid authorization code'))

        if (authorizationCode.usedAt) return yield* Effect.fail(new Error('Authorization code has already been used'))

        if (Date.parse(authorizationCode.expiresAt) <= Date.now())
          return yield* Effect.fail(new Error('Authorization code has expired'))

        if (authorizationCode.clientId !== request.clientId || authorizationCode.redirectUri !== request.redirectUri)
          return yield* Effect.fail(new Error('Invalid OAuth client'))

        if (!verifyPkce(authorizationCode.codeChallengeMethod, request.codeVerifier, authorizationCode.codeChallenge))
          return yield* Effect.fail(new Error('Invalid PKCE verifier'))

        yield* fromPromise(() => repository.markAuthorizationCodeUsed(authorizationCode.id))

        const accessToken = token()
        const refreshToken = token()
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
        const newSession = yield* fromPromise(() =>
          repository.createDeviceSession({
            organizationId: authorizationCode.organizationId,
            userId: authorizationCode.userId,
            deviceName: request.deviceName,
            accessTokenHash: sha256(`access:${accessToken}`),
            refreshTokenHash: sha256(`refresh:${refreshToken}`),
            expiresAt,
          }),
        )

        yield* fromPromise(() =>
          repository.appendAuditLog({
            organizationId: authorizationCode.organizationId,
            actorUserId: authorizationCode.userId,
            action: 'oauth.token.issued',
            targetType: 'device_session',
            targetId: newSession.id,
          }),
        )

        return {
          muonSession: {
            accessToken,
            refreshToken,
            expiresAt,
            deviceName: request.deviceName,
          },
          matrixSession: authorizationCode.matrixSession,
        }
      })
    },

    refresh(input) {
      return Effect.gen(function* () {
        const request = yield* fromSync(() => oauthRefreshRequestSchema.parse(input))
        yield* fromSync(() => assertDesktopClientId(request.clientId))

        const session = yield* fromPromise(() =>
          repository.findDeviceSessionByRefreshTokenHash(sha256(`refresh:${request.refreshToken}`)),
        )
        if (!session || session.revokedAt) return yield* Effect.fail(new Error('Invalid refresh token'))
        if (Date.parse(session.expiresAt) <= Date.now()) return yield* Effect.fail(new Error('Invalid refresh token'))

        const matrixAccount = yield* fromPromise(() =>
          repository.findMatrixAccount(session.organizationId, session.userId),
        )
        if (!matrixAccount) return yield* Effect.fail(new Error('Matrix account not found'))

        const revoked = yield* fromPromise(() => repository.revokeDeviceSession(session.id))
        if (!revoked) return yield* Effect.fail(new Error('Invalid refresh token'))

        const accessToken = token()
        const refreshToken = token()
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
        const newSession = yield* fromPromise(() =>
          repository.createDeviceSession({
            organizationId: session.organizationId,
            userId: session.userId,
            deviceName: request.deviceName,
            accessTokenHash: sha256(`access:${accessToken}`),
            refreshTokenHash: sha256(`refresh:${refreshToken}`),
            expiresAt,
          }),
        )

        yield* fromPromise(() =>
          repository.appendAuditLog({
            organizationId: session.organizationId,
            actorUserId: session.userId,
            action: 'oauth.token.refreshed',
            targetType: 'device_session',
            targetId: newSession.id,
            metadata: {
              previousSessionId: session.id,
              deviceName: request.deviceName,
            },
          }),
        )

        return {
          muonSession: {
            accessToken,
            refreshToken,
            expiresAt,
            deviceName: request.deviceName,
          },
          matrixSession: {
            serverUrl: matrixServerUrl,
            userId: matrixAccount.matrixUserId,
            accessToken: matrixAccount.accessToken,
            deviceId: matrixAccount.matrixDeviceId,
          },
        }
      })
    },
  }
}
