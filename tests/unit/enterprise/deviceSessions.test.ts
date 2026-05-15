import { describe, expect, it } from 'vitest'
import { createInstallService } from '../../../apps/api/src/modules/install/installService'
import { createInMemoryEnterpriseRepository } from '../../../apps/api/src/repository'

async function setupInstalled() {
  const repository = createInMemoryEnterpriseRepository()
  const install = await createInstallService({ repository }).install({
    organizationName: 'Acme',
    organizationSlug: 'acme',
    ownerUsername: 'owner',
    ownerEmail: 'owner@acme.test',
    ownerDisplayName: 'Owner',
    ownerPassword: 'correct horse battery staple',
  })
  return { repository, install }
}

describe('device session repository methods', () => {
  it('findDeviceSessionByRefreshTokenHash returns the matching row', async () => {
    const { repository, install } = await setupInstalled()
    const created = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop',
      accessTokenHash: 'plain-access-1',
      refreshTokenHash: 'refresh-hash-1',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    const found = await repository.findDeviceSessionByRefreshTokenHash('refresh-hash-1')
    expect(found?.id).toBe(created.id)

    const missing = await repository.findDeviceSessionByRefreshTokenHash('no-such-hash')
    expect(missing).toBeNull()
  })

  it('findActiveDeviceSessionsByUser returns only non-revoked, non-expired rows', async () => {
    const { repository, install } = await setupInstalled()

    const active = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop A',
      accessTokenHash: 'a',
      refreshTokenHash: 'a-r',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    const expired = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop B',
      accessTokenHash: 'b',
      refreshTokenHash: 'b-r',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })

    const revoked = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop C',
      accessTokenHash: 'c',
      refreshTokenHash: 'c-r',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    await repository.revokeDeviceSession(revoked.id)

    const list = await repository.findActiveDeviceSessionsByUser(install.organization.id, install.owner.id)
    expect(list.map(s => s.id)).toEqual([active.id])

    void expired
  })

  it('revokeDeviceSession sets revokedAt and is idempotent', async () => {
    const { repository, install } = await setupInstalled()
    const created = await repository.createDeviceSession({
      organizationId: install.organization.id,
      userId: install.owner.id,
      deviceName: 'Muon Desktop',
      accessTokenHash: 'plain',
      refreshTokenHash: 'plain-r',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    await repository.revokeDeviceSession(created.id)
    const firstRevokedAt = (await repository.findDeviceSessionByRefreshTokenHash('plain-r'))?.revokedAt
    expect(firstRevokedAt).toBeTruthy()

    await new Promise(resolve => setTimeout(resolve, 5))
    await repository.revokeDeviceSession(created.id)
    await repository.revokeDeviceSession('unknown-id')

    const afterRevokedAt = (await repository.findDeviceSessionByRefreshTokenHash('plain-r'))?.revokedAt
    expect(afterRevokedAt).toBe(firstRevokedAt)
  })
})
