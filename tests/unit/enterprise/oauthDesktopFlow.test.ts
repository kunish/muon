import { describe, expect, it, vi } from 'vitest'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createOAuthService } from '../../../apps/api/src/modules/oauth/oauthService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'

describe('desktop oauth flow', () => {
  it('exchanges a one-time code for muon and matrix sessions', async () => {
    const repository = createInMemoryEnterpriseRepository()
    await createInstallService({ repository }).install({
      organizationName: 'Acme Research',
      organizationSlug: 'acme',
      ownerUsername: 'owner',
      ownerEmail: 'owner@acme.test',
      ownerDisplayName: 'Owner',
      ownerPassword: 'correct horse battery staple',
    })

    const matrix = {
      ensureUser: vi.fn().mockResolvedValue({
        matrixUserId: '@owner:localhost',
        accessToken: 'matrix-token',
        deviceId: 'MUONDEVICE',
      }),
    }
    const oauth = createOAuthService({
      repository,
      matrix,
      matrixServerUrl: 'http://127.0.0.1:6167',
    })

    const authorization = await oauth.loginAndCreateCode({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
      clientId: 'muon-desktop',
      redirectUri: 'muon://auth/callback',
      codeChallenge: 'plain-challenge',
      codeChallengeMethod: 'plain',
      state: 'state-1',
    })

    const token = await oauth.exchangeCode({
      code: authorization.code,
      codeVerifier: 'plain-challenge',
      redirectUri: 'muon://auth/callback',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })

    expect(token.matrixSession).toEqual({
      serverUrl: 'http://127.0.0.1:6167',
      userId: '@owner:localhost',
      accessToken: 'matrix-token',
      deviceId: 'MUONDEVICE',
    })
    await expect(oauth.exchangeCode({
      code: authorization.code,
      codeVerifier: 'plain-challenge',
      redirectUri: 'muon://auth/callback',
      clientId: 'muon-desktop',
      deviceName: 'Muon Desktop',
    })).rejects.toThrow('Authorization code has already been used')
  })

  it('refuses OAuth login when the user must change their password', async () => {
    const repository = createInMemoryEnterpriseRepository()
    const install = await createInstallService({ repository }).install({
      organizationName: 'Acme',
      organizationSlug: 'acme',
      ownerUsername: 'owner',
      ownerEmail: 'owner@acme.test',
      ownerDisplayName: 'Owner',
      ownerPassword: 'correct horse battery staple',
    })

    // installService creates owner with mustChangePassword=false; flip it.
    const ownerRecord = repository.users.find(user => user.id === install.owner.id)
    if (!ownerRecord) throw new Error('precondition: owner missing')
    await repository.resetUserPassword(install.organization.id, install.owner.id, {
      passwordHash: ownerRecord.passwordHash,
      mustChangePassword: true,
    })

    const oauth = createOAuthService({
      repository,
      matrix: {
        async ensureUser() {
          return { matrixUserId: '@owner.acme:localhost', accessToken: 'mx', deviceId: 'D' }
        },
      },
      matrixServerUrl: 'http://localhost',
    })

    await expect(oauth.loginAndCreateCode({
      organizationSlug: 'acme',
      username: 'owner',
      password: 'correct horse battery staple',
      clientId: 'muon-desktop',
      redirectUri: 'muon://auth/callback',
      codeChallenge: 'a'.repeat(43),
      codeChallengeMethod: 'S256',
      state: 'state-value',
    })).rejects.toMatchObject({ name: 'MustChangePasswordError' })
  })
})
