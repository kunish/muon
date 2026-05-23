import type {
  OAuthLoginRequest,
  OAuthLoginResponse,
  OAuthRefreshRequest,
  OAuthTokenRequest,
  OAuthTokenResponse,
} from '@muon/enterprise-contracts'
import type { EnterpriseRepository, EnterpriseUserRecord } from '../../repository'
import type { MatrixProvisioningAdapter } from '../matrix/provisioning'
import { createHash, randomBytes } from 'node:crypto'
import { oauthLoginRequestSchema, oauthRefreshRequestSchema, oauthTokenRequestSchema } from '@muon/enterprise-contracts'
import { verifyPassword } from '../../security/password'
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

async function findActiveUser(
  repository: EnterpriseRepository,
  organizationSlug: string,
  username: string,
  password: string,
): Promise<{
  organizationId: string
  user: EnterpriseUserRecord
}> {
  const organization = await repository.findOrganizationBySlug(organizationSlug)
  if (!organization || organization.status !== 'active') throw new Error('Invalid organization or credentials')

  const user = await repository.findUserByUsername(organization.id, username)
  if (!user || user.status !== 'active') throw new Error('Invalid organization or credentials')

  if (!(await verifyPassword(password, user.passwordHash))) throw new Error('Invalid organization or credentials')

  return { organizationId: organization.id, user }
}

export function createOAuthService({ repository, matrix, matrixServerUrl }: OAuthServiceDeps): OAuthService {
  return {
    async loginAndCreateCode(input) {
      const request = oauthLoginRequestSchema.parse(input)
      assertDesktopClient(request.clientId, request.redirectUri)
      const { organizationId, user } = await findActiveUser(
        repository,
        request.organizationSlug,
        request.username,
        request.password,
      )

      if (user.mustChangePassword) throw new MustChangePasswordError()

      const existingMatrixAccount = await repository.findMatrixAccount(organizationId, user.id)
      const provisioned = existingMatrixAccount
        ? {
            matrixUserId: existingMatrixAccount.matrixUserId,
            accessToken: existingMatrixAccount.accessToken,
            deviceId: existingMatrixAccount.matrixDeviceId,
          }
        : await matrix.ensureUser({
            organizationSlug: request.organizationSlug,
            username: user.username,
            displayName: user.displayName,
          })

      await repository.upsertMatrixAccount({
        organizationId,
        userId: user.id,
        matrixUserId: provisioned.matrixUserId,
        matrixDeviceId: provisioned.deviceId,
        accessToken: provisioned.accessToken,
      })

      const code = token()
      await repository.createAuthorizationCode({
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
      })

      await repository.appendAuditLog({
        organizationId,
        actorUserId: user.id,
        action: 'oauth.code.created',
        targetType: 'oauth_client',
        targetId: request.clientId,
      })

      return {
        code,
        state: request.state,
        redirectUri: `${request.redirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(request.state)}`,
      }
    },

    async exchangeCode(input) {
      const request = oauthTokenRequestSchema.parse(input)
      assertDesktopClient(request.clientId, request.redirectUri)

      const authorizationCode = await repository.findAuthorizationCodeByHash(codeHash(request.code))
      if (!authorizationCode) throw new Error('Invalid authorization code')

      if (authorizationCode.usedAt) throw new Error('Authorization code has already been used')

      if (Date.parse(authorizationCode.expiresAt) <= Date.now()) throw new Error('Authorization code has expired')

      if (authorizationCode.clientId !== request.clientId || authorizationCode.redirectUri !== request.redirectUri)
        throw new Error('Invalid OAuth client')

      if (!verifyPkce(authorizationCode.codeChallengeMethod, request.codeVerifier, authorizationCode.codeChallenge))
        throw new Error('Invalid PKCE verifier')

      await repository.markAuthorizationCodeUsed(authorizationCode.id)

      const accessToken = token()
      const refreshToken = token()
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
      const newSession = await repository.createDeviceSession({
        organizationId: authorizationCode.organizationId,
        userId: authorizationCode.userId,
        deviceName: request.deviceName,
        accessTokenHash: sha256(`access:${accessToken}`),
        refreshTokenHash: sha256(`refresh:${refreshToken}`),
        expiresAt,
      })

      await repository.appendAuditLog({
        organizationId: authorizationCode.organizationId,
        actorUserId: authorizationCode.userId,
        action: 'oauth.token.issued',
        targetType: 'device_session',
        targetId: newSession.id,
      })

      return {
        muonSession: {
          accessToken,
          refreshToken,
          expiresAt,
          deviceName: request.deviceName,
        },
        matrixSession: authorizationCode.matrixSession,
      }
    },

    async refresh(input) {
      const request = oauthRefreshRequestSchema.parse(input)
      assertDesktopClientId(request.clientId)

      const session = await repository.findDeviceSessionByRefreshTokenHash(sha256(`refresh:${request.refreshToken}`))
      if (!session || session.revokedAt) throw new Error('Invalid refresh token')
      if (Date.parse(session.expiresAt) <= Date.now()) throw new Error('Invalid refresh token')

      const matrixAccount = await repository.findMatrixAccount(session.organizationId, session.userId)
      if (!matrixAccount) throw new Error('Matrix account not found')

      const revoked = await repository.revokeDeviceSession(session.id)
      if (!revoked) throw new Error('Invalid refresh token')

      const accessToken = token()
      const refreshToken = token()
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
      const newSession = await repository.createDeviceSession({
        organizationId: session.organizationId,
        userId: session.userId,
        deviceName: request.deviceName,
        accessTokenHash: sha256(`access:${accessToken}`),
        refreshTokenHash: sha256(`refresh:${refreshToken}`),
        expiresAt,
      })

      await repository.appendAuditLog({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: 'oauth.token.refreshed',
        targetType: 'device_session',
        targetId: newSession.id,
        metadata: {
          previousSessionId: session.id,
          deviceName: request.deviceName,
        },
      })

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
    },
  }
}
