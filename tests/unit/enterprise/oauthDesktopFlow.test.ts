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
})
