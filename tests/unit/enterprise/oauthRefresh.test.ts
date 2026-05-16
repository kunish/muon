import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createOAuthService } from '../../../apps/api/src/modules/oauth/oauthService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'

const PKCE_VERIFIER = 'a'.repeat(48)

async function setupOauthSession() {
  const repository = createInMemoryEnterpriseRepository()
  await createInstallService({ repository }).install({
    organizationName: 'Acme',
    organizationSlug: 'acme',
    ownerUsername: 'owner',
    ownerEmail: 'owner@acme.test',
    ownerDisplayName: 'Owner',
    ownerPassword: 'correct horse battery staple',
  })

  const oauth = createOAuthService({
    repository,
    matrix: {
      async ensureUser() {
        return {
          matrixUserId: '@acme.owner:localhost',
          accessToken: 'mx-1',
          deviceId: 'D1',
        }
      },
    },
    matrixServerUrl: 'http://localhost:6167',
  })

  const loginResult = await oauth.loginAndCreateCode({
    organizationSlug: 'acme',
    username: 'owner',
    password: 'correct horse battery staple',
    clientId: 'muon-desktop',
    redirectUri: 'muon://auth/callback',
    codeChallenge: PKCE_VERIFIER,
    codeChallengeMethod: 'plain',
    state: 'st',
  })
  const exchanged = await oauth.exchangeCode({
    code: loginResult.code,
    codeVerifier: PKCE_VERIFIER,
    redirectUri: 'muon://auth/callback',
    clientId: 'muon-desktop',
    deviceName: 'Muon Desktop',
  })

  return { repository, oauth, exchanged }
}

describe('oauthService.refresh', () => {
  it('issues a new access+refresh token pair and revokes the old session', async () => {
    const { repository, oauth, exchanged } = await setupOauthSession()
    const oldSession = repository.deviceSessions[0]

    const refreshed = await oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })

    expect(refreshed.muonSession.accessToken).not.toBe(exchanged.muonSession.accessToken)
    expect(refreshed.muonSession.refreshToken).not.toBe(exchanged.muonSession.refreshToken)
    expect(refreshed.muonSession.deviceName).toBe('Muon Desktop')

    // matrixSession re-attached, not re-issued.
    expect(refreshed.matrixSession.accessToken).toBe(exchanged.matrixSession.accessToken)
    expect(refreshed.matrixSession.deviceId).toBe(exchanged.matrixSession.deviceId)

    const oldRow = repository.deviceSessions.find(s => s.id === oldSession.id)
    expect(oldRow?.revokedAt).toBeTruthy()

    expect(repository.deviceSessions.length).toBe(2)
    const newRow = repository.deviceSessions.find(s => s.id !== oldSession.id)
    expect(newRow?.revokedAt).toBeNull()

    expect(repository.auditLogs.some(e => e.action === 'oauth.token.refreshed')).toBe(true)
  })

  it('rejects re-use of the old refresh token after rotation', async () => {
    const { oauth, exchanged } = await setupOauthSession()
    await oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })

    await expect(oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow(/invalid refresh token/i)
  })

  it('rejects an unknown refresh token', async () => {
    const { oauth } = await setupOauthSession()
    await expect(oauth.refresh({
      refreshToken: 'never-issued',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow(/invalid refresh token/i)
  })

  it('rejects when the session has expired', async () => {
    const { repository, oauth, exchanged } = await setupOauthSession()
    repository.deviceSessions[0].expiresAt = new Date(Date.now() - 1000).toISOString()

    await expect(oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow(/invalid refresh token/i)
  })

  it('rejects an invalid clientId', async () => {
    const { oauth, exchanged } = await setupOauthSession()
    await expect(oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'wrong-client',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow(/invalid oauth client/i)
  })

  it('aborts and does not create a new session when the underlying revoke returns false (TOCTOU guard)', async () => {
    const { repository, oauth, exchanged } = await setupOauthSession()
    const oldSession = repository.deviceSessions[0]

    // Simulate a concurrent request having already revoked the session.
    oldSession.revokedAt = new Date().toISOString()

    // Refresh must fail because the session is already revoked.
    await expect(oauth.refresh({
      refreshToken: exchanged.muonSession.refreshToken,
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow(/invalid refresh token/i)

    // Only one session should exist (the pre-revoked one); no new session created.
    expect(repository.deviceSessions.length).toBe(1)
  })
})
